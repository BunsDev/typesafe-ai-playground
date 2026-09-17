import { load } from "cheerio";
import { z } from "zod";
import { fetchPublicDocument, validatePublicUrl, type PublicDocument } from "./publicDocument";

export type ResearchTask = "github" | "typesafe";
export const TRENDING_URL = "https://github.com/trending?since=daily";
export type DocLink = { title: string; url: string };
export type ResearchSource = { id: string; title: string; url: string; text: string; truncated: boolean };
export type ResearchBundle = {
  task: ResearchTask; retrievedAt: string; sources: ResearchSource[]; gaps: string[];
  repository?: { repository: string; starsToday: number };
};
export function parseTrending(html: string) {
  const $ = load(html);
  const first = $("article.Box-row").first();
  const href = first.find("h2 a").attr("href");
  if (!href || !/^\/[\w.-]+\/[\w.-]+$/.test(href))
    throw Error("Could not verify the first repository in GitHub's ranking.");
  const daily = first.find("span").toArray().map((node) => $(node).text().trim()).join("\n").match(/([\d,]+)\s+stars? today/i);
  if (!daily) throw Error("Could not verify the daily Trending time window.");
  return { repository: href.slice(1), starsToday: Number(daily[1].replaceAll(",", "")) };
}
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
export function extractDocument(url: string, body: string, contentType: string) {
  const links: DocLink[] = [];
  function add(title: string, href: string) {
    try {
      const parsed = validatePublicUrl(new URL(href, url).href);
      if (!links.some((l) => l.url === parsed.href)) links.push({ title: clean(title), url: parsed.href });
    } catch { /* Ignore non-document URLs. */ }
  }
  let title = url;
  let text = body;
  if (/html/i.test(contentType)) {
    const $ = load(body);
    title = $("title").text() || $("h1").first().text() || url;
    $("script,style,svg,noscript,template,form,[hidden],[aria-hidden=true]").remove();
    $("a[href]").each((_, a) => add($(a).text(), $(a).attr("href")!));
    $("nav,header,footer,aside").remove();
    const main = $("main,article,[role=main]").first();
    const root = main.length ? main : $("body");
    root.find("p,h1,h2,h3,h4,li,pre,section,br,tr").append("\n");
    text = root.text().replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
  } else {
    title = body.match(/^#\s+(.+)$/m)?.[1] || url.split("/").at(-1) || url;
    for (const match of body.matchAll(/(?<!!)\[([^\]]+)\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)) add(match[1], match[2]);
    // Some READMEs use HTML anchors for their documentation website.
    const $ = load(body);
    $("a[href]").each((_, a) => add($(a).text(), $(a).attr("href")!));
  }
  return { title: clean(title), text: text.slice(0, 16000), truncated: text.length > 16000, links };
}
export function selectDocLinks(links: DocLink[], task: ResearchTask, limit = 6) {
  return links.map((link, index) => {
    const u = new URL(link.url);
    const value = `${link.title} ${u.pathname}`.toLowerCase();
    let score = /docs?|documentation|guide|quick.?start|getting.?started|introduction|install|usage|tutorial/.test(value) ? 3 : 0;
    if (task === "typesafe") {
      if (u.hostname !== "docs.typesafe.ai") return { link, score: -1, index };
      if (/use.case/.test(value)) score += 20;
      if (/primitives|confidence|system.one/.test(value)) score += 8;
      if (/patterns|how.to.build/.test(value)) score += 12;
      if (/sdk|changelog|\/api\//.test(value)) score -= 10;
    }
    if (/login|sign.?up|issues|pulls|releases|license|contribut|changelog|\.png$|\.svg$|\.jpg$/.test(value)) score = -1;
    return { link, score, index };
  }).filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((v, i, all) => all.findIndex((x) => x.link.url === v.link.url) === i)
    .slice(0, limit).map((v) => v.link);
}
function rawGithubUrl(value: string) {
  const u = new URL(value);
  if (u.hostname === "github.com" && /^\/[^/]+\/[^/]+\/blob\//.test(u.pathname))
    return `https://raw.githubusercontent.com${u.pathname.replace("/blob/", "/")}`;
  return value;
}
type FetchPage = (url: string, signal: AbortSignal) => Promise<PublicDocument>;
/** Fixed entry points, bounded breadth, no search-engine detours or model-driven clicking. */
export async function collectResearch(task: ResearchTask, signal: AbortSignal, fetchPage: FetchPage = fetchPublicDocument): Promise<ResearchBundle> {
  const bundle: ResearchBundle = { task, retrievedAt: new Date().toISOString(), sources: [], gaps: [] };
  function add(page: PublicDocument, sourceUrl = page.url) {
    const doc = extractDocument(sourceUrl, page.body, page.contentType);
    if (clean(doc.text).length < 40) throw Error("Page has insufficient readable documentation.");
    if (!bundle.sources.some((s) => s.url === sourceUrl))
      bundle.sources.push({ id: `S${bundle.sources.length + 1}`, title: doc.title, url: sourceUrl, text: doc.text, truncated: doc.truncated });
    return doc;
  }
  let links: DocLink[];
  if (task === "github") {
    const ranking = await fetchPage(TRENDING_URL, signal);
    bundle.repository = parseTrending(ranking.body);
    const readme = await fetchPage(`https://api.github.com/repos/${bundle.repository.repository}/readme`, signal);
    const data = z.object({ encoding: z.literal("base64"), content: z.string().min(1), html_url: z.string().url() }).parse(JSON.parse(readme.body));
    const readmeUrl = validatePublicUrl(data.html_url);
    if (readmeUrl.hostname !== "github.com" || !readmeUrl.pathname.startsWith(`/${bundle.repository.repository}/blob/`))
      throw Error("README source does not match the ranked repository.");
    // Resolve relative links against the actual README path/ref, never an assumed main branch.
    const doc = add({ url: data.html_url, body: Buffer.from(data.content, "base64").toString("utf8"), contentType: "text/markdown" });
    links = selectDocLinks(doc.links, task, 4).filter((l) => l.url !== data.html_url);
  } else {
    const index = await fetchPage("https://docs.typesafe.ai/llms.txt", signal);
    const doc = extractDocument(index.url, index.body, index.contentType);
    links = selectDocLinks(doc.links, task, 8);
    if (!links.length) throw Error("The TypeSafe documentation index contained no relevant pages.");
  }
  // Batches of four bound concurrency and preserve source IDs in discovery order.
  for (let offset = 0; offset < links.length; offset += 4) {
    signal.throwIfAborted();
    const batch = links.slice(offset, offset + 4);
    const results = await Promise.allSettled(batch.map((link) => fetchPage(rawGithubUrl(link.url), signal)));
    signal.throwIfAborted();
    results.forEach((result, i) => {
      try {
        if (result.status === "rejected") throw result.reason;
        add(result.value, result.value.url === rawGithubUrl(batch[i].url) ? batch[i].url : result.value.url);
      } catch (error) {
        bundle.gaps.push(`${batch[i].url}: ${error instanceof Error ? error.message : "Could not read page."}`);
      }
    });
  }
  if (!bundle.sources.length) throw Error("No documentation could be read; no answer was generated.");
  return bundle;
}
const answerSchema = z.object({
  summary: z.string().min(1).max(2000),
  items: z.array(z.object({
    title: z.string().min(1).max(160),
    explanation: z.string().min(1).max(1200),
    application: z.string().min(1).max(1200),
    evidence: z.array(z.object({ sourceId: z.string(), quote: z.string().min(15).max(240) }).strict()).min(1).max(3),
  }).strict()).min(1).max(10),
}).strict();
export type ResearchAnswer = z.infer<typeof answerSchema>;
export function validateResearchAnswer(value: unknown, task: ResearchTask, sources: ResearchSource[]): ResearchAnswer {
  const answer = answerSchema.parse(value);
  if (task === "typesafe" && answer.items.length !== 10) throw Error("The answer must contain exactly ten use cases.");
  if (task === "github" && (answer.items.length < 4 || answer.items.length > 6)) throw Error("The GitHub summary must contain four to six items.");
  if (new Set(answer.items.map((i) => clean(i.title).toLowerCase())).size !== answer.items.length)
    throw Error("Answer items must be distinct.");
  for (const item of answer.items) for (const evidence of item.evidence) {
    const source = sources.find((s) => s.id === evidence.sourceId);
    if (!source || !clean(source.text).includes(clean(evidence.quote)))
      throw Error("The answer contained unverifiable source evidence.");
  }
  return answer;
}
