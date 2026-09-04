# Mardo

Mardo is a native, file-first Markdown viewer and editor for macOS. This is its
public package, support, security, and issue-tracking repository. Mardo's
product source is private and is not published here.

## Download

Download the current signed and notarized Mardo release from
[mardo.app](https://downloads.flooflogic.com/mardo/latest/Mardo.zip). Mardo
requires macOS 14 Sonoma or later.

## Homebrew

Install the current release from the Floof Logic tap:

```sh
brew install --cask flooflogic/tap/mardo
mardo --version
mardo "notes.md"
```

The cask installs the same signed, notarized, Universal `Mardo.app` as the
direct download and exposes only the `mardo` command. The official bare
Homebrew command will be documented only after upstream acceptance.

## npm

Install the dependency-free macOS adapter in a project:

```sh
npm install mardo
npx mardo --version
npx mardo "notes.md"
```

Or install it in a user-owned global npm prefix to expose `mardo` directly.
The package runs no install-time download or lifecycle script. On its first
explicit invocation it reads Mardo's canonical public release record, verifies
the immutable archive's size and SHA-256, verifies the extracted app's
Developer ID identity and notarization, and then runs the same signed native
`mardo` helper used by Homebrew. It does not require Homebrew or an app already
installed in `/Applications`. See [NPM_CONTRACT.md](NPM_CONTRACT.md) for cache,
network, update, removal, and failure behavior.

## Support

- [Report a reproducible public bug](https://github.com/FloofLogic/mardo/issues/new/choose).
- Read [SUPPORT.md](SUPPORT.md) before sharing logs or document examples.
- Report security vulnerabilities only through the private route in
  [SECURITY.md](SECURITY.md).

Please do not attach private documents, license data, receipts, credentials, or
other sensitive material to a public issue. Purchase, license, and private-file
help belongs at [support@mardo.app](mailto:support@mardo.app).

## Repository scope

This repository contains reviewed public documentation and package adapters.
The Homebrew definition lives in
[`FloofLogic/homebrew-tap`](https://github.com/FloofLogic/homebrew-tap).
Neither public repository builds, signs, or modifies the private Mardo product.
