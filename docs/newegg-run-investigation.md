# Newegg run investigation — 2026-09-17

This investigates the supplied report generated at `2026-09-17T09:03:18.230Z`. It does not treat product titles or model output as instructions, and it does not substitute current market prices for the run's recorded evidence.

## Observed facts

The request was a $2,500 USD tower for 1440p gaming. `/api/pc-build` returned 33 candidates across all eight categories, no reported gaps, nine document reads, zero model calls, and `build: null`. The explicit error was `Parts retrieved. Set TEXT_MODEL_API_KEY on the server to choose a complete build.` No part was selected, so there is no selected-build total or utilization to recompute.

For an arithmetic feasibility check only, the cheapest recorded candidate in each category sums to **$2,188.84 (87.5536% of budget)**, leaving $311.16. This is not a recommendation or proof of compatibility:

| Category | Candidate | Recorded price | Supplied product URL |
| --- | --- | ---: | --- |
| GPU | P1 | $759.99 | [XFX Swift RX 9070 XT](https://www.newegg.com/xfx-swift-rx-97tswf3b9-radeon-rx-9070-xt-16gb-graphics-card-triple-fans/p/N82E16814150900) |
| CPU | P9 | $469.00 | [Ryzen 7 9800X3D](https://www.newegg.com/amd-ryzen-7-9000-series-ryzen-7-9800x3d-granite-ridge-zen-5-socket-am5-desktop-cpu-processor/p/N82E16819113877) |
| Motherboard | P10 | $149.99 | [MSI PRO B850-S](https://www.newegg.com/msi-pro-atx-22-motherboards-amd-amd-b850-am5/p/N82E16813144727) |
| Memory | P14 | $409.99 | [Patriot Viper Venom 32GB](https://www.newegg.com/patriot-memory-viper-venom-32gb-2-x-16gb-ddr5-6000-pc5-48000-cas-latency-cl36-desktop-memory-matte-black/p/N82E16820225430) |
| Storage | P18 | $235.99 | [KingSpec 2TB](https://www.newegg.com/kingspec-2tb/p/0D9-000D-00151) |
| PSU | P22 | $69.99 | [darkFlash DG850](https://www.newegg.com/darkflash-atx-3-1-ready-pcie-5-1-ready-850-w-80-plus-gold-certified-power-supplies-black-df-dg-850-bk/p/N82E16817950002) |
| Case | P26 | $59.99 | [Rosewill RWGC1](https://www.newegg.com/rosewill-atx-mid-tower-abs-spcc-tempered-glass-case-black-rwgc1/p/N82E16811147400) |
| Cooler | P30 | $33.90 | [Montech NX600](https://www.newegg.com/montech-nx600-28mm-intel-lga115x-1200-1700-1851-and-amd-am4-am5/p/N82E16835988018) |

These are candidate URLs from the supplied report, not evidence that those product pages were read during that run. P10's shipping is unknown. Tax and shipping are excluded throughout.

## Cause and hypotheses

The source route explicitly returned before selection when `TEXT_MODEL_API_KEY` was missing. This explains zero model calls and `build: null`; there is no evidence of a Jev BLOCKED decision in this PC run. Flight requirements such as origin, destination, date, or one-way travel are irrelevant.

Whether every listing price represented the intended seller/offer, whether stock remained available, and whether the eight parts fit together are unresolved. The recorded prices alone do not prove a parser bug or good value. Those hypotheses need the source reads and product verification output.

## Missing evidence

The supplied JSON contains no document-read URLs/timestamps/hashes, exact selection request/response, selected IDs, or product-page checks. Its introductory prose describes traces that are absent from the evidence. Product URLs cannot substitute for missing document-read traces. No FPS measurements, BIOS/QVL evidence, clearance measurements, PSU connector checks, or exhaustive market comparison were supplied.

## Patch and regression

Remove the text-model gate. Read rendered Newegg pages in the local browser-use session, give Jev only observed candidate IDs, and enforce eight categories and the budget in code. Capture actual read traces and selection exchanges. Preserve source/compatibility gaps. When Jev billing or quota prevents selection, label a deterministic lowest-price baseline and retain the provider refusal; do not claim it is a Jev or performance-optimized selection.

Regression coverage: a mismatched flight goal returns 400 with zero reads; unknown candidate IDs fail; a model preference combination over budget yields a feasible eight-category combination; an impossible budget fails before calling the provider; HTTP 402 retains a null response and provider status while yielding an observed-price baseline; the next UI run skips the blocked provider. Desktop/mobile tests cover the local viewport, bottom composer, onboarding, and copyable diagnostics.
