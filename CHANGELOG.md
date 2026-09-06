# Mardo release notes

## 0.9.16 — public beta

Mardo now offers a precise AI handoff through the bundled mardo command and
the current local MCP protocol. One-file forms can reveal an exact line,
range, heading, or literal occurrence, and the app acknowledges completion
when an AI-driven open request waits for the document to close.

Settings now includes interface-size controls, and the title bar, toolbar,
format controls, theme checkmarks, numbered lists, and new-document startup
have received focused polish and correctness fixes. The editor's task-list
viewport no longer jumps while checkbox state changes.

This beta also includes the Mardo icon laboratory and refreshed documentation
for AI setup, product behavior, architecture, and the prioritized future
backlog. The public distribution command remains `mardo`; no `md` alias is
included.

Download the exact signed and notarized release from
[mardo.app](https://mardo.flooflogic.com/releases/Mardo-0.9.16.zip).

## 0.9.15 — public beta

Finder Quick Look now loads remote images through the same bounded,
cookie-free policy as the app while presenting Markdown immediately instead
of waiting for downloads. Remote images work by default, can be disabled
globally in Settings, and retry cleanly when a preview is reopened after a
transient failure. Finder thumbnails remain network-silent.

Mardo now takes ownership of its exact Quick Look and thumbnail extensions on
every launch, clearing stale registrations and refreshing Finder's document
icons. An automatic update no longer rolls back a valid app when macOS briefly
delays extension registration; the launched app completes the handoff.

Callout icons are now vertically centered with their titles in the editor and
exported PDF.

Download the exact signed and notarized release from
[mardo.app](https://mardo.flooflogic.com/releases/Mardo-0.9.15.zip).

## 0.9.14 — public beta

Pasting rich Gmail threads now preserves intended blank lines without stray
backslashes, and Unicode remains intact alongside HTML entities.

Rendered task lists now have compact, rounded, vertically centered checkboxes.
In Rendered Edit they check and uncheck without moving the caret or selection,
and complete-row selection includes the concealed task prefix.

Ordinary table cells now reflow as zoom changes so later columns remain visible
when the table can fit. Mardo's themes, toolbar, headings, code, tables, and
Appearance preview also receive the accepted visual-hierarchy refinements.

Download the exact signed and notarized release from
[mardo.app](https://mardo.flooflogic.com/releases/Mardo-0.9.14.zip).

## 0.9.13 — public beta

Mardo now ships its bundled command-line opener as `mardo`. It opens Markdown
paths in the native app while preserving the existing bounded batch validation,
running-app reuse, and first-save behavior. The former Mardo-owned `md` command
is retired; Markdown's `.md` filename extension is unchanged.

Appearance settings now include Core Text font smoothing. It is available as
an explicit preference and is disabled by default.

Download the exact signed and notarized release from
[mardo.app](https://mardo.flooflogic.com/releases/Mardo-0.9.13.zip).

## 0.9.12 — public beta

Rendered editing is more predictable: Terminal pastes retain their physical
lines and bullets, Return before a nested list keeps every authored line
visible, and newly typed Bold, Italic, and Precise closing markers stay visible
until the formatting is committed. The Format menu now correctly says Edit or
Done for the transition it will perform.

List editing, Precise deletion, rendered-link edges, Open Recent ownership, and
standard Mac shortcuts received a broader reliability pass. Command-0 now
returns to Actual Size, and HTML publishing resolves tools through the normal
login-shell PATH.

Paid copies now receive a personal Your Copy ceremony and permanent bookplate
using the authenticated license name and date.

Large-document seeking, searching, and distant scrollbar jumps now avoid
whole-document work and keep their parsing and memory use bounded.

Download the exact release from
[mardo.app](https://downloads.flooflogic.com/mardo/0.9.12/Mardo-0.9.12.zip).
