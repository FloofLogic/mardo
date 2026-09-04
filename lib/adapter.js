"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const RECORD_URL = "https://downloads.flooflogic.com/mardo/release.json";
const ARCHIVE_ORIGIN = "https://mardo.flooflogic.com";
const EXPECTED_TEAM_ID = "CC4EC596R5";
const EXPECTED_BUNDLE_ID = "com.flooflogic.mardo";
const OWNER_MARKER = ".mardo-npm-owned";
const OWNER_MARKER_TEXT = "mardo npm cache v1\n";
const RECORD_LIMIT = 64 * 1024;
const ARCHIVE_LIMIT = 512 * 1024 * 1024;
const EXPANDED_LIMIT = 1024 * 1024 * 1024;
const ENTRY_LIMIT = 50_000;
const RECORD_TTL_MILLISECONDS = 6 * 60 * 60 * 1000;
const STALE_WORK_MILLISECONDS = 24 * 60 * 60 * 1000;
const STALE_LOCK_MILLISECONDS = 10 * 60 * 1000;
const LOCK_WAIT_MILLISECONDS = 30 * 1000;

const Exit = Object.freeze({
  success: 0,
  usage: 64,
  invalidInput: 65,
  unavailable: 69,
  cannotCreate: 73,
  ioError: 74
});

class AdapterError extends Error {
  constructor(message, status = Exit.unavailable, code = "adapter") {
    super(message);
    this.name = "AdapterError";
    this.status = status;
    this.code = code;
  }
}

class NetworkError extends AdapterError {
  constructor(message) {
    super(message, Exit.unavailable, "network");
    this.name = "NetworkError";
  }
}

function defaultCacheRoot(homeDirectory = os.homedir()) {
  return path.join(
    homeDirectory,
    "Library",
    "Application Support",
    "Floof Logic",
    "Mardo",
    "npm"
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateReleaseRecord(value) {
  if (!isPlainObject(value)) {
    throw new AdapterError("canonical release record is not an object");
  }

  const versionPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
  const systemPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
  const shaPattern = /^[a-f0-9]{64}$/;
  const commitPattern = /^[a-f0-9]{40}$/;
  const version = value.version;
  const archive = value.archive;

  if (value.schema !== 1 || value.product !== "Mardo" || value.availability !== "public") {
    throw new AdapterError("canonical release record has the wrong product or availability");
  }
  if (value.channel !== "beta" && value.channel !== "stable") {
    throw new AdapterError("canonical release record has an unsupported channel");
  }
  if (typeof version !== "string" || !versionPattern.test(version) || value.tag !== `v${version}`) {
    throw new AdapterError("canonical release record has an invalid version or tag");
  }
  if (!Number.isSafeInteger(value.build) || value.build < 1 || value.build > 2_147_483_647) {
    throw new AdapterError("canonical release record has an invalid build");
  }
  if (typeof value.commit !== "string" || !commitPattern.test(value.commit)) {
    throw new AdapterError("canonical release record has an invalid commit");
  }
  if (
    typeof value.minimumSystemVersion !== "string" ||
    !systemPattern.test(value.minimumSystemVersion) ||
    Number(value.minimumSystemVersion.split(".")[0]) < 14
  ) {
    throw new AdapterError("canonical release record has an invalid minimum macOS version");
  }
  if (
    !Array.isArray(value.architectures) ||
    value.architectures.length !== 2 ||
    !value.architectures.includes("arm64") ||
    !value.architectures.includes("x86_64")
  ) {
    throw new AdapterError("canonical release record is not Universal arm64/x86_64");
  }
  if (value.teamId !== EXPECTED_TEAM_ID) {
    throw new AdapterError("canonical release record has the wrong Apple team identity");
  }
  if (value.recordUrl !== RECORD_URL) {
    throw new AdapterError("canonical release record does not name its canonical URL");
  }
  if (!isPlainObject(archive)) {
    throw new AdapterError("canonical release record has no archive object");
  }

  const expectedURL = `${ARCHIVE_ORIGIN}/releases/Mardo-${version}.zip`;
  if (archive.immutableUrl !== expectedURL) {
    throw new AdapterError("canonical release record has a noncanonical archive URL");
  }
  if (!Number.isSafeInteger(archive.size) || archive.size < 1 || archive.size > ARCHIVE_LIMIT) {
    throw new AdapterError("canonical release record has an invalid archive size");
  }
  if (
    !Number.isSafeInteger(archive.uncompressedSize) ||
    archive.uncompressedSize < archive.size ||
    archive.uncompressedSize > EXPANDED_LIMIT
  ) {
    throw new AdapterError("canonical release record has an invalid expanded size");
  }
  if (
    typeof archive.sha256 !== "string" ||
    !shaPattern.test(archive.sha256) ||
    /^0+$/.test(archive.sha256)
  ) {
    throw new AdapterError("canonical release record has an invalid archive SHA-256");
  }

  return value;
}

function parseReleaseRecord(raw, source = "canonical release record") {
  if (!Buffer.isBuffer(raw) || raw.length < 2 || raw.length > RECORD_LIMIT) {
    throw new AdapterError(`${source} has invalid bounded bytes`);
  }
  let value;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new AdapterError(`${source} is not valid JSON`);
  }
  return validateReleaseRecord(value);
}

function safeRequest(url, label) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json, application/zip;q=0.9, */*;q=0.1",
          "User-Agent": "mardo-npm-adapter/1"
        }
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status !== 200) {
          response.resume();
          const unavailable = status === 408 || status === 429 || status >= 500;
          const error = unavailable
            ? new NetworkError(`${label} is temporarily unavailable`)
            : new AdapterError(`${label} returned HTTP ${status}`);
          finish(reject, error);
          return;
        }
        finish(resolve, response);
      }
    );
    request.setTimeout(30_000, () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", () => {
      finish(reject, new NetworkError(`${label} request failed`));
    });
  });
}

function checkedContentLength(response, maximum, expected, label) {
  const header = response.headers["content-length"];
  if (header === undefined) return;
  if (!/^[0-9]+$/.test(header)) {
    throw new AdapterError(`${label} has an invalid Content-Length`);
  }
  const length = Number(header);
  if (!Number.isSafeInteger(length) || length > maximum || (expected !== null && length !== expected)) {
    throw new AdapterError(`${label} has the wrong Content-Length`);
  }
}

async function fetchCanonicalRecord() {
  const response = await safeRequest(RECORD_URL, "canonical release record");
  checkedContentLength(response, RECORD_LIMIT, null, "canonical release record");
  const chunks = [];
  let length = 0;
  try {
    for await (const chunk of response) {
      length += chunk.length;
      if (length > RECORD_LIMIT) {
        response.destroy();
        throw new AdapterError("canonical release record exceeds its byte limit");
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw new NetworkError("canonical release record transfer was interrupted");
  }
  const raw = Buffer.concat(chunks, length);
  return { raw, record: parseReleaseRecord(raw) };
}

async function writeVerifiedStream(readable, destination, expectedSize, expectedSHA256) {
  const handle = await fs.promises.open(destination, "wx", 0o600);
  const digest = crypto.createHash("sha256");
  let length = 0;
  let complete = false;
  try {
    for await (const chunkValue of readable) {
      const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
      length += chunk.length;
      if (length > expectedSize || length > ARCHIVE_LIMIT) {
        throw new AdapterError("Mardo archive exceeds its declared size", Exit.ioError);
      }
      digest.update(chunk);
      await handle.write(chunk);
    }
    await handle.sync();
    const actualSHA256 = digest.digest("hex");
    if (length !== expectedSize) {
      throw new AdapterError("Mardo archive size does not match canonical release truth", Exit.ioError);
    }
    if (actualSHA256 !== expectedSHA256) {
      throw new AdapterError("Mardo archive SHA-256 does not match canonical release truth", Exit.ioError);
    }
    complete = true;
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw new NetworkError("Mardo archive transfer was interrupted");
  } finally {
    await handle.close();
    if (!complete) {
      try {
        await fs.promises.unlink(destination);
      } catch (error) {
        if (error && error.code !== "ENOENT") throw error;
      }
    }
  }
  return { length, sha256: expectedSHA256 };
}

async function downloadCanonicalArchive(record, destination) {
  const response = await safeRequest(record.archive.immutableUrl, "immutable Mardo archive");
  checkedContentLength(
    response,
    ARCHIVE_LIMIT,
    record.archive.size,
    "immutable Mardo archive"
  );
  return writeVerifiedStream(
    response,
    destination,
    record.archive.size,
    record.archive.sha256
  );
}

function runTool(executable, arguments_, label, timeout = 60_000) {
  const result = spawnSync(executable, arguments_, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout
  });
  if (result.error || result.signal || result.status !== 0) {
    throw new AdapterError(`${label} failed`, Exit.unavailable);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function readPlistValue(infoPlist, key) {
  return runTool(
    "/usr/libexec/PlistBuddy",
    ["-c", `Print :${key}`, infoPlist],
    `Mardo ${key} verification`
  ).trim();
}

function compareSystemVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function currentSystemVersion() {
  return runTool(
    "/usr/bin/sw_vers",
    ["-productVersion"],
    "macOS version discovery"
  ).trim();
}

function verifyRuntime(record, options = {}) {
  const platform = options.platform || process.platform;
  const architecture = options.architecture || process.arch;
  const systemVersion = options.systemVersion || currentSystemVersion();
  if (platform !== "darwin") {
    throw new AdapterError("Mardo requires macOS 14 or later");
  }
  if (architecture !== "arm64" && architecture !== "x64") {
    throw new AdapterError(`Mardo does not support this architecture: ${architecture}`);
  }
  const recordArchitecture = architecture === "x64" ? "x86_64" : architecture;
  if (!record.architectures.includes(recordArchitecture)) {
    throw new AdapterError(`Mardo ${record.version} does not support ${recordArchitecture}`);
  }
  if (compareSystemVersions(systemVersion, record.minimumSystemVersion) < 0) {
    throw new AdapterError(
      `Mardo ${record.version} requires macOS ${record.minimumSystemVersion} or later`
    );
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function assertOwnedDirectory(directory, uid, label) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (uid !== null && stat.uid !== uid)) {
    throw new AdapterError(`${label} is unavailable, symbolic, or not owned by this user`, Exit.cannotCreate);
  }
}

function ensureDirectoryChain(homeDirectory, destination, uid) {
  const home = fs.realpathSync(homeDirectory);
  const resolved = path.resolve(destination);
  if (!isInside(home, resolved)) {
    throw new AdapterError("Mardo npm cache must remain inside the current home directory", Exit.cannotCreate);
  }
  let cursor = home;
  for (const component of path.relative(home, resolved).split(path.sep)) {
    cursor = path.join(cursor, component);
    if (!fs.existsSync(cursor)) fs.mkdirSync(cursor, { mode: 0o700 });
    assertOwnedDirectory(cursor, uid, "Mardo npm cache path");
  }
}

function readMarker(directory, uid) {
  const marker = path.join(directory, OWNER_MARKER);
  let stat;
  try {
    stat = fs.lstatSync(marker);
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    (uid !== null && stat.uid !== uid) ||
    stat.size !== Buffer.byteLength(OWNER_MARKER_TEXT) ||
    (stat.mode & 0o077) !== 0
  ) {
    return false;
  }
  return fs.readFileSync(marker, "utf8") === OWNER_MARKER_TEXT;
}

function writeMarker(directory) {
  fs.writeFileSync(path.join(directory, OWNER_MARKER), OWNER_MARKER_TEXT, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
}

function prepareCache(options = {}) {
  const requestedHome = path.resolve(options.homeDirectory || os.homedir());
  const homeDirectory = fs.realpathSync(requestedHome);
  let root;
  if (options.cacheRoot) {
    const requestedRoot = path.resolve(options.cacheRoot);
    const relative = path.relative(requestedHome, requestedRoot);
    root = relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." &&
      !path.isAbsolute(relative)
      ? path.join(homeDirectory, relative)
      : requestedRoot;
  } else {
    root = defaultCacheRoot(homeDirectory);
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  const rootExisted = fs.existsSync(root);
  ensureDirectoryChain(homeDirectory, root, uid);
  fs.chmodSync(root, 0o700);
  if (!rootExisted) writeMarker(root);
  if (!readMarker(root, uid)) {
    throw new AdapterError("refusing to use an unowned Mardo npm cache directory", Exit.cannotCreate);
  }

  const versions = path.join(root, "versions");
  if (!fs.existsSync(versions)) fs.mkdirSync(versions, { mode: 0o700 });
  assertOwnedDirectory(versions, uid, "Mardo npm versions directory");
  fs.chmodSync(versions, 0o700);
  return { homeDirectory, root, versions, uid };
}

function safeReplaceableFile(file, uid, label) {
  const stat = fs.lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    (uid !== null && stat.uid !== uid) ||
    (stat.mode & 0o077) !== 0
  ) {
    throw new AdapterError(`${label} is not a private owned regular file`, Exit.cannotCreate);
  }
  return stat;
}

function safeRegularFile(file, uid, maximum, label) {
  const stat = safeReplaceableFile(file, uid, label);
  if (stat.size < 1 || stat.size > maximum) {
    throw new AdapterError(`${label} has invalid bounded bytes`, Exit.cannotCreate);
  }
  return stat;
}

function readCurrentRecord(cache) {
  const file = path.join(cache.root, "current.json");
  if (!fs.existsSync(file)) return null;
  const stat = safeRegularFile(file, cache.uid, RECORD_LIMIT, "Mardo npm current record");
  const raw = fs.readFileSync(file);
  return {
    file,
    raw,
    record: parseReleaseRecord(raw, "cached canonical release record"),
    modifiedMilliseconds: stat.mtimeMs
  };
}

function atomicWriteCurrent(cache, raw) {
  parseReleaseRecord(raw);
  const current = path.join(cache.root, "current.json");
  if (fs.existsSync(current)) {
    safeReplaceableFile(current, cache.uid, "Mardo npm current record");
  }
  const temporary = path.join(cache.root, `.current-${process.pid}-${crypto.randomUUID()}.json`);
  try {
    fs.writeFileSync(temporary, raw, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, current);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (error && error.code !== "ENOENT") throw error;
    }
  }
}

function versionDirectory(cache, version) {
  return path.join(cache.versions, version);
}

function classifyOwnedDirectory(directory, cache) {
  if (!fs.existsSync(directory)) return "absent";
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (cache.uid !== null && stat.uid !== cache.uid)) {
    return "foreign";
  }
  return readMarker(directory, cache.uid) ? "owned" : "foreign";
}

function removeOwnedDirectory(directory, cache) {
  const parent = path.dirname(directory);
  if (parent !== cache.versions && parent !== cache.root) {
    throw new AdapterError("refusing an out-of-bounds Mardo npm cache cleanup", Exit.cannotCreate);
  }
  if (classifyOwnedDirectory(directory, cache) !== "owned") {
    throw new AdapterError("refusing to remove an unowned Mardo npm cache path", Exit.cannotCreate);
  }
  fs.rmSync(directory, { recursive: true, force: false, maxRetries: 2 });
}

function inspectApplicationTree(application, record) {
  const applicationRoot = fs.realpathSync(application);
  const pending = [application];
  let entries = 0;
  let bytes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    for (const name of fs.readdirSync(current)) {
      entries += 1;
      if (entries > ENTRY_LIMIT) {
        throw new AdapterError("Mardo archive expands to too many filesystem entries", Exit.ioError);
      }
      const item = path.join(current, name);
      const stat = fs.lstatSync(item);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        pending.push(item);
      } else if (stat.isFile() && !stat.isSymbolicLink()) {
        bytes += stat.size;
        if (bytes > record.archive.uncompressedSize + 1024 * 1024) {
          throw new AdapterError("Mardo archive exceeds its declared expanded size", Exit.ioError);
        }
      } else if (stat.isSymbolicLink()) {
        const target = fs.realpathSync(item);
        if (!isInside(applicationRoot, target)) {
          throw new AdapterError("Mardo archive contains an escaping symbolic link", Exit.ioError);
        }
      } else {
        throw new AdapterError("Mardo archive contains an unsupported filesystem entry", Exit.ioError);
      }
    }
  }
  return { entries, bytes };
}

function extractArchive(archive, extractionDirectory, record) {
  const listing = runTool(
    "/usr/bin/unzip",
    ["-Z", "-1", archive],
    "Mardo archive path inspection",
    60_000
  ).split("\n").filter(Boolean);
  if (listing.length < 1 || listing.length > ENTRY_LIMIT) {
    throw new AdapterError("Mardo archive has an invalid entry count", Exit.ioError);
  }
  for (const entry of listing) {
    const components = entry.replace(/\/$/, "").split("/");
    const applicationEntry = components[0] === "Mardo.app";
    const resourceForkEntry = components[0] === "__MACOSX" &&
      (components.length === 1 || components[1] === "Mardo.app");
    if (
      entry.startsWith("/") ||
      entry.includes("\\") ||
      (!applicationEntry && !resourceForkEntry) ||
      components.some((component) => component === "" || component === "." || component === "..")
    ) {
      throw new AdapterError("Mardo archive contains an unsafe or unexpected path", Exit.ioError);
    }
  }
  fs.mkdirSync(extractionDirectory, { mode: 0o700 });
  runTool(
    "/usr/bin/ditto",
    ["-x", "-k", archive, extractionDirectory],
    "Mardo archive extraction",
    120_000
  );
  const topLevel = fs.readdirSync(extractionDirectory);
  if (topLevel.length !== 1 || topLevel[0] !== "Mardo.app") {
    throw new AdapterError("Mardo archive does not contain exactly one top-level Mardo.app", Exit.ioError);
  }
  const application = path.join(extractionDirectory, "Mardo.app");
  const stat = fs.lstatSync(application);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new AdapterError("Mardo archive has an invalid application bundle", Exit.ioError);
  }
  inspectApplicationTree(application, record);
  return application;
}

function verifyApplication(application, record, full = false) {
  const infoPlist = path.join(application, "Contents", "Info.plist");
  const bundleID = readPlistValue(infoPlist, "CFBundleIdentifier");
  const version = readPlistValue(infoPlist, "CFBundleShortVersionString");
  const build = readPlistValue(infoPlist, "CFBundleVersion");
  const minimum = readPlistValue(infoPlist, "LSMinimumSystemVersion");
  const executableName = readPlistValue(infoPlist, "CFBundleExecutable");
  if (bundleID !== EXPECTED_BUNDLE_ID || version !== record.version || build !== String(record.build)) {
    throw new AdapterError("Mardo application identity does not match canonical release truth");
  }
  if (minimum !== record.minimumSystemVersion || !/^[A-Za-z0-9._-]+$/.test(executableName)) {
    throw new AdapterError("Mardo application platform metadata does not match canonical release truth");
  }

  const helper = path.join(application, "Contents", "Helpers", "mardo");
  const retiredHelper = path.join(application, "Contents", "Helpers", "md");
  const helperStat = fs.lstatSync(helper);
  if (!helperStat.isFile() || helperStat.isSymbolicLink() || (helperStat.mode & 0o111) === 0) {
    throw new AdapterError("Mardo application has no executable mardo helper");
  }
  if (fs.existsSync(retiredHelper)) {
    throw new AdapterError("Mardo application contains the retired command alias");
  }

  const mainExecutable = path.join(application, "Contents", "MacOS", executableName);
  const architectures = runTool(
    "/usr/bin/lipo",
    ["-archs", mainExecutable],
    "Mardo architecture verification"
  ).trim().split(/\s+/).sort();
  if (architectures.join(",") !== "arm64,x86_64") {
    throw new AdapterError("Mardo application is not Universal arm64/x86_64");
  }

  runTool(
    "/usr/bin/codesign",
    ["--verify", "--deep", "--strict", "--verbose=2", application],
    "Mardo code-signature verification"
  );
  runTool(
    "/usr/bin/codesign",
    ["--verify", "--strict", "--verbose=2", helper],
    "Mardo helper code-signature verification"
  );
  const signature = runTool(
    "/usr/bin/codesign",
    ["-d", "--verbose=4", application],
    "Mardo signing-identity inspection"
  );
  const teamMatch = signature.match(/^TeamIdentifier=([A-Z0-9]+)$/m);
  if (!teamMatch || teamMatch[1] !== EXPECTED_TEAM_ID || teamMatch[1] !== record.teamId) {
    throw new AdapterError("Mardo application has the wrong Apple team identity");
  }

  if (full) {
    runTool(
      "/usr/sbin/spctl",
      ["--assess", "--type", "execute", "--verbose=2", application],
      "Mardo Gatekeeper assessment",
      90_000
    );
    runTool(
      "/usr/bin/xcrun",
      ["stapler", "validate", application],
      "Mardo notarization-ticket validation",
      90_000
    );
  }
  return helper;
}

function cachedApplication(cache, record, verify = verifyApplication) {
  const directory = versionDirectory(cache, record.version);
  const state = classifyOwnedDirectory(directory, cache);
  if (state === "absent") return { state, directory };
  if (state === "foreign") return { state, directory };
  const application = path.join(directory, "Mardo.app");
  try {
    const helper = verify(application, record, false);
    return { state: "valid", directory, application, helper };
  } catch (error) {
    return { state: "corrupt", directory, error };
  }
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function processExists(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && error.code === "EPERM");
  }
}

function readLockOwner(lock, uid) {
  const owner = path.join(lock, "owner.json");
  try {
    safeRegularFile(owner, uid, RECORD_LIMIT, "Mardo npm lock owner");
    const value = JSON.parse(fs.readFileSync(owner, "utf8"));
    if (
      !isPlainObject(value) ||
      !Number.isSafeInteger(value.pid) ||
      typeof value.nonce !== "string" ||
      typeof value.createdMilliseconds !== "number"
    ) return null;
    return value;
  } catch {
    return null;
  }
}

function removeStaleLock(lock, cache, now) {
  const stat = fs.lstatSync(lock);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (cache.uid !== null && stat.uid !== cache.uid)) {
    throw new AdapterError("Mardo npm cache lock is foreign or symbolic", Exit.cannotCreate);
  }
  const owner = readLockOwner(lock, cache.uid);
  const names = fs.readdirSync(lock);
  if (!owner) {
    if (now - stat.mtimeMs <= STALE_LOCK_MILLISECONDS) return false;
    if (names.length === 0) {
      fs.rmdirSync(lock);
      return true;
    }
    if (names.length === 1 && names[0] === "owner.json") {
      safeReplaceableFile(path.join(lock, "owner.json"), cache.uid, "Mardo npm lock owner");
      fs.unlinkSync(path.join(lock, "owner.json"));
      fs.rmdirSync(lock);
      return true;
    }
    throw new AdapterError("Mardo npm cache lock contains unknown data", Exit.cannotCreate);
  }
  if (now - owner.createdMilliseconds <= STALE_LOCK_MILLISECONDS || processExists(owner.pid)) {
    return false;
  }
  if (names.length !== 1 || names[0] !== "owner.json") {
    throw new AdapterError("Mardo npm cache lock contains unknown data", Exit.cannotCreate);
  }
  fs.unlinkSync(path.join(lock, "owner.json"));
  fs.rmdirSync(lock);
  return true;
}

async function acquireLock(cache, nowFunction = Date.now) {
  const lock = path.join(cache.root, ".lock");
  const deadline = nowFunction() + LOCK_WAIT_MILLISECONDS;
  const nonce = crypto.randomUUID();
  while (true) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      fs.writeFileSync(
        path.join(lock, "owner.json"),
        JSON.stringify({ pid: process.pid, nonce, createdMilliseconds: nowFunction() }) + "\n",
        { flag: "wx", mode: 0o600 }
      );
      return { lock, nonce };
    } catch (error) {
      if (!error || error.code !== "EEXIST") throw error;
      if (removeStaleLock(lock, cache, nowFunction())) continue;
      if (nowFunction() >= deadline) {
        throw new AdapterError("another Mardo npm acquisition is still running", Exit.cannotCreate);
      }
      await pause(100);
    }
  }
}

function releaseLock(cache, token) {
  const owner = readLockOwner(token.lock, cache.uid);
  if (!owner || owner.nonce !== token.nonce || owner.pid !== process.pid) {
    throw new AdapterError("Mardo npm cache lock ownership changed", Exit.cannotCreate);
  }
  fs.unlinkSync(path.join(token.lock, "owner.json"));
  fs.rmdirSync(token.lock);
}

async function withLock(cache, operation, nowFunction = Date.now) {
  const token = await acquireLock(cache, nowFunction);
  let operationError;
  try {
    return await operation();
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      releaseLock(cache, token);
    } catch (error) {
      if (!operationError) throw error;
    }
  }
}

function cleanupStaleWork(cache, now = Date.now()) {
  const entries = fs.readdirSync(cache.root).filter((name) => name.startsWith(".work-"));
  if (entries.length > 128) {
    throw new AdapterError("Mardo npm cache has too many interrupted work directories", Exit.cannotCreate);
  }
  for (const name of entries) {
    const directory = path.join(cache.root, name);
    if (classifyOwnedDirectory(directory, cache) !== "owned") continue;
    const age = now - fs.lstatSync(directory).mtimeMs;
    if (age > STALE_WORK_MILLISECONDS) removeOwnedDirectory(directory, cache);
  }
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function cleanupOldVersions(cache, currentVersion) {
  const versionPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
  const owned = fs.readdirSync(cache.versions)
    .filter((name) => versionPattern.test(name))
    .filter((name) => classifyOwnedDirectory(path.join(cache.versions, name), cache) === "owned")
    .sort(compareVersions)
    .reverse();
  const retained = new Set([currentVersion]);
  const previous = owned.find((version) => version !== currentVersion);
  if (previous) retained.add(previous);
  for (const version of owned) {
    if (!retained.has(version)) removeOwnedDirectory(path.join(cache.versions, version), cache);
  }
}

async function installApplication(cache, record, raw, options = {}) {
  const download = options.downloadArchive || downloadCanonicalArchive;
  const extract = options.extractArchive || extractArchive;
  const verify = options.verifyApplication || verifyApplication;
  const work = path.join(cache.root, `.work-${process.pid}-${crypto.randomUUID()}`);
  fs.mkdirSync(work, { mode: 0o700 });
  writeMarker(work);
  const archive = path.join(work, `Mardo-${record.version}.zip`);
  const extraction = path.join(work, "extracted");
  const staged = path.join(work, "version");
  const destination = versionDirectory(cache, record.version);
  try {
    await download(record, archive);
    const application = extract(archive, extraction, record);
    const helper = verify(application, record, true);
    fs.mkdirSync(staged, { mode: 0o700 });
    writeMarker(staged);
    fs.renameSync(application, path.join(staged, "Mardo.app"));
    fs.writeFileSync(path.join(staged, "release.json"), raw, { flag: "wx", mode: 0o600 });
    fs.renameSync(staged, destination);
    return {
      application: path.join(destination, "Mardo.app"),
      helper: path.join(destination, "Mardo.app", path.relative(application, helper))
    };
  } finally {
    if (fs.existsSync(work)) removeOwnedDirectory(work, cache);
  }
}

async function resolveApplication(options = {}) {
  const cache = prepareCache(options);
  const nowFunction = options.now || Date.now;
  const fetchRecord = options.fetchRecord || fetchCanonicalRecord;
  const verify = options.verifyApplication || verifyApplication;
  const ttl = options.recordTTLMilliseconds === undefined
    ? RECORD_TTL_MILLISECONDS
    : options.recordTTLMilliseconds;
  let current = null;
  try {
    current = readCurrentRecord(cache);
  } catch (error) {
    if (!(error instanceof AdapterError)) throw error;
  }

  if (current && nowFunction() - current.modifiedMilliseconds <= ttl) {
    verifyRuntime(current.record, options);
    const cached = cachedApplication(cache, current.record, verify);
    if (cached.state === "valid") return { ...cached, record: current.record, cache };
    if (cached.state === "foreign") {
      throw new AdapterError(
        `refusing to replace an unowned Mardo npm cache path: ${cached.directory}`,
        Exit.cannotCreate
      );
    }
  }

  let canonical;
  try {
    canonical = await fetchRecord();
    canonical.record = validateReleaseRecord(canonical.record);
    if (!Buffer.isBuffer(canonical.raw)) canonical.raw = Buffer.from(canonical.raw);
    parseReleaseRecord(canonical.raw);
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error;
    if (current) {
      verifyRuntime(current.record, options);
      const cached = cachedApplication(cache, current.record, verify);
      if (cached.state === "valid") return { ...cached, record: current.record, cache, offline: true };
    }
    throw new NetworkError(
      "cannot reach canonical release truth and no verified Mardo npm cache is available"
    );
  }

  verifyRuntime(canonical.record, options);
  return withLock(cache, async () => {
    cleanupStaleWork(cache, nowFunction());
    let cached = cachedApplication(cache, canonical.record, verify);
    if (cached.state === "foreign") {
      throw new AdapterError(
        `refusing to replace an unowned Mardo npm cache path: ${cached.directory}`,
        Exit.cannotCreate
      );
    }
    if (cached.state === "corrupt") {
      removeOwnedDirectory(cached.directory, cache);
      cached = { state: "absent", directory: cached.directory };
    }
    if (cached.state !== "valid") {
      if (options.progress !== false) {
        process.stderr.write(`mardo: acquiring and verifying Mardo ${canonical.record.version}\n`);
      }
      const installed = await installApplication(cache, canonical.record, canonical.raw, {
        downloadArchive: options.downloadArchive,
        extractArchive: options.extractArchive,
        verifyApplication: verify
      });
      cached = {
        state: "valid",
        directory: versionDirectory(cache, canonical.record.version),
        ...installed
      };
    }
    atomicWriteCurrent(cache, canonical.raw);
    cleanupOldVersions(cache, canonical.record.version);
    return { ...cached, record: canonical.record, cache };
  }, nowFunction);
}

function mardoIsRunning() {
  const result = spawnSync("/usr/bin/pgrep", ["-x", "Mardo"], {
    stdio: "ignore",
    timeout: 5_000
  });
  return result.status === 0;
}

async function cleanCache(options = {}) {
  const homeDirectory = fs.realpathSync(options.homeDirectory || os.homedir());
  const root = path.resolve(options.cacheRoot || defaultCacheRoot(homeDirectory));
  if (!fs.existsSync(root)) return { removedVersions: 0, preservedUnknown: 0 };
  const cache = prepareCache({ ...options, homeDirectory, cacheRoot: root });
  if (mardoIsRunning()) {
    throw new AdapterError("quit Mardo before cleaning its npm application cache", Exit.cannotCreate);
  }
  return withLock(cache, async () => {
    let removedVersions = 0;
    let preservedUnknown = 0;
    for (const name of fs.readdirSync(cache.versions)) {
      const directory = path.join(cache.versions, name);
      if (classifyOwnedDirectory(directory, cache) === "owned") {
        removeOwnedDirectory(directory, cache);
        removedVersions += 1;
      } else {
        preservedUnknown += 1;
      }
    }
    for (const name of fs.readdirSync(cache.root).filter((value) => value.startsWith(".work-"))) {
      const directory = path.join(cache.root, name);
      if (classifyOwnedDirectory(directory, cache) === "owned") removeOwnedDirectory(directory, cache);
      else preservedUnknown += 1;
    }
    const current = path.join(cache.root, "current.json");
    if (fs.existsSync(current)) {
      safeReplaceableFile(current, cache.uid, "Mardo npm current record");
      fs.unlinkSync(current);
    }
    return { removedVersions, preservedUnknown };
  }, options.now || Date.now);
}

function runNativeHelper(helper, arguments_) {
  const result = spawnSync(helper, arguments_, { stdio: "inherit" });
  if (result.error || result.signal || result.status === null) {
    throw new AdapterError("the verified Mardo command could not run", Exit.unavailable);
  }
  return result.status;
}

async function runCLI(arguments_, options = {}) {
  try {
    if (arguments_.length === 1 && arguments_[0] === "--npm-cache-path") {
      process.stdout.write(`${defaultCacheRoot()}\n`);
      return Exit.success;
    }
    if (arguments_.length === 1 && arguments_[0] === "--npm-cache-clean") {
      const result = await cleanCache(options);
      process.stdout.write(
        `Mardo npm cache cleaned (${result.removedVersions} application version(s) removed` +
        `${result.preservedUnknown ? `; ${result.preservedUnknown} unknown item(s) preserved` : ""}).\n`
      );
      return Exit.success;
    }
    const resolved = await resolveApplication(options);
    return runNativeHelper(resolved.helper, arguments_);
  } catch (error) {
    const failure = error instanceof AdapterError
      ? error
      : new AdapterError("unexpected npm adapter failure", Exit.ioError);
    process.stderr.write(`mardo: ${failure.message}\n`);
    return failure.status;
  }
}

module.exports = {
  AdapterError,
  NetworkError,
  constants: {
    ARCHIVE_ORIGIN,
    EXPECTED_BUNDLE_ID,
    EXPECTED_TEAM_ID,
    RECORD_TTL_MILLISECONDS,
    RECORD_URL
  },
  defaultCacheRoot,
  parseReleaseRecord,
  validateReleaseRecord,
  verifyRuntime,
  writeVerifiedStream,
  prepareCache,
  resolveApplication,
  cleanCache,
  runNativeHelper,
  runCLI,
  Exit
};
