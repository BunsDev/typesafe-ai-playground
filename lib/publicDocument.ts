import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";

export type PublicDocument = { url: string; body: string; contentType: string };
export function isPublicIp(address: string) {
  try { return ipaddr.process(address).range() === "unicast"; }
  catch { return false; }
}
export function validatePublicUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      (url.port && url.port !== "443") || url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") || value.length > 2048)
    throw Error("Documentation must use a public HTTPS URL without credentials.");
  url.hash = "";
  return url;
}
/** DNS is checked and pinned on every redirect; source links never become an SSRF proxy. */
export async function fetchPublicDocument(value: string, signal: AbortSignal): Promise<PublicDocument> {
  let url = validatePublicUrl(value);
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  for (let hop = 0; hop < 4; hop++) {
    deadline.throwIfAborted();
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true, verbatim: true });
    deadline.throwIfAborted();
    if (!addresses.length || addresses.some((a) => !isPublicIp(a.address)))
      throw Error("Documentation host must resolve only to public addresses.");
    const pinned = addresses[0];
    const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
      const req = request(url, {
        signal: deadline, family: pinned.family,
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
        headers: { Accept: "text/html,text/plain,text/markdown,application/json", "User-Agent": "TypeSafe-DocsResearch/1.0" },
      }, resolve);
      req.on("error", reject);
      req.end();
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
      const location = response.headers.location;
      response.destroy();
      if (!location || hop === 3) throw Error("Documentation redirected too many times.");
      url = validatePublicUrl(new URL(location, url).href);
      continue;
    }
    if (response.statusCode !== 200) {
      response.destroy();
      throw Error(`Documentation returned HTTP ${response.statusCode}.`);
    }
    const contentType = response.headers["content-type"] || "";
    if (!/^(text\/(html|plain|markdown)|application\/(json|vnd\.github\+json))/i.test(contentType)) {
      response.destroy();
      throw Error("Documentation did not return HTML, Markdown, text, or JSON.");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        response.destroy();
        throw Error("Documentation exceeds the 2 MB page limit.");
      }
      chunks.push(Buffer.from(chunk));
    }
    return { url: url.href, body: Buffer.concat(chunks).toString("utf8"), contentType };
  }
  throw Error("Documentation fetch failed.");
}
