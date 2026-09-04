"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");

const adapter = require("../lib/adapter.js");

function record(version = "0.9.13", build = 619, archiveBytes = Buffer.from("archive")) {
  return {
    schema: 1,
    product: "Mardo",
    channel: "beta",
    availability: "public",
    version,
    build,
    commit: "1".repeat(40),
    tag: `v${version}`,
    minimumSystemVersion: "14.0",
    architectures: ["arm64", "x86_64"],
    teamId: adapter.constants.EXPECTED_TEAM_ID,
    archive: {
      immutableUrl: `${adapter.constants.ARCHIVE_ORIGIN}/releases/Mardo-${version}.zip`,
      size: archiveBytes.length,
      uncompressedSize: archiveBytes.length + 4096,
      sha256: crypto.createHash("sha256").update(archiveBytes).digest("hex")
    },
    recordUrl: adapter.constants.RECORD_URL
  };
}

function encoded(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`);
}

function temporaryHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mardo-npm-test."));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

test("canonical record validation pins mutable truth to immutable identity", () => {
  const valid = record();
  assert.equal(adapter.validateReleaseRecord(valid), valid);
  for (const mutate of [
    (copy) => { copy.product = "Other"; },
    (copy) => { copy.teamId = "AAAAAAAAAA"; },
    (copy) => { copy.architectures = ["arm64"]; },
    (copy) => { copy.archive.immutableUrl = "https://example.com/Mardo.zip"; },
    (copy) => { copy.archive.sha256 = "0".repeat(64); },
    (copy) => { copy.archive.uncompressedSize = copy.archive.size - 1; }
  ]) {
    const copy = structuredClone(valid);
    mutate(copy);
    assert.throws(() => adapter.validateReleaseRecord(copy), adapter.AdapterError);
  }
});

test("verified streaming refuses corrupt and interrupted archives without partial bytes", async (t) => {
  const home = temporaryHome(t);
  const bytes = Buffer.from("bounded canonical archive");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const good = path.join(home, "good.zip");
  await adapter.writeVerifiedStream(Readable.from([bytes]), good, bytes.length, digest);
  assert.deepEqual(fs.readFileSync(good), bytes);

  const corrupt = path.join(home, "corrupt.zip");
  await assert.rejects(
    adapter.writeVerifiedStream(Readable.from([bytes]), corrupt, bytes.length, "f".repeat(64)),
    /SHA-256 does not match/
  );
  assert.equal(fs.existsSync(corrupt), false);

  const interrupted = path.join(home, "interrupted.zip");
  async function* broken() {
    yield bytes.subarray(0, 3);
    throw new Error("connection reset");
  }
  await assert.rejects(
    adapter.writeVerifiedStream(broken(), interrupted, bytes.length, digest),
    /transfer was interrupted/
  );
  assert.equal(fs.existsSync(interrupted), false);
});

test("cache acquisition is atomic, updates by canonical version, and works offline", async (t) => {
  const home = temporaryHome(t);
  const cacheRoot = adapter.defaultCacheRoot(home);
  let now = Date.now();
  let selected = record();
  let fetches = 0;
  let downloads = 0;

  const options = {
    homeDirectory: home,
    cacheRoot,
    platform: "darwin",
    architecture: "arm64",
    systemVersion: "15.0",
    progress: false,
    now: () => now,
    recordTTLMilliseconds: 1,
    fetchRecord: async () => {
      fetches += 1;
      return { record: selected, raw: encoded(selected) };
    },
    downloadArchive: async (_release, destination) => {
      downloads += 1;
      fs.writeFileSync(destination, "fixture", { flag: "wx", mode: 0o600 });
    },
    extractArchive: (_archive, destination) => {
      const app = path.join(destination, "Mardo.app");
      fs.mkdirSync(path.join(app, "Contents", "Helpers"), { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(app, "Contents", "Helpers", "mardo"), "fixture", { mode: 0o700 });
      return app;
    },
    verifyApplication: (application) => {
      const helper = path.join(application, "Contents", "Helpers", "mardo");
      assert.equal(fs.existsSync(helper), true);
      return helper;
    }
  };

  const first = await adapter.resolveApplication(options);
  assert.equal(first.record.version, "0.9.13");
  assert.equal(downloads, 1);
  assert.equal(fs.existsSync(first.helper), true);
  assert.equal(fs.readdirSync(cacheRoot).some((name) => name.startsWith(".work-")), false);

  fs.writeFileSync(path.join(cacheRoot, "current.json"), "");
  now += 10;
  const repaired = await adapter.resolveApplication(options);
  assert.equal(repaired.record.version, "0.9.13");
  assert.equal(downloads, 1);
  assert.equal(adapter.parseReleaseRecord(fs.readFileSync(path.join(cacheRoot, "current.json"))).version, "0.9.13");

  now += 10;
  options.fetchRecord = async () => {
    fetches += 1;
    throw new adapter.NetworkError("offline fixture");
  };
  const offline = await adapter.resolveApplication(options);
  assert.equal(offline.offline, true);
  assert.equal(offline.record.version, "0.9.13");
  assert.equal(downloads, 1);

  now += 10;
  selected = record("0.9.14", 620, Buffer.from("new archive"));
  options.fetchRecord = async () => {
    fetches += 1;
    return { record: selected, raw: encoded(selected) };
  };
  const updated = await adapter.resolveApplication(options);
  assert.equal(updated.record.version, "0.9.14");
  assert.equal(downloads, 2);
  assert.deepEqual(fs.readdirSync(path.join(cacheRoot, "versions")).sort(), ["0.9.13", "0.9.14"]);
  assert.ok(fetches >= 3);
});

test("failed acquisition leaves no promoted version or interrupted work", async (t) => {
  const home = temporaryHome(t);
  const selected = record();
  const cacheRoot = adapter.defaultCacheRoot(home);
  await assert.rejects(
    adapter.resolveApplication({
      homeDirectory: home,
      cacheRoot,
      platform: "darwin",
      architecture: "arm64",
      systemVersion: "15.0",
      progress: false,
      fetchRecord: async () => ({ record: selected, raw: encoded(selected) }),
      downloadArchive: async (_release, destination) => {
        fs.writeFileSync(destination, "partial", { flag: "wx", mode: 0o600 });
        throw new adapter.NetworkError("interrupted fixture");
      },
      verifyApplication: () => assert.fail("verification must not run")
    }),
    /interrupted fixture/
  );
  assert.deepEqual(fs.readdirSync(path.join(cacheRoot, "versions")), []);
  assert.equal(fs.existsSync(path.join(cacheRoot, "current.json")), false);
  assert.equal(fs.readdirSync(cacheRoot).some((name) => name.startsWith(".work-")), false);
});

test("foreign cache paths are refused without changing their bytes", async (t) => {
  const home = temporaryHome(t);
  const cache = adapter.prepareCache({ homeDirectory: home, cacheRoot: adapter.defaultCacheRoot(home) });
  const foreign = path.join(cache.versions, "0.9.13");
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, "keep.txt"), "foreign");
  const selected = record();
  await assert.rejects(
    adapter.resolveApplication({
      homeDirectory: home,
      cacheRoot: cache.root,
      platform: "darwin",
      architecture: "arm64",
      systemVersion: "15.0",
      progress: false,
      fetchRecord: async () => ({ record: selected, raw: encoded(selected) })
    }),
    /refusing to replace an unowned/
  );
  assert.equal(fs.readFileSync(path.join(foreign, "keep.txt"), "utf8"), "foreign");
});

test("native arguments stay byte-for-byte ordered and its exit status is preserved", (t) => {
  const home = temporaryHome(t);
  const helper = path.join(home, "helper.js");
  const capture = path.join(home, "arguments.json");
  fs.writeFileSync(
    helper,
    "#!/usr/bin/env node\n" +
      "require('node:fs').writeFileSync(process.env.MARDO_TEST_CAPTURE," +
      "JSON.stringify(process.argv.slice(2)));process.exit(65);\n",
    { mode: 0o700 }
  );
  const previous = process.env.MARDO_TEST_CAPTURE;
  process.env.MARDO_TEST_CAPTURE = capture;
  t.after(() => {
    if (previous === undefined) delete process.env.MARDO_TEST_CAPTURE;
    else process.env.MARDO_TEST_CAPTURE = previous;
  });
  const arguments_ = ["path with spaces/document.md", "--", "promised destination"];
  assert.equal(adapter.runNativeHelper(helper, arguments_), 65);
  assert.deepEqual(JSON.parse(fs.readFileSync(capture, "utf8")), arguments_);
});

test("package metadata has one command, no runtime dependency, and no install hook", () => {
  const packageJSON = require("../package.json");
  assert.equal(packageJSON.name, "mardo");
  assert.deepEqual(packageJSON.bin, { mardo: "bin/mardo.js" });
  assert.deepEqual(packageJSON.os, ["darwin"]);
  assert.equal(packageJSON.license, "UNLICENSED");
  assert.equal(packageJSON.dependencies, undefined);
  for (const name of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.equal(packageJSON.scripts[name], undefined);
  }
});
