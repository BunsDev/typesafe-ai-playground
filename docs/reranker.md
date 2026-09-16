# Jev vector reranker

Open /reranker. The page compares the same supplied candidates in three columns: vector similarity, Jev relevance, and a deterministic lexical mock. No vector database is queried. The sample is a fictional repository with 200 synthetic code-search excerpts; top 100 is selected by default.

## Input

Paste a JSON array containing id, text, and vectorScore. IDs must be unique. Accepts 2–200 candidates, snippets up to 1,500 characters, and finite cosine-style scores from −1 to 1. The K control selects the highest-vector-score 20–200 entries, capped by the actual supplied list. The query is limited to 2,000 characters.

Use the existing server-only TYPESAFE_API_KEY in .env.local (see the main README). The browser calls /api/run; the key never enters the client bundle.

## Scoring and limits

rerankWithJev asks one closed-set question per candidate: irrelevant, tangential, relevant, direct, or unknown. Each request contains the original query and up to ten complete candidates. Three requests run concurrently. K=100 uses ten requests; K=200 uses twenty. No chunk splits a snippet.

Relevance is the expected ordinal value of the four known levels when a complete normalized probability distribution is available. Otherwise it is the selected level, from zero to one. Unknown probability contributes no positive relevance. Confidence is shown separately as the lower of model confidence and selected-label probability. Equal relevance uses vector similarity, then stable input order.

Invalid answers, unknown outcomes, and failed requests leave the corresponding candidates unscored. They appear last and withhold aggregate comparison metrics. Stop cancels in-flight requests and prevents queued batches from starting. Editing inputs clears previous comparisons.

## Baseline and metrics

rerankWithBaseline is an intentionally simple token-overlap mock. It has no learned model, external calls, or paid API cost. Replace this function with an actual cross-encoder adapter returning RankingRun to make a traditional-model comparison. Do not compare the mock's latency as if it were neural inference.

compareRankings checks complete identical candidate sets before computing top-min(10,K) overlap and Spearman-style correlation of displayed positions. These are agreement metrics, not accuracy. Ties are resolved by vector score and input order. There are no labeled relevance judgments or quality claims.

Candidates with a rank delta at least max(5, ceil(K × 0.2)) are highlighted for inspection. Clicking any file ID opens its full unchanged snippet and all three ranks.

Latencies use the browser's monotonic clock. Jev includes network and queue time; vector timing covers sorting only, not index retrieval. The optional per-request USD setting is a user assumption, multiplied by attempted Jev requests; it is not provider pricing or a billing receipt. Hosting and compute costs are excluded. The export preserves all rankings, snippets, scores, metrics, and cost assumptions.
