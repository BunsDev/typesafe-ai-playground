# TypeSafe AI Playground

A community playground for **Jev**: run small classification experiments, route conversations, apply decision rules, extract document fields, and test memes.

**Shout-out to [@nickthompson480](https://github.com/nickthompson480) for the [original TypeSafe AI playground](https://github.com/nickthompson480/typesafe-ai-playground).** This fork builds on that project's example library and Python foundation with a Next.js interface and new interactive prototypes. This is an independent community project, not an official TypeSafe AI product.

[Open the live playground](https://typesafe-ai-playground.vercel.app) · [TypeSafe API documentation](https://docs.typesafe.ai/introduction/quickstart) · [Contributing](CONTRIBUTING.md)

![TypeSafe AI community playground: Small experiments. Clear decisions.](public/og.png)

## Run locally

Requires **Node.js 22 or newer**. A TypeSafe API key is needed for live Jev evaluations.

```sh
git clone https://github.com/BunsDev/typesafe-ai-playground.git
cd typesafe-ai-playground
npm ci
cp .env.example .env.local
# Edit .env.local and set TYPESAFE_API_KEY.
npm run dev
```

Open the address printed by Next.js, normally http://localhost:3000. To choose another port, use `npm run dev -- --port 3001`.

`TYPESAFE_API_KEY` is read only by the server. Do not prefix it with `NEXT_PUBLIC_`, hardcode it in a component, or commit `.env.local`. You can browse and edit examples without a key; Run buttons require one.

## Six workspaces

| Workspace | What it does |
| --- | --- |
| **Examples** `/` | 110 examples across 22 categories, including 41 A/B comparisons. Edit input and questions, run Jev, and inspect typed answers. |
| **Conversation lab** `/conversation` | Paste raw Discord or labeled chat, rank potential reply recipients, compare context, and evaluate conversation frames. |
| **Ask gate** `/gate` | Decide whether an incoming question needs a human, or whether the channel or the docs already answered it, with the exact line cited. |
| **Workflow chat** `/workflow` | Describe a case and apply editable decision rules. Missing evidence produces a follow-up question. |
| **Document extraction** `/extraction` | Find likely values locally, then ask Jev to select candidates or `null`, with probabilities and source evidence. |
| **Meme lab** `/memes` | Test humor style, audience fit, tone, and likely confusion using captions or reviewed text from an image URL. |

The interface uses charcoal surfaces, lavender accents, serif headlines, dark/light themes, and responsive panels. Desktop panels scroll independently; narrow screens stack content. Examples has a collapsible Results rail, which opens when a run begins. Mobile controls have larger touch targets, and reduced-motion preferences are respected.

### Examples

Search by name, filter by collection or category, or show only A/B comparisons. The library shows the matching count and a **Clear filters** action. On mobile, **Browse examples** expands the library without crowding the setup. Numbered setup sections guide you through the input and questions. Include questions directly from each row, then expand them to edit instructions. Edit the state as text or JSON. **Edit all questions as JSON** also lets you change types and candidate definitions. Apply those edits before running.

**Reset draft** restores the selected example and offers **Undo reset**. Setup validation explains missing questions or invalid input before a request is sent. The A/B preview shows the exact field and both values; a missing comparison field disables only the comparison. Click anywhere along the collapsed Results rail to open it, or use the keyboard.

**Run example** sends one request. **Compare A/B**, available on paired examples, sends two requests with a declared change to the input. The plus button creates a blank custom example. Drafts and custom examples are saved in browser storage for that origin. **Export library** and **Import** move them between browsers; imported ID collisions become copies. Results are not restored after refresh.

The catalog includes practical use cases, games, dilemmas, and model challenges. Puzzle reference notes are teaching aids; subjective judgments have no universal answer key. A single run or A/B difference is not an accuracy or fairness benchmark.

### Conversation lab

Paste Discord messages with names and timestamps, `Name: message` text, or plain text. Auto-detection preserves multiline messages; **Parsed messages** lets you inspect the result or override the format.

- **Who gets the reply?** evaluates each speaker's latest message using only preceding context. Requests run in batches of three. The highest score above your threshold wins; ties, no-reply outcomes, and incomplete runs remain explicit.
- **Compare context (A/B)** compares full context with the final message alone.
- **Evaluate final message** sends one full-context request.

Changing the reply threshold recomputes decisions locally. Optional expected-frame labels build session confusion matrices; changing the transcript or format clears the label. Exports include the run input, rows, threshold, and selected recipient. No messages are sent to Discord.

### Ask gate

A busy channel answers the same question repeatedly. The gate triages one incoming question, or a whole dump, against the recent conversation and any docs or FAQ text you paste.

Jev picks one of four outcomes — `already_answered`, `answerable_by_docs`, `needs_human`, `needs_more_context` — plus the single prior message or documentation line that justifies it. It never writes the answer: suggested replies are fixed templates that quote the cited evidence.

- **One question** gates a single message against the last 20 messages of context.
- **Batch** gates every question in a dump against only the messages above it, three requests at a time, and tallies how many could have been avoided by reading up.

`needs_human` is the fallback for everything the gate cannot stand behind: an unrecognized outcome, a missing confidence score, a match below the confidence slider, or a claim with nothing cited. When Jev picks `already_answered` but cites a documentation line — or the reverse — the gate reports the outcome its citation actually supports and shows both. Moving the confidence slider re-decides locally without new requests.

The seeded sample is a support channel where three questions repeat earlier answers, one is covered by the FAQ, one is genuinely new, and one is too vague to act on.

### Workflow chat

The starter playbook handles damaged deliveries: sender-caused damage, delivery damage, first buyer-caused incidents, and repeat buyer-caused incidents. Edit rules before starting a case. Jev must identify a supported rule before the UI recommends its configured action; otherwise it asks for more facts.

**Recommendations only:** this prototype does not refund customers, fine delivery services, resend items, or ban accounts. Start a new case to change the rules. Export a case to save its conversation.

### Document extraction

Paste raw document text and select `date`, `counterparty`, `amount`, or `document_type`. An invoice sample is included.

1. `extractCandidates(text)` uses lightweight rules to find exact source values.
2. `rankWithJev(field, candidates, text)` submits named candidates plus `null` as a closed set.
3. `runExtraction(text)` coordinates the selected fields, with up to three requests in parallel.

Results show the selected value, its Jev probability, confidence when returned, every candidate, and a source snippet. Evidence is copied from the document, not generated. Empty candidate sets return local `null` without an API call; failures are distinct from null selections. See [the extraction guide](docs/document-extraction.md) for limits and module details.

### Meme lab: text, images, and a meta meme

The starter **Meme lab meets itself** image jokes about this very interface: “I built a meme lab to validate my humor. The meme lab: insufficient evidence.” Download it from the preview or test its supplied captions. The pictured result is part of the joke, not an actual Jev verdict.

To test another image:

1. Paste a **public HTTPS image address**, then choose **Read image**.
2. Review and correct **Recognized image text**.
3. Add visual context and the intended audience, then choose **Test meme**.

The image loader accepts PNG, JPEG, WebP, and GIF files up to 4 MB and 20 megapixels. It follows at most three redirects, blocks private/reserved network addresses, pins the resolved connection, and normalizes images to a maximum of 2,000 pixels per side. Animated GIFs use the first frame.

English OCR runs in your browser using a lazily loaded Tesseract worker. It compares a standard pass with a contrast pass for outlined white lettering, rejects low-confidence fragments, and uses large vertical gaps to suggest setup and punchline. Identical captions in separate panels are preserved. Review both fields: OCR can confuse letters such as `I` and `l`, and the spatial split does not interpret the joke or handle every layout. Its runtime and language data load from Tesseract's configured public CDNs. If recognition fails or finds no caption, you can enter text and context manually. Loading an image does **not** call Jev.

**Jev evaluates the reviewed text and visual description, not image pixels.** URLs are not a substitute for visual context. The output is a closed-set humor/tone classification, possible confusion, and an estimated probability the joke lands. This is subjective feedback, not measured audience engagement or a promise of virality.

## Deploy to Vercel

```sh
vercel link
vercel env add TYPESAFE_API_KEY production --sensitive
# Supply the key at the prompt, not in command arguments.
vercel --prod
```

Vercel detects Next.js and runs `npm run build`. Set the same variable in Preview if you want live calls in preview deployments. The production URL is [typesafe-ai-playground.vercel.app](https://typesafe-ai-playground.vercel.app).

The shared-key demo must have request limits. Configure the Vercel Firewall rules documented in [deployment notes](docs/deployment.md) before exposing it publicly. Rate limits control request bursts; they are not authentication or a global spending cap. Use a restricted provider key and provider-side spending limits for your deployment.

The server validates requests, bounds payload sizes, and keeps credentials out of client responses. Runs send their supplied text to TypeSafe. Image URLs are fetched by the app server, then OCR runs in the browser. Exported files can contain your input, so review them before sharing.

## Development and checks

```sh
npm test                    # Pure contracts, extraction, and API tests
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e             # Mocked API calls; no TypeSafe credits used
python3 -m unittest discover -s tests -v
```

Browser coverage includes desktop/mobile flows, theme persistence, saved drafts, extraction, meme failures, workflow decisions, question triage and its human fallback, and responsive boundaries from 320px to 2560px, including short landscape screens. `npm start` runs the built production app.

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes, server API handlers, global styling, and social metadata |
| `components/` | Shared shell and React workspace interfaces |
| `lib/` | Request contracts, question triage, image fetching, OCR, and client utilities |
| `types/` | Shared closed-set contracts, including the triage outcomes |
| `src/extraction/` | Candidate extraction and Jev ranking |
| `web/catalog.json` | Shared example catalog |
| `web/library.js`, `web/conversation.js`, `web/workflow.js` | Tested logic shared with the legacy UI |
| `tests/` | Unit/API checks and Playwright browser tests |
| `public/og.png` | Open Graph and Twitter sharing image |
| `public/memes/` | Meta meme asset and editable SVG source |

## Legacy Python UI

The original static playground remains in `web/`. With Python 3.10+, run `python3 run.py` and enter your key at the hidden prompt. It serves port 8765 by default and reads an existing `TYPESAFE_API_KEY` environment variable, but does not load `.env` files. The new Meme lab and extraction workspaces require Next.js.

## Contribute and credits

Add synthetic scenarios to `web/catalog.json`, include stable IDs and clear questions, and run the checks above. See [CONTRIBUTING.md](CONTRIBUTING.md). Jev's `noul`, `choice`, and `score` outputs are typed decisions; a valid typed answer can still be wrong.

Thanks again to **[@nickthompson480](https://github.com/nickthompson480)** for sharing the [original playground](https://github.com/nickthompson480/typesafe-ai-playground), and to TypeSafe AI for Jev. This fork retains the [MIT license](LICENSE).
