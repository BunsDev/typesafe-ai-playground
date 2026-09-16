import type {
  RerankCandidate,
  RerankRequest,
  RankingRun,
} from "../types/rerank";
export function parseCandidates(raw: string): RerankCandidate[] {
  if (raw.length > 400000) throw Error("Keep the candidate list below 400 KB.");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw Error("Paste a JSON array of { id, text, vectorScore } objects.");
  }
  if (!Array.isArray(data) || data.length < 2 || data.length > 200)
    throw Error("Supply 2–200 candidates.");
  const seen = new Set<string>();
  return data.map((c) => {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id.trim() ||
      c.id.length > 200 ||
      seen.has(c.id)
    )
      throw Error(
        "Candidate IDs must be nonempty, unique, and at most 200 characters.",
      );
    if (typeof c.text !== "string" || !c.text.trim() || c.text.length > 1500)
      throw Error("Each snippet must contain 1–1,500 characters.");
    if (
      typeof c.vectorScore !== "number" ||
      !Number.isFinite(c.vectorScore) ||
      c.vectorScore < -1 ||
      c.vectorScore > 1
    )
      throw Error("Vector scores must be finite numbers from −1 to 1.");
    seen.add(c.id);
    return { id: c.id, text: c.text, vectorScore: c.vectorScore };
  });
}
export function validateRerankRequest(input: RerankRequest) {
  if (!input.query.trim() || input.query.length > 2000)
    throw Error("Use a query of 1–2,000 characters.");
  parseCandidates(JSON.stringify(input.candidates));
}
export function vectorRanking(candidates: RerankCandidate[]): RankingRun {
  const start = performance.now();
  const rows = [...candidates]
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .map((c) => ({ ...c, score: c.vectorScore, confidence: null }));
  return {
    method: "vector",
    candidates: rows,
    latencyMs: performance.now() - start,
    requests: 0,
  };
}
const files = [
  [
    "src/auth/session.ts",
    "verifySession validates the signed session cookie, expiry and authenticated user.",
  ],
  [
    "src/middleware/auth.ts",
    "requireAuth rejects requests without a valid authentication session.",
  ],
  [
    "src/auth/password.ts",
    "verifyPassword compares the supplied password against its stored hash during login.",
  ],
  [
    "src/routes/login.ts",
    "POST /login authenticates credentials and creates a session.",
  ],
  [
    "src/auth/oauth.ts",
    "validateCallback verifies OAuth state and exchanges the authorization code.",
  ],
  [
    "src/auth/tokens.ts",
    "verifyAccessToken validates JWT signature, issuer, audience and expiration.",
  ],
  [
    "src/permissions/policy.ts",
    "canEdit checks resource permissions after the user has authenticated.",
  ],
  [
    "tests/auth/login.test.ts",
    "Tests reject incorrect credentials and accept an authenticated session.",
  ],
  [
    "docs/authentication.md",
    "Authentication overview: requests pass through requireAuth and verifySession.",
  ],
  [
    "src/ui/LoginForm.tsx",
    "Renders email and password fields; submits credentials to /login.",
  ],
  ["src/billing/invoices.ts", "Creates invoices and records payment totals."],
  [
    "src/search/vector.ts",
    "Computes vector similarity and returns top search candidates.",
  ],
  [
    "src/ui/Button.tsx",
    "Reusable button styling, focus states and disabled behavior.",
  ],
  ["src/storage/cache.ts", "Reads cached records with a time-to-live."],
  [
    "src/email/templates.ts",
    "Renders welcome messages and notification templates.",
  ],
  ["src/jobs/cleanup.ts", "Removes expired temporary files each night."],
  [
    "src/metrics/counters.ts",
    "Tracks HTTP request counts and response duration.",
  ],
  ["src/config/theme.ts", "Defines dark and light color tokens."],
  ["src/catalog/products.ts", "Loads product names, inventory and pricing."],
  ["src/utils/dates.ts", "Formats dates and converts time zones."],
];
export function sampleCandidates(): RerankCandidate[] {
  // Synthetic sample-repository excerpts, not results fetched from a real index.
  return Array.from({ length: 200 }, (_, i) => {
    const [path, text] = files[i % files.length];
    const section = Math.floor(i / files.length) + 1;
    return {
      id: path + "#section-" + section,
      text: path + " — " + text + " Sample excerpt " + section + ".",
      vectorScore: Number((0.98 - ((i * 37) % 200) * 0.0035).toFixed(4)),
    };
  }).sort((a, b) => b.vectorScore - a.vectorScore);
}
