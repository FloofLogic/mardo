# Mardo npm delivery contract

Status: current for `mardo` 0.9.14.

## What installation does

`npm install mardo` installs a small, dependency-free JavaScript adapter and
the executable name `mardo`. The package has no install, postinstall, prepare,
or other lifecycle hook. Installation does not download Mardo, request
privilege, write outside npm's chosen package tree, change `/Applications`, or
create an `md` command.

Mardo requires macOS 14 or later and supports Apple silicon and Intel Macs.
Node.js 18.17 or later is required by the adapter.

## What the first command does

The first explicit invocation, including `mardo --version`, performs this
bounded operation:

1. Fetch at most 64 KiB from the canonical public release record at
   `https://downloads.flooflogic.com/mardo/release.json` without accepting a
   redirect.
2. Require public Mardo release identity, the Floof Logic Apple team
   `CC4EC596R5`, a Universal arm64/x86_64 build, and the canonical immutable
   `mardo.flooflogic.com` archive URL.
3. Stream the archive into private temporary storage, bounded to its declared
   byte size and 512 MiB, while computing SHA-256. Refuse extraction unless
   both the exact size and canonical digest match.
4. Extract exactly one top-level `Mardo.app`, bound its entry count and
   expanded byte size, reject escaping symbolic links, and verify the bundle
   identifier, version, build, minimum macOS version, architectures, bundled
   `mardo` helper, absence of the retired helper name, Developer ID signature,
   Apple team, Gatekeeper acceptance, and stapled notarization ticket.
5. Atomically promote the verified app into the user-owned cache and execute
   its native `Contents/Helpers/mardo` with the original arguments unchanged.

No product source, release signing key, npm credential, analytics, or
telemetry is present. HTTPS release truth supplies the version, build, size,
and hash; the npm source does not duplicate those mutable release facts.

## Cache, network, updates, and removal

The cache is:

```text
~/Library/Application Support/Floof Logic/Mardo/npm
```

It is a private, owner-marked directory. The adapter refuses symbolic,
foreign-owned, or unmarked cache roots and never replaces an unmarked version
directory. A complete version appears only after atomic promotion. Interrupted
owned work older than 24 hours is eligible for bounded cleanup. At most the
current and one previous owned app version are retained.

Canonical release truth is refreshed after six hours. If that request is
temporarily unreachable, a previously cached app is usable only after its
metadata and code signature verify again. An invalid online record, size or
digest mismatch, bad signature, wrong Apple identity, or failed notarization
check is never hidden by an older cached app.

`npm uninstall mardo` removes the npm package and its command link but runs no
cleanup script and intentionally leaves the verified app cache, just as it
leaves ordinary user state. After quitting Mardo, a person can remove only the
adapter-owned cached applications with:

```sh
mardo --npm-cache-clean
```

That command preserves unknown entries. `mardo --npm-cache-path` prints the
cache location without creating it.

## Stable failures

Adapter failures are a single `mardo:` line on standard error and use the
native command's existing status families: 69 for unavailable platform,
network, identity, or verification; 73 for ownership/collision refusal; and
74 for transfer or filesystem integrity failure. Security-significant stable
messages include:

```text
mardo: cannot reach canonical release truth and no verified Mardo npm cache is available
mardo: Mardo archive size does not match canonical release truth
mardo: Mardo archive SHA-256 does not match canonical release truth
mardo: refusing to replace an unowned Mardo npm cache path: PATH
mardo: Mardo application has the wrong Apple team identity
```

After acquisition, help, version, path validation, no-argument launch,
running-app reuse, promised missing documents, and their exit statuses belong
to the same signed native `mardo` helper distributed by every other Mardo
channel.
