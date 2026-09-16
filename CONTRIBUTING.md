# Contributing

This is a community example library. Useful small contributions include a new
scenario, a better question, a confusing result with reproducible synthetic
input, or a usability fix.

## Add an example

1. Fork the repository and create a branch.
2. Add a case to the relevant pack in `web/catalog.json`, or add a new pack.
3. Include a unique ID, a clear title, a short description, synthetic state,
   and a concrete `tryThis` variation. Reuse the pack's questions or provide
   a `questions` override when the scenario needs different judgments.
4. Run the checks below and try the example in the browser.
5. Open a pull request explaining what the example tests and why it is useful.

The README documents the catalog fields and all three question types. The
browser's Export library produces a portable format with fully expanded
questions under a top-level `examples` array. The repository groups examples
under `packs`; place exported entries in the appropriate pack rather than
replacing the whole catalog with the portable format.

## What makes a useful example?

- A realistic decision with a clear scope.
- Enough context to answer, or deliberately missing information to test uncertainty.
- Narrow questions, named choices, and ordered score criteria.
- A contrast case or a specific modification someone can try.
- No real customer data, credentials, or private logs.

For bias comparisons, change one declared field and hold the operational facts
constant. Explain the intended invariant. Do not describe one model run as
proof of fairness or discrimination.

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

For UI changes, check switching between categories, preserving edits when
switching examples, saving/reloading a custom example, and a 1280×720 desktop
viewport. Input, questions, example list and results should scroll within
their panels. Also check the stacked layout on a narrow screen.

## Report an issue

Include the example ID, the relevant synthetic input, expected behavior,
observed behavior, and the returned model when relevant. Redact credentials
and private data. Run exports contain inputs and outputs, so inspect them
before attaching them.

Contributions are licensed under the repository's MIT license.
