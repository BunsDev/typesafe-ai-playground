# TypeSafe AI Playground

A community playground for exploring [TypeSafe AI](https://typesafe.ai/) with practical use cases, party games, dilemmas, and reasoning challenges. Pick an example, inspect its input and questions, and run it through the API.

The library starts with **110 runnable examples in 22 categories**, including **41 A/B comparisons**. It is meant to grow through shared experiments and contributions. This is an independent community project, not an official TypeSafe product.

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

On a phone, the same flow becomes a three-stage workspace: **Browse → Build → Results**. The stage bar stays available while you work, and selecting an example or finishing a run moves you to the next useful stage.

![Phone-sized Browse stage showing the Fun & games collection and touch-sized controls](docs/screenshots/mobile.jpg)

The responsive layout is included; the server still listens only on the computer's loopback address. Opening it from a separate phone requires a separately secured access setup, which this project does not configure.

1. Choose a **Collection**, narrow it by category, or search the library.
2. Click an example. Its input and matching questions load together.
3. Edit the input, change a question, or uncheck questions you do not want to run.
4. Click **Run example**. One request evaluates all selected questions.
5. Read the answers beside the input. Export a run if you want to keep or share it.

Use **Input format → Text** for literal text, including bracketed dialogue or JSON-looking strings. **Auto** parses objects and arrays but keeps primitive-looking text such as `42` as text; malformed object/array syntax is flagged. **JSON** explicitly parses a JSON string, object, or array. **Format** pretty-prints valid JSON and selects JSON mode.

On games and challenges, **Test notes** reveals the purpose and any reference answers without spoiling the input. Notes are never sent to TypeSafe. They describe the original example; editing the input or questions can invalidate them. There is no automatic pass/fail grading.

Selecting examples does not call TypeSafe. Only **Run example** and **Run A/B** do. The A/B control makes two requests. Use the community key considerately; this tool has no automatic bulk runner.

Edits are saved per example in your browser. Switching away and back preserves them. **Reset example** restores that example's original input and questions. **Save as new example** creates a separate copy under **My examples**. **+ New** starts an example you can build yourself.

Browser storage is specific to the browser and address, including the port. It does not sync to other people. Use **Export library** to back up the library with your edits, and **Import JSON** to load it elsewhere. Importing creates copies when IDs collide.

Results stay available while the page is open; they are not restored after a reload. **Export run** saves the request, answers, model returned by the API, timing, and token usage. Exported data can include whatever you entered in the input, so review it before sharing.

## Workflow chat

Open **Workflow chat** to discuss a case against an editable decision tree. The starter workflow covers a damaged delivery: sender-caused damage, delivery-caused damage, and first or repeat buyer-caused damage. Expand any rule to change its condition or recommended action, or add a rule for another scenario.

Describe the incident in the composer. The assistant asks for missing cause, evidence, or incident history before recommending an action. Each message makes one TypeSafe request using the conversation and current rules. Recommendations require a recognized rule and a model-reported support probability of at least 80%; that threshold is a demo guard, not proof that the facts are true. Refunds, fines, resends, and bans are displayed only and never executed.

Use **Stop** to abort a pending browser request, **Export case** to save the conversation and decision snapshots, or **New case** to reset the chat. Rule edits affect subsequent messages. Cases and rule edits stay in memory for this page; export before leaving or refreshing. Conversations are bounded at 40 turns and 40,000 serialized characters, and each message at 8,000 characters. Starting a new case preserves the edited rules.

## Conversation lab

The workspace fills the window with independently scrolling panels. On narrow screens, use **Conversation** and **Results** to switch panels. Running an experiment reveals Results automatically.

Open **Conversation lab** in the header and paste a chat directly. Auto-detection supports Discord speaker/timestamp headers, `Name: message` lines, and plain text. The preview preserves multiline replies and shows each speaker, timestamp, and message. With no reliable speaker headers, plain text stays one message with an unknown speaker. Auto-detection of `Name: message` expects the first line to be a speaker header; choose that format explicitly if your paste starts with introductory text. Use **Paste format** to override an ambiguous detection. Parsing happens locally without API calls.

**Who gets the reply?** evaluates each speaker's latest message using the context preceding it. Later messages are excluded. It makes one request per speaker in parallel batches of three, with no eight-speaker cap. Progress reports completed batches. Each request has its own timeout; cancelling stops queued work and aborts browser requests. Successful results survive individual failures, but an incomplete contest cannot declare a winner. Retrying a run sends new requests for every candidate. The highest reply probability that meets your threshold wins. The result highlights the recipient and their message; ties, missing scores, and nobody meeting the threshold are shown explicitly. Scores are independent model judgments, not a normalized ranking or a measure of correctness.

Choose **Compare context (A/B)** to send two requests: A includes the full transcript; B includes only its final message block. Both use the same policy, model, and six frame definitions. **Evaluate final message** sends one full-context request.

Move the response threshold to recalculate decisions and the selected recipient locally without another API call. The gate simulates a decision; it does not connect to Discord or send messages.

For A/B and final-message modes, optionally choose an expected frame before running. The session evaluation counts valid labeled predictions separately for each variant and displays confusion matrices. Editing the transcript or paste format clears its expected label. Labels apply to both variants, and repeated runs count again. These exploratory results do not reproduce an external accuracy claim or establish benchmark performance.

Inputs and results stay in the current page only. **Export run** saves the parsed messages, policy, requests, responses, expected label, and current threshold decisions, including the selected recipient in contest mode. Review the export before sharing it.

## What's in the catalog?

Each category includes five scenarios with a description, synthetic input, a matching question set, and an idea for a variation. The **Collection** menu separates four ways to play:

| Collection | Examples | Try these first |
| --- | ---: | --- |
| Fun & games | 10 | Hot-dog court, emoji movies, zombie routes, dinner with an alien |
| Dilemmas & debates | 10 | Trolley lever, Ship of Theseus, an AI art contest, pause vs. rewind |
| Model challenges | 30 | Monty Hall, bat-and-ball, false beliefs, expert pressure, instruction traps |
| Use cases | 60 | Community replies, support tickets, invoices, agent review, matched bias checks |

The original practical categories remain available under **Use cases**:

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

The ten new categories are **Party games**, **Weird worlds**, **Moral dilemmas**, **Everyday debates**, **Probability games**, **Reasoning puzzles**, **Beliefs & perspectives**, **Framing & persuasion**, **Instruction traps**, and **Mysteries & uncertainty**.

Background links point to the [Moral Machine experiment](https://www.media.mit.edu/publications/the-moral-machine-experiment/), [Berkeley's Monty Hall explanation](https://www.stat.berkeley.edu/~stark/SticiGui/Text/montyHall.htm), [BIG-Bench Hard](https://github.com/suzgunmirac/BIG-Bench-Hard), and research on [false-belief tasks](https://arxiv.org/abs/2302.02083) and [sycophancy](https://arxiv.org/abs/2310.13548). These are original adaptations for typed questions, not official benchmark implementations or a way to reproduce those papers' scores.

![Monty Hall comparison with informed and uninformed host rules in the Model challenges collection](docs/screenshots/challenges.jpg)

The host's rules change the mathematical answer: switch in A, equal winning odds in B. This captured run gets B wrong by choosing “stay”; the Test notes explain the reference answer. A/B comparisons also cover relevant fact changes—not only changes that should leave the answer unchanged. One captured mistake is an example to investigate, not an aggregate accuracy score.

## Understanding the answers

- **Noul** returns a probability for a yes/no question.
- **Choice** picks from your named options and returns a probability distribution and confidence.
- **Score** rates an ordered list of levels and returns a score, legend, and confidence; available level probabilities are also shown.

Read [TypeSafe's quickstart](https://docs.typesafe.ai/introduction/quickstart) for the API contract. The default model is `jev-latest`; the results record the actual model reported by the API.

A valid typed answer is not necessarily correct. **Answer-key puzzles** have manually authored reference choices under stated assumptions. **Open-ended choices** have no right-answer key: disagreement about a trolley dilemma is not a model failure. **Consistency probes** test whether irrelevant pressure or equivalent wording changes an answer. Reference notes are not a validated benchmark or an accuracy report.

Choice probabilities describe the model's distribution over the offered answers. They are not automatically probabilities of events in the story: choosing “switch” in Monty Hall is different from estimating a 2/3 chance of winning.

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
3. Click **Save as new example** and give it a name, collection, category, and description.
4. Export the library to share your examples.

You can explore without writing code. Browser saves are local; they do not update the repository.

### In the repository

The shared catalog lives in [web/catalog.json](web/catalog.json). It is ordinary JSON with this structure:

```text
schemaVersion
packs[]
  id, title, description
  collection (optional, defaults to "Use cases")
  source (optional)
  questions[]
  examples[]
    id, title, description
    state
    tryThis
    questions (optional override)
    comparison (optional)
    test (optional notes and reference answers)
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

### Add games and reference notes

Set the pack's `collection` to `Fun & games`, `Dilemmas & debates`, or `Model challenges` (or give your own collection a name). A flat exported example keeps its collection too. Existing entries without a collection default to `Use cases`.

Add optional teaching notes to an example. This fragment belongs on a Choice question whose ID is `answer` and whose choices include `five` and `fifteen`:

```json
{
  "test": {
    "kind": "puzzle",
    "note": "The ball costs (total minus price difference) / 2. A gives 5 cents; B gives 15 cents.",
    "expectedA": { "answer": "five" },
    "expectedB": { "answer": "fifteen" }
  }
}
```

- `puzzle` needs an `expectedA` map and, when paired, an `expectedB` map. Use actual question IDs and exact Choice option keys. State all assumptions and check the answer independently.
- `judgment` is open-ended. Supply a note but **no expected-answer maps**; do not turn ethical or taste preferences into correctness labels.
- `consistency` explains the intended invariant, such as ignoring an irrelevant expert claim. Reference-choice maps are optional.
- `expectedB` requires a comparison. Notes and reference choices are display-only metadata, preserved by import/export but excluded from API requests.

The browser can view and preserve these notes; author or revise them in catalog/import JSON. If you save an edited copy, its inherited notes still refer to the original until you update them.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## Development

Python runs the local server using only its standard library. HTML, CSS, and JavaScript run directly in the browser. Node.js 20+ is only needed for the JavaScript validation tests.

```sh
python3 -m unittest discover -s tests -v
python3 -m py_compile server.py run.py
node --test tests/test_catalog.js tests/test_conversation.js tests/test_workflow.js
node --check web/app.js
node --check web/library.js
node --check web/theme.js
node --check web/conversation.js
node --check web/conversation-ui.js
node --check web/workflow.js
node --check web/workflow-ui.js
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
- Opt-in grading against reviewed puzzle keys, human labels, and accuracy reports (reference notes already exist).
- Batch runs with explicit request/token budgets and cancellation.
- Saved result history and comparisons across model versions.
- Named suites for demos, regressions, and domain-specific checks.
- More languages, accessibility cases, and community-contributed edge cases.
- Catalog versioning and a review process for contributed examples.
- A hosted multi-user version with individual credentials, authentication, and quotas.

Suggest a use case or improvement in [GitHub Issues](https://github.com/nickthompson480/typesafe-ai-playground/issues), or contribute an example through a pull request.

## License

[MIT](LICENSE). Contributions are welcome under the same license.
