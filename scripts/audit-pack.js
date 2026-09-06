"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const packageJSON = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const expected = [
  "package/NPM_CONTRACT.md",
  "package/README.md",
  "package/bin/mardo.js",
  "package/lib/adapter.js",
  "package/package.json"
];
const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 1024 * 1024
});
if (result.status !== 0) {
  process.stderr.write(result.stderr || "npm pack --dry-run failed\n");
  process.exit(1);
}
const report = JSON.parse(result.stdout)[0];
const actual = report.files.map((entry) => `package/${entry.path}`).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`packed file allowlist mismatch: ${JSON.stringify(actual)}`);
}
if (report.name !== "mardo" || report.version !== packageJSON.version) {
  throw new Error(`packed identity is not mardo ${packageJSON.version}`);
}
if (report.entryCount !== expected.length || report.unpackedSize > 131_072) {
  throw new Error("packed adapter exceeds its file-count or expanded-size bound");
}

const forbiddenScripts = ["preinstall", "install", "postinstall", "prepare"];
for (const name of forbiddenScripts) {
  if (packageJSON.scripts && Object.hasOwn(packageJSON.scripts, name)) {
    throw new Error(`forbidden npm lifecycle script: ${name}`);
  }
}
if (packageJSON.dependencies || packageJSON.optionalDependencies || packageJSON.peerDependencies) {
  throw new Error("runtime dependencies are forbidden");
}
if (packageJSON.bin.mardo !== "bin/mardo.js" || Object.keys(packageJSON.bin).length !== 1) {
  throw new Error("package must expose exactly the mardo executable");
}
process.stdout.write(
  `Mardo npm pack audit: PASS — ${report.entryCount} files, ${report.unpackedSize} bytes\n`
);
