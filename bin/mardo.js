#!/usr/bin/env node
"use strict";

const { runCLI } = require("../lib/adapter.js");

runCLI(process.argv.slice(2)).then(
  (status) => {
    process.exitCode = status;
  },
  (error) => {
    const message = error instanceof Error ? error.message : "unexpected adapter failure";
    process.stderr.write(`mardo: ${message}\n`);
    process.exitCode = 74;
  }
);
