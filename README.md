# TypeSafe AI Playground

A community playground for trying real use cases with [TypeSafe AI](https://typesafe.ai/). Pick an example, inspect its input and questions, and run it through the API.

The library starts with **60 runnable examples in 12 categories**. It is meant to grow through shared experiments and contributions. This is an independent community project, not an official TypeSafe product.

![TypeSafe AI Playground showing the example library, editable test input and questions, and live typed results in a three-panel dashboard](docs/screenshots/dashboard.jpg)

The dashboard at 1280×720, with a synthetic social-reply example and a real API response. Long sections scroll inside their panels.

## Start here

You need **Python 3.10 or newer**, a modern browser, and a TypeSafe API key to run evaluations. There are no packages to install and no frontend build step.

Community members can find the shared community API key in Discord after spending some time with the community. Ask there for the current key and usage expectations. You can also use your own TypeSafe key. No key is included in this repository.

```sh
git clone https://github.com/nickthompson480/typesafe-ai-playground.git
cd typesafe-ai-playground
python3 run.py
```

Paste the API key at the terminal prompt. Your typing is hidden. Then open the address printed by the server, normally [http://127.0.0.1:8765](http://127.0.0.1:8765).

On Windows, use `py -3 run.py` if `python3` is unavailable.

- Press Enter at the key prompt to browse and edit without making API calls.
- The key is kept in the running server process, not saved to a file or sent to the browser.
- If you already set `TYPESAFE_API_KEY` in your environment, the server uses it without prompting.
- If the port is busy, run `python3 run.py --port 8766`.
- Stop the server with Ctrl+C.

To start without a prompt:

```sh
python3 run.py --no-key-prompt
```

An existing environment key still works with that flag. The app does not automatically load `.env` files.

## Using the playground

The desktop layout has three panels so it works well for a Discord screen-share: **Examples → Test setup → Results**. The long sections scroll independently.

1. Search the library or choose a category.
2. Click an example. Its input and matching questions load together.
3. Edit the input, change a question, or uncheck questions you do not want to run.
4. Click **Run example**. One request evaluates all selected questions.
5. Read the answers beside the input. Export a run if you want to keep or share it.

Selecting examples does not call TypeSafe. Only **Run example** and **Run A/B** do. The A/B control makes two requests. Use the community key considerately; this tool has no automatic bulk runner.

Edits are saved per example in your browser. Switching away and back preserves them. **Reset example** restores that example's original input and questions. **Save as new example** creates a separate copy under **My examples**. **+ New** starts an example you can build yourself.

Browser storage is specific to the browser and address, including the port. It does not sync to other people. Use **Export library** to back up the library with your edits, and **Import JSON** to load it elsewhere. Importing creates copies when IDs collide.

Results stay available while the page is open; they are not restored after a reload. **Export run** saves the request, answers, model returned by the API, timing, and token usage. Exported data can include whatever you entered in the input, so review it before sharing.

## What's in the catalog?

Each category includes five scenarios with a description, synthetic input, a matching question set, and an idea for a variation.

| Category | Examples of what to test |
| --- | --- |
| Social & community | Genuine questions, corrections, sarcasm, promotions, disagreement |
| Customer support | Duplicate charges, login deadlines, missing refunds, cancellations |
| AI agent review | Unauthorized sends, false success, completed tasks, prompt injection |
| Security triage | Maintenance, VPN logins, forwarding rules, incomplete alerts |
| Invoices & expenses | Matching records, duplicate invoices, bank changes, partial deliveries |
| Orders & returns | Arrival damage, missing packages, late gifts, size exchanges |
| Sales & partnerships | Buyer intent, integrations, support requests, generic pitches |
| Product feedback | Bugs, requests, discoverability, praise, vague reports |
| Content & publishing | Unsupported numbers, source fidelity, jargon, opinions |
| Documents & admin | Quotes, meeting actions, handoffs, procedures, payment requests |
| Engineering & operations | Deploy regressions, flaky tests, maintenance, vague incidents |
| Bias & consistency | Matched policy decisions with one personal attribute changed |

Some categories take inspiration from [TypeSafe's workflow evals](https://evals.typesafe.ai/). The prompts and sample records here are original synthetic teaching examples, not a copy of that benchmark or its labels.

## Understanding the answers

- **Noul** returns a probability for a yes/no question.
- **Choice** picks from your named options and returns a probability distribution and confidence.
- **Score** rates an ordered list of levels and returns a score, legend, and confidence; available level probabilities are also shown.

Read [TypeSafe's quickstart](https://docs.typesafe.ai/introduction/quickstart) for the API contract. The default model is `jev-latest`; the results record the actual model reported by the API.

A valid typed answer is not necessarily correct. These examples are exploration material, not labeled accuracy tests.

### Matched bias checks

The **Bias & consistency** category contains five A/B examples. Each changes exactly one field, such as a name, pronouns, or age, while keeping the operational facts and policy identical.

**View B** shows the derived variant before running it. **Run A/B** displays both results and their differences. A probability difference is reported in percentage points, not relative percent.

One pair cannot establish bias or its absence. Repeated runs, multiple matched examples, relevant controls, and documented evaluation criteria are useful next steps.

![Matched A/B test showing the same refund request with different pronouns, side-by-side results, and probability differences](docs/screenshots/comparison.jpg)

An example A/B run. These captured results illustrate the interface, not a fairness finding or a guaranteed future response.

## Expand the catalog

### In the browser

1. Pick an example close to your idea, or click **+ New**.
2. Edit the input and questions.
3. Click **Save as new example** and give it a name, category, and description.
4. Export the library to share your examples.

You can explore without writing code. Browser saves are local; they do not update the repository.

### In the repository

The shared catalog lives in [web/catalog.json](web/catalog.json). It is ordinary JSON with this structure:

```text
schemaVersion
packs[]
  id, title, description
  source (optional)
  questions[]
  examples[]
    id, title, description
    state
    tryThis
    questions (optional override)
    comparison (optional)
```

Add a new entry to an existing pack's `examples` array. It inherits the pack's questions unless it supplies its own:

```json
{
  "id": "support-password-reset-loop",
  "title": "Password reset keeps looping",
  "description": "A calm customer cannot regain access before a deadline.",
  "state": {
    "message": "Each reset link sends me back to the login page. My presentation starts in 15 minutes.",
    "account": { "active": true },
    "attempts": 3
  },
  "tryThis": "Move the presentation to next month and compare urgency."
}
```

For a new category, add a pack with its own `id`, `title`, `description`, `questions`, and `examples`. Question definitions use a stable key and one of three types:

```json
[
  {
    "id": "needs_followup",
    "label": "Needs follow-up",
    "type": "noul",
    "instructions": "Does the message ask for an unresolved action?"
  },
  {
    "id": "route",
    "label": "Route",
    "type": "choice",
    "instructions": "Which team should review this message?",
    "criteria": {
      "support": "A current customer needs help.",
      "sales": "A potential customer is evaluating a purchase.",
      "clarify": "The purpose is unclear."
    }
  },
  {
    "id": "specificity",
    "label": "Specificity",
    "type": "score",
    "instructions": "How concrete is the request?",
    "criteria": ["Unclear", "Partly specified", "Clear and actionable"]
  }
]
```

Example IDs must be unique across the catalog. Question keys must be unique within an example. Choice questions need at least two named options; Score questions need at least two ordered levels. Examples can contain 1–100 questions.

To add a matched pair, include an existing field path and its replacement value:

```json
{
  "comparison": {
    "path": ["requester", "pronouns"],
    "value": "she/her",
    "labelA": "they/them",
    "labelB": "she/her"
  }
}
```

The example's `state.requester.pronouns` must already exist. The app copies the current state and replaces only that field. Reset local edits if you want an updated repository example to replace a saved draft.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## Development

Python runs the local server using only its standard library. HTML, CSS, and JavaScript run directly in the browser. Node.js 20+ is only needed for the JavaScript validation tests.

```sh
python3 -m unittest discover -s tests -v
python3 -m py_compile server.py run.py
node --test tests/test_catalog.js
node --check web/app.js
node --check web/library.js
```

The tests use synthetic data and mocked provider responses. No API key or paid calls are needed.

| File | Responsibility |
| --- | --- |
| `run.py` | Startup, hidden key prompt, port selection |
| `server.py` | Local static server, request validation, TypeSafe proxy |
| `web/catalog.json` | Shared use-case catalog |
| `web/library.js` | Catalog validation, payloads, import/export, comparisons |
| `web/app.js` | Example selection, local drafts, editor, results |
| `web/index.html`, `web/styles.css` | Three-panel dashboard |
| `tests/` | Offline API, HTTP, and catalog checks |

The server listens on loopback only and rejects cross-site browser requests. The browser sends requests to the local server; the server adds the API key and sends them to TypeSafe. It is a local tool, not a hosted multi-user service. Do not put a shared key in frontend code, screenshots, exports, issues, or commits.

## Future features to explore

These are ideas, not implemented features:

- Repeated runs and aggregate statistics for consistency and bias comparisons.
- Expected outcomes, human labels, and accuracy reports.
- Batch runs with explicit request/token budgets and cancellation.
- Saved result history and comparisons across model versions.
- Named suites for demos, regressions, and domain-specific checks.
- More languages, accessibility cases, and community-contributed edge cases.
- Catalog versioning and a review process for contributed examples.
- A hosted multi-user version with individual credentials, authentication, and quotas.

Suggest a use case or improvement in [GitHub Issues](https://github.com/nickthompson480/typesafe-ai-playground/issues), or contribute an example through a pull request.

## License

[MIT](LICENSE). Contributions are welcome under the same license.
