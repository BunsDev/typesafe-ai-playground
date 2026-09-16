# Contributing

This is a community example library. Useful small contributions include a new
scenario, a better question, a confusing result with reproducible synthetic
input, or a usability fix.

## Add an example

1. Fork the repository and create a branch.
2. Add a case to the relevant pack in `web/catalog.json`, or add a new pack.
3. Include a unique ID, a clear title, a short description, synthetic state,
   and a concrete `tryThis` variation. Reuse the pack's questions or provide
   a `questions` override when the scenario needs different judgments. Pick a
   collection: Use cases, Fun & games, Dilemmas & debates, Model challenges,
   or a clearly named new collection.
4. Run the checks below and try the example in the browser.
5. Open a pull request explaining what the example tests and why it is useful.

The README documents the catalog fields and all three question types. The
browser's Export library produces a portable format with fully expanded
questions under a top-level `examples` array. The repository groups examples
under `packs`; place exported entries in the appropriate pack rather than
replacing the whole catalog with the portable format.

## What makes a useful example?

- A practical decision, playful scenario, or focused challenge with a clear scope.
- Enough context to answer, or deliberately missing information to test uncertainty.
- Narrow questions, named choices, and ordered score criteria.
- A contrast case or a specific modification someone can try.
- No real customer data, credentials, or private logs.

For bias comparisons, change one declared field and hold the operational facts
constant. Explain the intended invariant. Do not describe one model run as
proof of fairness or discrimination.

For a puzzle, include `test.kind: "puzzle"`, explanatory `test.note`, and
reference-choice maps `expectedA` / `expectedB` for the original variants.
Check arithmetic, logic, and assumptions independently. For an open-ended
dilemma or preference use `test.kind: "judgment"` with no answer key. For
equivalent wording or irrelevant pressure use `test.kind: "consistency"` and
explain what should remain unchanged. See the README for the full metadata
format. These are revealable teaching notes, not an automatic grading system.

Use original synthetic wording. Link primary background sources where useful;
do not copy benchmark datasets or claim that an adaptation reproduces a
published benchmark. Keep instruction traps harmless and confined to choosing
the wrong answer—never include real secrets or operational attack steps.

Keep IDs stable once published so browser drafts continue to map to the same
examples. Additions should not require changing UI code.

## Checks

```sh
python3 -m unittest discover -s tests -v
python3 -m py_compile server.py run.py
node --test tests/test_catalog.js
node --check web/app.js
node --check web/library.js
```

These checks are offline. Never add an API key to CI or make shared-key calls
from an automated test.

For UI changes, check collection/category filtering, revealable test notes,
Text/JSON input modes, preserving edits when
switching examples, saving/reloading a custom example, and a 1280×720 desktop
viewport. Input, questions, example list and results should scroll within
their panels. At 390×844 and 320×568, check Browse → Build → Results, the
collection filter, question/test-note dialogs, touch targets, and absence of
horizontal overflow. The mobile UI shows one stage at a time; long content
uses document scrolling. Check both successful and failed runs reaching Results.

## Report an issue

Include the example ID, the relevant synthetic input, expected behavior,
observed behavior, and the returned model when relevant. Redact credentials
and private data. Run exports contain inputs and outputs, so inspect them
before attaching them.

Contributions are licensed under the repository's MIT license.
