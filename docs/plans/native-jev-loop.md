# Native Jev browser loop: execution ledger

Objective: the seven requirements in the supplied BetterWrite comparison, with no external text/reasoning model. The comparison figures (2,400 output tokens / 12 actions; 1,500 / setup-style task) are user-reported targets, not independently reproduced BetterWrite results.

## Completion requirements

- [x] Delta protocol: one initial compressed page baseline, then additions/changes/removals only, with stable document and node identities. Navigation invalidates handles without resending prior page history.
- [x] Forward-only compression: bounded current-step action menus and changed text, constructed before each call. No historical DOM or tool-call replay. Report truncation and allow progress to other relevant controls.
- [x] Native batches: one Jev request chooses multiple independent actions; every action maps to a locally observed closed choice. Guard and stop the remainder when a dependency changes.
- [x] Self-contained text: exact supplied goal values/spans, selected in the same Jev request; no external text model, hidden calls, or code/selector generation.
- [x] Cheap execution checks: live node identity, structural revision, value/option state and hit testing. No full page re-read between actions in a batch.
- [x] Bounded pacing: prevent rapid repeated clicks; respect challenges and rate limits, report them instead of claiming bypass.
- [ ] Metrics and benchmark: retain each request/response and provider usage outside policy context, report tokens/action, requests/action, compression and latency. Run reproducible 12-action and account/configuration scenarios; unknown usage stays unknown. Distinguish scripted correctness from live Jev selection.
- [x] Integrate local browser execution into the app and document the protocol, limits, evidence, and reproducible benchmark commands.
- [ ] Verify complete requirements, commit, push and merge to main after required checks.

## Implementation plan

1. Pure protocol/types: stable observations, delta stream, relevance selection, closed batched command choices, exact local text values, measurements. Contract tests first.
2. DOM executor: reusable self-contained browser script with stable handles, mutation guard, cheap per-target checks, bounded pacing, and action batches.
3. Native orchestrator + local browser-use bridge + localhost API/UI. Preserve the existing research mode and unrelated work.
4. Synthetic browser benchmarks (PC components/configuration and account-style dry run), real Jev measurements where credentials permit, and adversarial batch/freshness tests.
5. Audit, docs, CI, review and merge.

## Baseline evidence (before implementation)

- Starting point: main ee8abb505c9ea964d3d9a1f809fa3a7df31c3647; existing browser loop resends full visible text/element table and ten recent actions each cycle.
- Existing `TYPE_TEXT` uses another Jev span request; existing speculative target heads execute only one action.
- Existing local browser-use bridge only navigates/reads Newegg pages; it cannot yet execute native commands.
- Existing freshness check rereads the element table for most operations.
- Earlier live provider attempt returned HTTP 402; current native benchmark usage and performance remain unverified.
- Worktree: isolated `feat/native-jev-loop`; unrelated clean-room work in the primary checkout is preserved.

## Requirement audit — 2026-09-17

Checks above describe protocol/executor implementation verified with scripted responses. Live Jev selection and token performance are still unverified; completion is not claimed.

| Requirement | Authoritative evidence | Status |
| --- | --- | --- |
| Delta-only state | `DeltaStream`; protocol tests for unchanged data, navigation and goal-ranked option compression; retained scripted exchanges | Implemented and tested offline |
| Forward-only compression | Bounded nodes/text/options, explicit truncation; loop test reaches field 29 after skipped windows; only previous compressed view retained by encoder | Implemented and tested offline |
| Batches | Closed per-field heads; independent input/select and checkbox execution; click barriers; dependent DOM updates reject remainder | Implemented; live Jev batch selection unverified |
| Jev-only execution | One transport request per decision; exact goal spans/supplied values; no text-model call or fallback policy in native mode | Implemented and tested offline |
| Structural checks | DOM tests cover changed field, document, option, form context, occlusion and stable target outside unrelated updates; mutation-region counters avoid full rereads | Implemented and tested offline |
| Pacing/cancellation | Repeated target waits, challenge early-stop, bounded waits; cancellation test observes SIGTERM while RPC remains pending; unacknowledged batches remain uncertain | Implemented and tested offline; no detection-bypass claim |
| Metrics and targets | Scripted PC: 12 actions / 5 decisions; profile: 10 / 5. Actual model calls = 0 in scripted mode; tokens = null. Live attempt: HTTP 402 before first action | Target measurement incomplete |
| App/docs | `/jev-browser-agent/native`, guide link, explicit synthetic/live context, copyable exact trace; tests for failure accounting, overflow and short-screen composer | Implemented and tested offline |
| Delivery | Isolated `feat/native-jev-loop`; main remains unchanged by this task | Checkpoint verified; draft PR and live benchmark pending |

## Verification receipts

- `pnpm test`: 200 TypeScript tests passed, plus the legacy JavaScript suite.
- `pnpm typecheck` and `pnpm build`: passed on the final DOM-region guard update.
- Production whole-app Playwright suite: 171 passed, 15 skipped. The subsequent DOM-context refinement passed all 20 desktop/mobile native executor tests.
- Production native UI suite: 6 passed, including 1920×1080, 1280×720, 390×844 and 320×568 bounds.
- `python3 -m unittest discover -s tests -v`: 26 passed; `python3 -m py_compile scripts/local-browser.py` passed.
- Observed red/green regression: unrelated promotion update initially rejected the batch on both viewports; region-aware guard now allows the stable form while still rejecting a changed form context.
- Visual inspection: dark 1920×1080 and light 390×844 screenshots; the subsequently corrected mobile source label and short-screen bounds are covered by the UI tests.
- Native runtime JS and Python bridge are present in the production route's file trace; no `.env` paths were included.

## Remaining work

1. Finish checkpoint verification, commit/push, and open a draft PR for CI.
2. Restore quota or update the local TypeSafe key (requested asynchronously); rerun both live benchmarks. Do not repeatedly retry HTTP 402 or treat scripted decisions as live measurement.
3. Inspect real Jev choices, provider token coverage and achieved outcomes against the original targets; fix any live-only failures.
4. Re-audit requirements, obtain terminal exact-commit CI, and merge main as already authorized.

## Local benchmark artifacts

- `/tmp/typesafe-native-scripted-verified.json` — SHA-256 `fb3a9457362f4f6f772e05fdcd3c75f45c0982d5af3b0fe802e62c0d898f28c6`.
- `/tmp/typesafe-native-live.json` — SHA-256 `a7ce27ae702ce980c1c8d9612aea2ea2642f9a9ccd31cac8b5b7586d7774de37`.
