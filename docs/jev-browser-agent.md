# Jev-powered browser agent

Open `/jev-browser-agent` to run a browser agent with a dynamic, indexed action space against a synthetic flight-search site. The loop is a TypeScript port of [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast): one goal in, and each cycle Jev picks an operation and an element from an indexed element table in one request. A small LLM writes text only when the operation is `TYPE_TEXT`. No screenshots feed the policy. Nothing is fine-tuned.

## The loop

1. **Perceive.** `getElementTable(doc, win)` reads the sandbox document once: common HTML/ARIA controls, accessible names, current values, checked/expanded state, and the visible text. Each real node gets a code-owned numeric identity in a per-document cache. The snapshot also records a semantic marker, a form/viewport key, and a guard per target.
2. **Build the action space.** `buildActionSpace` groups candidates by operation: `CLICK`, `TYPE_TEXT`, `SELECT`, plus `SCROLL_UP`, `SCROLL_DOWN` and `WAIT` when they apply. `DONE` and `BLOCKED` are always offered. Native selects expose one `element:option` index per unselected option.
3. **Decide with one request.** `buildDecisionPayload` sends the element table, page text and the last ten actions as state, with the `operation` question and one target head (`click_target`, `type_text_target`, `select_target`) per available operation. `resolveDecision` validates the reply and consumes only the head matching the chosen operation. A head with a single candidate is resolved locally, because the API needs two candidates.
4. **Generate text only for TYPE_TEXT.** `requestFieldText` sends the goal, the field, the page text and recent actions to `/api/text-helper`. The reply must parse as exactly `{"text": "…"}` or `{"text": null}` before anything is typed. Without `TEXT_MODEL_API_KEY`, the lab asks Jev to pick a span of the goal instead and labels the helper `jev-span`.
5. **Validate before executing.** `isFresh` compares the form/viewport key and the target guard for clicks and selects, and the full marker for everything else. `resolveTarget` re-reads geometry and hit-tests the centre point. Detached, hidden, disabled, read-only, offscreen and covered targets are rejected with a reason, and the rejection is fed back as recent history.
6. **Execute, log, settle.** Execution is recorded before the next observation. Typing into a combobox waits for visible suggestions, capped at 200 ms; other interactions wait at most two animation frames or 50 ms. `WAIT` is 100 ms.
7. **Verify DONE independently.** `verifyFlightSearch` reads the sandbox DOM: one-way trip, resolved Zürich and London airports, the ISO date, one adult, economy, visible matching results, and no selected flight. A rejected `DONE` is logged and fed back; three rejections fail the run.
8. **Recheck BLOCKED.** A stale `BLOCKED` response is discarded. On a current page, the independent verifier checks for completion first. Otherwise, the loop records the unmet checks and asks Jev to decide once more from a fresh observation. A second consecutive `BLOCKED` stops the run. Speculative target answers never override the chosen operation.

Budgets: 40 actions and 80 decisions. Three consecutive actions that change nothing, four consecutive rejections, two consecutive fresh `BLOCKED` choices, or two consecutive model failures stop the run with a reason.

## The sandbox

The iframe hosts a fictional site, Skyline, written in plain HTML and JavaScript inside `lib/flightSandbox.ts`. It has a trip-type select, passenger and cabin selects, two autocomplete comboboxes whose suggestions arrive asynchronously, tolerant date fields, a return-date field that only appears for round trips, and results that load after a delay. Two switches exercise escalation paths:

- **Popover** — a dismissible tip covers the Search button. A click on it is rejected as covered by the named dialog, and the policy has to dismiss it.
- **Slow results** — results take about 2.6 s, so the policy has to `WAIT`.

Nothing is real: airports, airlines, prices and schedules are synthetic, and the Select buttons only mark a card as selected, which the verifier treats as a failure.

## Text helper configuration

```sh
TEXT_MODEL_API_KEY=            # OpenAI-compatible key, server-only
TEXT_MODEL_BASE_URL=https://openrouter.ai/api/v1
TEXT_MODEL=inception/mercury-2.5
TEXT_MODEL_REASONING=none      # or an effort level such as low
```

`GET /api/text-helper` reports whether a key is configured. `POST /api/text-helper` forwards `{ context }` with the fixed system prompt and returns the raw completion; the browser parses it. Same-origin and JSON checks match `/api/run`. Text-helper calls are not part of the Jev usage ledger.

## Logging and export

Every cycle records the element table Jev saw, the visible text, the chosen operation and target, operation and target confidence and probabilities, the discarded speculative heads, Jev latency, text-helper output and latency, and the executed outcome or rejection reason. **Export** downloads the goal, status, counters, verification, history and log as JSON.

## Limits

Matching the jev-ultrafast MVP: no shadow DOM, frames, canvas, uploads, pop-up tabs, nested scrolling or arbitrary keyboard widgets. The name algorithm covers labels, ARIA references and text, not the full accessible-name specification. The sandbox is the whole page, so the iframe's own scroll is the page scroll. One task on one synthetic site is a demonstration, not a benchmark; a valid operation can still be the wrong one, and the log says so.

Implementation: `types/browserAgent.ts`, `lib/getElementTable.ts`, `lib/actions.ts`, `lib/callJev.ts`, `lib/textHelper.ts`, `lib/validateTarget.ts`, `lib/agentLoop.ts`, `lib/logStep.ts`, `lib/flightSandbox.ts`, `app/api/text-helper/route.ts`. UI: `BrowserAgentLab` and `BrowserAgentGuide`.
