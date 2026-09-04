# Mardo release notes

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
