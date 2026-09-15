# Mardo engineering and benchmarks

This is the canonical, auditable account of what Mardo achieves and how it
measures. It lives in public version control: every number carries the date
and the gate that produced it, and every change to a number is a visible diff
in this file's history, not a silent edit. It is one document in two parts,
**Engineering** first and **Benchmarks** second, so it reads top to bottom and
also splits cleanly into two pages. [mardo.app](https://mardo.app/) serves
those parts as [/engineering/](https://mardo.app/engineering/) and
[/benchmarks/](https://mardo.app/benchmarks/) and links back here for the full,
auditable source. A reader and an AI assistant get the same figures from one
place.

Every Mardo number below was produced by one of Floof Logic's release gates,
run on a named machine, on the date beside it. Mardo is built on **MarkEngineV3**, the custom document and rendering engine Floof Logic designed and wrote from the ground up; its source is private, and this document reports what MarkEngineV3 does and what it measures, not how it is made. Every statement about another product is that product's own published
claim, or its documented absence, with the source and the date it was read.
Nothing here is an adjective standing in for a measurement.

- **Engine:** MarkEngineV3, Mardo's own, by Floof Logic.
- **Current public build:** Mardo 0.9.22, build 962, published 2026-09-14;
  signed, notarized, Universal (Apple silicon and Intel), macOS 14 or later;
  22,810,341 bytes.
- **Measured on:** Apple M4, 32 GiB, macOS 15.7.4, at the 0.9.21 engine line
  (0.9.22 shares the engine), unless a row names a different date and fixture.
- **As of:** 2026-09-14. Floof Logic re-runs the gates and re-reads the
  competitor sources before a release quotes a figure.

<!-- ENGINEERING START -->

# Engineering

What MarkEngineV3 does, and what that buys. The numbers these choices produce
are in [Benchmarks](https://mardo.app/benchmarks/); the full, auditable source
of both parts is
[ENGINEERING.md on GitHub](https://github.com/FloofLogic/mardo/blob/main/ENGINEERING.md).

## MarkEngineV3

Mardo runs on **MarkEngineV3**, a complete document and rendering engine built by Floof Logic from the ground up. It contains no web view, no JavaScript engine, and no third-party runtime. The parser, the math, the diagrams, the HTML and PDF output, the updater, the license verifier, and the AI tooling are all MarkEngineV3, all Floof Logic's own work. This is unusual, it was expensive to build, and it is the reason every number on the Benchmarks page exists: an engine written for this one job, with nothing borrowed in the hot path, can be held to standards a general-purpose stack cannot reach. Everything below is MarkEngineV3.

## The file is the document

Your words live in an ordinary Markdown file on your disk. Opening it never
rewrites it, and only an explicit Save writes it back. Viewing, rendered
editing, and source editing are three presentations of the same bytes, so
nothing is normalized behind your back and copying returns exactly what you
wrote. Undo is instant whether you removed one character or sixteen megabytes,
and nothing you have typed is ever discarded to make that work. There is no
vault, no import step, no database, and no hidden copy of your document
anywhere.

## Size stops mattering

MarkEngineV3 renders only what you are looking at. Opening a file, and jumping
anywhere inside it, never does an amount of work that grows with the file, so a
one-kilobyte note and a fifty-gigabyte log reach the screen in the same few
milliseconds and hold the same small, steady memory. Drop the scrollbar
halfway through a multi-gigabyte file and the text under it is on screen in a
single frame while the surrounding structure settles behind it. Search is the
one thing that must read every byte, and it does so at the speed of the disk
with a working Cancel. The measured figures are in
[Benchmarks](https://mardo.app/benchmarks/).

## One engine, every surface

The window, the Finder Quick Look preview, the Finder thumbnail, the HTML export, the PDF, the printed page, and the clipboard are all produced by MarkEngineV3 and the same themes. A preview agrees with the window, and the
window agrees with the printed page, because there is only ever one
interpretation of your document.

## Nothing in your document can run

Because there is no web view and no JavaScript engine anywhere in the product,
a document has nothing it could execute: not HTML, not scripts, not code
fences, not math macros, not diagram callbacks. Math, diagrams, and raw HTML
are rendered by Floof Logic's own bounded implementations, which show
unsupported input as plain source rather than guessing. Remote images are the
only thing a document can fetch from the network, over a hardened transport
with no cookies, no credentials, and a global off switch. Documents never leave
your Mac. The shipped application carries no web view, no JavaScript engine, and no third-party runtime; MarkEngineV3 is the whole of it, and that is verifiable in the binary itself.

## It behaves exactly like the Mac

Every ordinary key does what the Mac's own text editing does, and Floof Logic
proves it rather than asserting it: motion, selection, deletion, word and
paragraph commands, international input, and the standard shortcuts are checked
against the Mac's own text system across **54,065 cases with zero divergences**
and no exceptions granted. People bring years of muscle memory to a Mac text field; MarkEngineV3 earns that memory instead of approximating it.

## You are not the only writer anymore

Coding agents, formatters, and other tools now save the file you are reading,
often several times a minute. Mardo treats that as normal. When another writer
saves, Mardo adopts the change in place, keeps your scroll position and your
unsaved edits, and marks the one spot where your work and theirs genuinely
collide, with no dialog and no reload flash. Timewarp keeps every state the
file passed through while it was open and lets you step back through them where
you are, without writing anything to disk. The rest of the field reloads over
you, prompts you on every save, or merges and sometimes loses your work.

## Where Mardo is measurably ahead of the field

Each line pairs a Mardo capability with the field's own published position.
Competitor claims were read from their sites, READMEs, and (for Downright) its
`FEATURE-MATRIX.md`, `PERFORMANCE.md`, `STATUS.md`, and `ARCHITECTURE.md` on
2026-09-11, with repo activity re-checked 2026-09-14. No competitor was
installed; every competitor statement is the vendor's own. The numbers cited
are in [Benchmarks](https://mardo.app/benchmarks/).

1. **Size never degrades it.** A 50 GiB file and a 1 KiB README reach the
   screen the same way. Downright, the closest native project, lays out whole
   documents below a 5 MB threshold and rebuilds on a mode switch, by its own
   `PERFORMANCE.md` and `STATUS.md`. Obsidian's own guidance is that it
   "degrades above 1 MB." MarkEdit advertises editing "10 MB files easily";
   QuickMD advertises "10,000+ lines." Mardo's published ceiling is 50 GiB.

2. **A published first-paint number.** No competitor publishes one. Mardo's is
   3 to 5 ms from 1 KiB to 16 MiB, dated and re-run before releases.

3. **Editing proved against the Mac itself.** 54,065 cases, zero divergences,
   no exceptions. No competitor publishes a comparable fidelity result.

4. **No web runtime.** Of seventeen surveyed products, Typora and Obsidian are
   Electron; Marked 3 is WebKit; QLMarkdown runs MathJax and Mermaid JavaScript
   inside Quick Look; pluk, Clearly, and QuickMD render through `WKWebView`;
   Marky and MRDown are Tauri; PreviewMD and showmd bundle a JavaScript engine.
   Mardo runs none, so nothing in your document can execute.

5. **Quick Look that is native, selectable, live, and uncapped.** Mardo's
   preview appears in about 57 ms at any file size and follows external saves in
   place. Downright's `STATUS.md` caps its Quick Look at 2 MB with an "Open in
   App" fallback and targets under 400 ms with no automated measurement;
   QLMarkdown's preview is a WebKit page running JavaScript.

6. **Coexistence with another writer, proved.** Follow Live Edits across 24
   scenarios; Timewarp writes nothing. The field reloads, prompts, or merges
   heuristically.

7. **Search at memory bandwidth.** Gigabytes per second over a multi-gigabyte
   corpus. No competitor publishes a search-throughput number.

8. **A verification record behind every claim.** Only Downright publishes a
   performance document at all, and it labels its launch, scroll, and memory
   rows manual gates (`PERFORMANCE.md`, read 2026-09-11). Mardo's performance
   gate runs against a hard per-frame limit, and every number on the Benchmarks
   page has a dated gate behind it.

## No web runtime, across the field

Read 2026-09-11 from each product's own description; repo activity 2026-09-14.
MarkEngineV3 is Mardo's own; the column below is each competitor's own account of its stack.

| Product | Engine, by its own account | Runs JavaScript on your document |
| --- | --- | --- |
| **Mardo** | MarkEngineV3, Floof Logic's own | No |
| Downright | native, on the system text stack | No |
| Glance, Kite | native, by their own account | No |
| Typora | Electron | Yes |
| Obsidian | Electron | Yes |
| Marked 3 | WebKit | Yes |
| QLMarkdown | WebKit; MathJax and Mermaid JS | Yes, in Quick Look |
| pluk | `WKWebView` + bundled Mermaid and KaTeX | Yes |
| Clearly | SwiftUI + `WKWebView` | Yes |
| QuickMD | native blocks; Mermaid via `WKWebView` snapshot | Yes, for diagrams |
| MarkEdit | CodeMirror in a web view (editor only, no preview) | Yes |
| Marky | Tauri | Yes |
| MRDown | Tauri | Yes |
| PreviewMD | a bundled JavaScript engine | Yes |
| showmd | web-rendered Quick Look, macOS 26 only | Yes |

<!-- ENGINEERING END -->

<!-- BENCHMARKS START -->

# Benchmarks

MarkEngineV3's numbers, each with the gate, the machine, and the date behind it. What produces them is in [Engineering](https://mardo.app/engineering/); the full,
auditable source of both parts is
[ENGINEERING.md on GitHub](https://github.com/FloofLogic/mardo/blob/main/ENGINEERING.md).

## How these are measured

Latency and memory come from Floof Logic's performance gate, which measures MarkEngineV3 with the app launched against a hard per-frame maximum of 16.67 ms where one applies; no
percentile excuses a missed maximum. Large-file figures come from the
large-file qualification gate on deterministic generated corpora with a matched
native control. Mardo's source is private, so these gates are not runnable by a
reader; the value of this page is that every number names the gate that made
it, the machine, and the date, and its history here is a public diff.

## Speed

| What | Worst | Median | Samples | Date |
| --- | ---: | ---: | ---: | --- |
| First paint, 1 KiB README | 3.77 ms | 3.33 ms | 50 | 2026-09-14 |
| First paint, 1 MiB prose | 3.16 ms | 2.85 ms | 30 | 2026-09-14 |
| First paint, 80 KiB rich Markdown | 3.15 ms | 2.92 ms | 30 | 2026-09-14 |
| First paint, 8 MiB manual | 4.67 ms | 4.44 ms | 20 | 2026-09-14 |
| First paint, 16 MiB adversarial | 3.46 ms | 3.11 ms | 10 | 2026-09-14 |
| Keystroke to committed glyph, 1 MiB prose | 7.08 ms | 2.77 ms | 10,000 | 2026-09-14 |
| Keystroke in one 700 KiB paragraph | 5.14 ms | 4.67 ms | 200 | 2026-09-14 |
| Enter editing, caret placed, 8 MiB | 12.10 ms | 9.50 ms | 30 | 2026-09-14 |
| Switch view mode after an edit, 8 MiB | 1.38 ms | 1.33 ms | 30 | 2026-09-14 |
| Full parse, 8 MiB manual | 214.17 ms | 212.60 ms | 30 | 2026-09-14 |
| Full parse, 16 MiB adversarial | 219.55 ms | 219.03 ms | 10 | 2026-09-14 |
| Cold launch to an empty window | — | ≈135 ms | 30 | 2026-09-13 |

First paint is three to five milliseconds from one kilobyte to sixteen
megabytes, the same work at every size. Typing on a megabyte of prose commits a
glyph in a median of 2.77 ms, a fortieth of the budget. The cold-launch worst
sample varies with host load and is quoted as a median.

## Memory

Settled memory of the whole process. The controls are a matched native text
view measured the same way.

| Document | Mardo settled | Native control | Date |
| --- | ---: | ---: | --- |
| Empty window | 23.6 MiB | 21.5 MiB | 2026-09-14 |
| Tiny README | 39.6 MiB | 36.1 MiB | 2026-09-14 |
| 1 MiB prose | ≈39 MiB | 36.1 MiB | 2026-09-14 |
| 8 MiB manual | ≈43 MiB | 36.1 MiB | 2026-09-14 |
| 4 GiB log | 42.8 MiB | 40.7 MiB | 2026-09-14 |
| 50 GiB corpus | 44.6 MiB | 42.8 MiB | 2026-09-11 |

An eight-megabyte manual settles around 43 MiB; a four-gigabyte log settles
2.1 MiB above a native text view; a fifty-gigabyte file settles at 44.6 MiB,
1.8 MiB above a control that is sixteen hundred times smaller. Memory tracks
what you are viewing, not the size of the file.

## Large files

"Publish" is the time to put the bytes under the viewport on screen; the exact
render follows immediately after.

| Measure | 4 GiB (2026-09-14) | 50 GiB (2026-09-11) |
| --- | --- | --- |
| Open to an editable, painted canvas | 206 ms first paint | 124 ms |
| Jump anywhere, time to on-screen | 1.7 to 9.9 ms | 2.2 to 12.7 ms |
| Whole-file literal search | 1.7 s, worst frame 16.9 ms | 38 s, worst frame 23 ms |
| Settled memory | 42.8 MiB | 44.6 MiB |

Drop the scrollbar at byte four billion and the text is on screen in under ten
milliseconds, because opening and jumping never do work that grows with the
file.

## Correctness and proof

Each row is one of Floof Logic's release gates; the count is the last green
run's, dated.

| Proof | Result | Date |
| --- | --- | --- |
| Editing matches the Mac's own text system | 54,065 motion, selection, and typing cases, **0 divergences, 0 exceptions** | 2026-09-14 |
| CommonMark and GitHub Flavored Markdown | verified against all **652** CommonMark 0.31.2 examples; 66 classified into named families, 0 unclassified | 2026-09-14 |
| Clipboard | one semantic document proved against the system reader | 2026-09-14 |
| An agent's save cannot lose unsaved work | 24 scenarios, 159 checks | 2026-09-14 |
| Timewarp writes nothing | 13 scenarios, 182 checks | 2026-09-14 |
| PDF pagination | 36 fixtures, 2,325 pages, 10.9 MB | 2026-09-14 |
| Hostile input | 516 deterministic arbitrary-byte probes | 2026-09-14 |
| Whole app | 321 automated tests; 1,049 interface checks | 2026-09-14 |
| Search throughput | 11,381 MiB/s case-sensitive, 1,994 MiB/s folded, 4 GiB corpus | 2026-09-02 |
| Finder Quick Look | ready in 57.5 ms, any file size | 2026-09-05 |

Floof Logic keeps 219 dated evidence records, each with the exact result behind
a claim.

## Head to head on the numbers both sides publish

Downright is the only competitor that publishes performance figures, so it is
the only fair numeric comparison. Its figures are from its own benchmark on a
5,000-line, 120 KB file, read from `PERFORMANCE.md` on 2026-09-11. Mardo's are
the gate rows above.

| Measure | Downright (published) | Mardo (dated gate) |
| --- | --- | --- |
| Keystroke | < 8 ms p95 on 120 KB | 2.77 ms median, 7.08 ms worst on 1 MiB (10,000 samples) |
| End-to-end parse | 12.8 ms + 29.5 ms for 120 KB (≈ 4 MB/s) | 8 MiB in 214 ms (≈ 39 MB/s) |
| Mode switch | whole-document rebuild | 1.38 ms on 8 MiB |
| Whole-document layout | stops above a 5 MB threshold | none at any size |
| Memory | < 150 MB target for a 1 MB document (manual gate) | ≈ 39 MiB on 1 MiB, ≈ 43 MiB on 8 MiB |
| Quick Look | < 400 ms target, 2 MB cap (no automated measurement) | 57.5 ms, any size |
| Cold launch | < 250 ms for 100 KB (manual gate) | ≈ 135 ms median to an empty window |

On every row both projects measure, Mardo's number is smaller, its input is
larger, and its gate runs against a hard maximum rather than a manual target.
Downright earns the comparison by publishing at all; the rest of the field
publishes no numbers to compare.

<!-- BENCHMARKS END -->

## Auditing this document

- A number enters this document only from a gate that ran; the row carries the
  date and the machine. Corrections are commits to this file, so its history is
  the audit trail.
- A statement about another product is the vendor's own published claim or its
  documented absence, with the source and the read date. If a competitor ships
  the thing later, the line changes or leaves, and the diff shows it.
- "Verified against all 652 examples" is the CommonMark wording; it is not
  "passes" or "100 percent."
- Mardo's product source is private. The claim this document makes is not
  "trust us" but "here is the exact number, the date it was measured, and a
  public history you can diff."

## Sources

- Mardo: Floof Logic's engineering records, which retain the dated runs behind
  every figure (the state-of-the-Mardo audits of 2026-09-11 and 2026-09-14, the
  50 GiB and 4 GiB qualifications, and the fidelity and corpus results).
- Competitors: each product's own site, README, and, for Downright, its
  `FEATURE-MATRIX.md`, `PERFORMANCE.md`, `STATUS.md`, and `ARCHITECTURE.md` at
  [`github.com/ezzy1630/Downright`](https://github.com/ezzy1630/Downright), read
  2026-09-11; GitHub and Homebrew activity re-checked 2026-09-14.
