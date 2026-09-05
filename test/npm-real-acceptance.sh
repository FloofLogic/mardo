#!/bin/bash
set -euo pipefail

if [[ $(uname -s) != Darwin ]]; then
    printf 'npm acceptance: SKIP — Mardo requires macOS\n'
    exit 0
fi

repo=$(cd "$(dirname "$0")/.." && pwd -P)
scratch=$(mktemp -d "${TMPDIR:-/tmp}/mardo-npm-acceptance.XXXXXX")
scratch=$(cd "$scratch" && pwd -P)
test_home="$scratch/home"
mkdir -p "$test_home" "$scratch/local" "$scratch/global" "$scratch/foreign/bin"
test_home=$(cd "$test_home" && pwd -P)
tarball=
test_app=
test_pid=

cleanup() {
    if [[ $test_pid =~ ^[0-9]+$ && -n $test_app ]] && /bin/kill -0 "$test_pid" 2>/dev/null; then
        running_command=$(/bin/ps -p "$test_pid" -o command= 2>/dev/null || true)
        if [[ $running_command == "$test_app" ]]; then
            /bin/kill -TERM "$test_pid" 2>/dev/null || true
        fi
    fi
    if [[ -n $tarball && $tarball == "$repo"/* ]]; then
        rm -f "$tarball"
    fi
    rm -rf "$scratch"
}
trap cleanup EXIT

fail() {
    printf 'npm acceptance: FAIL: %s\n' "$1" >&2
    exit 1
}

tarball_json=$(cd "$repo" && npm pack --json --ignore-scripts)
tarball_name=$(printf '%s' "$tarball_json" | node -e \
    'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.parse(s)[0].filename))')
tarball="$repo/$tarball_name"

node_path=$(command -v node)
test_path="$(dirname "$node_path"):/usr/bin:/bin:/usr/sbin:/sbin"
cache="$test_home/Library/Application Support/Floof Logic/Mardo/npm"

(
    cd "$scratch/local"
    HOME="$test_home" PATH="$test_path" npm install --ignore-scripts --no-audit --no-fund "$tarball"
)
[[ ! -e "$cache" ]] || fail "npm install downloaded or created application state"
[[ ! -e "$scratch/local/node_modules/.bin/md" ]] || fail "local install exposed retired command"

version=$(HOME="$test_home" PATH="$test_path:$scratch/local/node_modules/.bin" \
    "$scratch/local/node_modules/.bin/mardo" --version)
[[ $version == "mardo 0.9.14" ]] || fail "local command reported $version"
[[ -x "$cache/versions/0.9.14/Mardo.app/Contents/Helpers/mardo" ]] ||
    fail "local command did not acquire its own verified app"
[[ ! -e "$cache/versions/0.9.14/Mardo.app/Contents/Helpers/md" ]] ||
    fail "acquired app contains retired command"

npx_version=$(cd "$scratch/local" && HOME="$test_home" PATH="$test_path" \
    npx --no-install mardo --version)
[[ $npx_version == "mardo 0.9.14" ]] || fail "npx command reported $npx_version"

printf 'foreign command\n' > "$scratch/foreign/bin/mardo"
chmod 755 "$scratch/foreign/bin/mardo"
foreign_hash=$(shasum -a 256 "$scratch/foreign/bin/mardo" | awk '{print $1}')
if HOME="$test_home" PATH="$test_path" npm install -g --ignore-scripts --no-audit --no-fund \
    --prefix "$scratch/foreign" "$tarball" > "$scratch/foreign-install.log" 2>&1; then
    fail "global npm install replaced a foreign mardo command"
fi
[[ $(shasum -a 256 "$scratch/foreign/bin/mardo" | awk '{print $1}') == "$foreign_hash" ]] ||
    fail "foreign mardo command bytes changed"

HOME="$test_home" PATH="$test_path" npm install -g --ignore-scripts --no-audit --no-fund \
    --prefix "$scratch/global" "$tarball"
[[ ! -e "$scratch/global/bin/md" ]] || fail "global install exposed retired command"
global_version=$(HOME="$test_home" PATH="$test_path" "$scratch/global/bin/mardo" --version)
[[ $global_version == "mardo 0.9.14" ]] || fail "global command reported $global_version"

mkdir -p "$scratch/paths with spaces"
printf '# npm acceptance\n' > "$scratch/paths with spaces/existing.md"
if [[ ${MARDO_NPM_GUI_ACCEPTANCE:-0} == 1 ]]; then
    test_app="$cache/versions/0.9.14/Mardo.app/Contents/MacOS/Mardo"
    (cd "$scratch/local" && HOME="$test_home" PATH="$test_path" \
        npx --no-install mardo "$scratch/paths with spaces/existing.md")
    test_pid=$(pgrep -f "$test_app" | head -1 || true)
    [[ $test_pid =~ ^[0-9]+$ ]] || fail "npm-cached Mardo process was not running"
    [[ $(/bin/ps -p "$test_pid" -o command=) == "$test_app" ]] ||
        fail "npm-cached Mardo process identity changed"
    HOME="$test_home" PATH="$test_path" "$scratch/global/bin/mardo" \
        "$scratch/paths with spaces/promised"
    [[ ! -e "$scratch/paths with spaces/promised.md" ]] ||
        fail "promised missing document was created before Save"
    [[ $(pgrep -f "$test_app" | wc -l | tr -d ' ') == 1 ]] ||
        fail "path handoff did not reuse the running npm-cached app"
    if HOME="$test_home" PATH="$test_path" "$scratch/global/bin/mardo" \
        "$scratch/paths with spaces/existing.md" "$scratch" >/dev/null 2>&1; then
        fail "invalid batch was accepted"
    fi
    HOME="$test_home" PATH="$test_path" "$scratch/global/bin/mardo"
    [[ $(/bin/ps -p "$test_pid" -o command=) == "$test_app" ]] ||
        fail "refusing to stop a process outside the disposable npm cache"
    /bin/kill -TERM "$test_pid"
    for _ in {1..100}; do
        /bin/kill -0 "$test_pid" 2>/dev/null || break
        sleep 0.05
    done
    ! /bin/kill -0 "$test_pid" 2>/dev/null || fail "disposable Mardo process did not stop"
    test_pid=
fi

(
    cd "$scratch/local"
    HOME="$test_home" PATH="$test_path" npm uninstall --ignore-scripts --no-audit --no-fund mardo
)
[[ -d "$cache/versions/0.9.14/Mardo.app" ]] || fail "npm uninstall silently deleted app cache"

HOME="$test_home" PATH="$test_path" npm uninstall -g --ignore-scripts --no-audit --no-fund \
    --prefix "$scratch/global" mardo
[[ ! -e "$scratch/global/bin/mardo" && ! -L "$scratch/global/bin/mardo" ]] ||
    fail "global uninstall left its command"

printf 'unknown\n' > "$cache/keep.txt"
HOME="$test_home" PATH="$test_path" node "$repo/bin/mardo.js" --npm-cache-clean >/dev/null
[[ ! -d "$cache/versions/0.9.14" ]] || fail "explicit cache cleanup retained owned app"
[[ $(cat "$cache/keep.txt") == unknown ]] || fail "explicit cache cleanup changed unknown data"

printf 'Mardo npm real acceptance: PASS — local, npx, global, collision, uninstall, cleanup\n'
