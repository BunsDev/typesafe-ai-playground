import { readBoundedBody } from "../../lib/api";
import { parsePullRequest } from "./parse";
export function parseGitHubPrUrl(value: string) {
  if (typeof value !== "string" || value.length > 2048)
    throw Error("Use a GitHub PR URL under 2,048 characters.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("Paste a public https://github.com/owner/repo/pull/123 URL.");
  }
  const match =
    /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)(?:\/(?:files|commits))?\/?$/.exec(
      url.pathname,
    );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    !match ||
    match[1].length > 100 ||
    match[2].length > 100
  )
    throw Error(
      "Use a public GitHub pull request URL. Other hosts and URL types are unsupported.",
    );
  return { owner: match[1], repo: match[2], number: match[3] };
}
export async function loadGitHubPullRequest(
  value: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const { owner, repo, number } = parseGitHubPrUrl(value);
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
  const deadline = AbortSignal.any([
    AbortSignal.timeout(20000),
    ...(signal ? [signal] : []),
  ]);
  async function read(url: string) {
    const response = await fetcher(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "TypeSafe-PR-Lab",
      },
      redirect: "error",
      cache: "no-store",
      signal: deadline,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(
        `GitHub returned HTTP ${response.status}. Use a public PR, wait if rate limited, or paste its diff.`,
      );
    }
    return JSON.parse(await readBoundedBody(response.body, 1024 * 1024));
  }
  const metadata = await read(endpoint);
  if (
    !metadata ||
    metadata.base?.repo?.private !== false ||
    typeof metadata.head?.sha !== "string" ||
    typeof metadata.base?.sha !== "string" ||
    !Number.isInteger(metadata.changed_files) ||
    metadata.changed_files < 1 ||
    metadata.changed_files > 100
  )
    throw Error(
      "Use a public PR with 1–100 changed files; larger PRs must be reviewed in smaller diffs.",
    );
  const files = await read(`${endpoint}/files?per_page=100`);
  if (!Array.isArray(files) || files.length !== metadata.changed_files)
    throw Error(
      "GitHub returned an incomplete file inventory. Paste the complete diff instead.",
    );
  const diff = files
    .map((file) => {
      if (
        typeof file.filename !== "string" ||
        /[\x00-\x1f]/.test(file.filename) ||
        (file.previous_filename !== undefined &&
          (typeof file.previous_filename !== "string" ||
            /[\x00-\x1f]/.test(file.previous_filename))) ||
        (file.patch !== undefined && typeof file.patch !== "string")
      )
        throw Error("GitHub returned an unsupported file record.");
      const previous = file.previous_filename || file.filename;
      const old = file.status === "added" ? "/dev/null" : `a/${previous}`;
      const next =
        file.status === "removed" ? "/dev/null" : `b/${file.filename}`;
      return `diff --git ${JSON.stringify(`a/${previous}`)} ${JSON.stringify(`b/${file.filename}`)}\n--- ${JSON.stringify(old)}\n+++ ${JSON.stringify(next)}\n${file.patch || "Patch unavailable; human review required."}\n`;
    })
    .join("");
  const latest = await read(endpoint);
  if (
    latest.head?.sha !== metadata.head.sha ||
    latest.base?.sha !== metadata.base.sha ||
    latest.changed_files !== metadata.changed_files
  )
    throw Error(
      "The PR changed while loading. Load it again before reviewing.",
    );
  if (
    typeof metadata.title !== "string" ||
    (metadata.body !== null && typeof metadata.body !== "string")
  )
    throw Error("GitHub returned invalid PR metadata.");
  const parsed = parsePullRequest({
    diff,
    title: metadata.title,
    description: metadata.body || "",
    url: `https://github.com/${owner}/${repo}/pull/${number}`,
    headSha: metadata.head.sha,
    baseSha: metadata.base.sha,
  });
  parsed.files.forEach((file, index) => {
    const original = files[index];
    const lines = file.hunks.flatMap((hunk) => hunk.diff.split("\n").slice(1));
    const additions = lines.filter((line) => line.startsWith("+")).length;
    const deletions = lines.filter((line) => line.startsWith("-")).length;
    if (
      !Number.isInteger(original.additions) ||
      !Number.isInteger(original.deletions) ||
      additions !== original.additions ||
      deletions !== original.deletions
    ) {
      file.hunks.forEach((hunk) => {
        hunk.complete = false;
        hunk.issue =
          "Patch coverage does not match GitHub change counts; human review required.";
      });
    }
  });
  return parsed;
}
