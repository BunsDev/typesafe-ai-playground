import { load } from "cheerio";
import { z } from "zod";
import { fetchPublicDocument } from "./publicDocument";
export const PART_SEARCHES = {
  gpu: ["Radeon RX 9070 XT", "GeForce RTX 5070 Ti"],
  cpu: ["Ryzen 7 AM5 X3D processor"],
  motherboard: ["B850 AM5 ATX DDR5 motherboard"],
  memory: ["32GB 2x16GB DDR5 6000 EXPO"],
  storage: ["2TB NVMe PCIe 4.0 SSD"],
  psu: ["850W Gold ATX 3.1 power supply"],
  case: ["ATX mid tower airflow case"],
  cooler: ["AM5 dual tower air CPU cooler"],
} as const;
export type PartCategory = keyof typeof PART_SEARCHES;
export type PartCandidate = { id: string; category: PartCategory; title: string; priceCents: number; shipping: "free" | "unknown"; url: string };
export type Build = { summary: string; parts: (PartCandidate & { reason: string })[]; totalCents: number; remainingCents: number; warnings: string[] };
const ranges: Record<PartCategory, [number, number]> = { gpu: [450, 1200], cpu: [180, 550], motherboard: [110, 280], memory: [50, 600], storage: [60, 300], psu: [60, 200], case: [50, 180], cooler: [20, 140] };
const patterns: Record<PartCategory, RegExp> = { gpu: /graphics card/i, cpu: /ryzen.*(?:processor|cpu)|(?:processor|cpu).*ryzen/i, motherboard: /motherboard/i, memory: /DDR5/i, storage: /SSD|solid state/i, psu: /power supply|PSU/i, case: /case|chassis/i, cooler: /cooler/i };
export function parseNeweggProducts(html: string, category: PartCategory): PartCandidate[] {
  const $ = load(html);
  const products: PartCandidate[] = [];
  $(".item-cell").each((_, node) => {
    const card = $(node);
    const title = card.find(".item-title").text().replace(/\s+/g, " ").trim();
    const text = card.text();
    if (/stealth|project zero|\bBTF\b|\bPZ\b|pre-installed.*power supply/i.test(title)) return;
    if (category === "storage" && !/2\s?TB/i.test(title)) return;
    if (category === "memory" && (!/32\s?GB/i.test(title) || !/(?:2\s*x\s*16\s?GB|16\s?GB\s*x\s*2)/i.test(title) || /SO-?DIMM/i.test(title))) return;
    if (!title || !patterns[category].test(title) || /desktop (?:computer|pc)|gaming (?:desktop|pc)|refurbished|renewed|open box|used/i.test(title) || /out of stock|sold out|notify me|Sponsored/i.test(text) || !/add to cart/i.test(text)) return;
    const dollars = card.find(".price-current strong").first().text().replaceAll(",", "");
    const fraction = card.find(".price-current sup").first().text();
    if (!/^\d+$/.test(dollars) || !/^\.\d{2}$/.test(fraction)) return;
    const priceCents = Number(dollars) * 100 + Number(fraction.slice(1));
    const [min, max] = ranges[category];
    if (priceCents < min * 100 || priceCents > max * 100) return;
    try {
      const url = new URL(card.find(".item-title").attr("href")!);
      if (url.protocol !== "https:" || url.hostname !== "www.newegg.com" || !/\/p\/[A-Z0-9-]+$/i.test(url.pathname)) return;
      // The Item parameter identifies a marketplace offer: retain it, discard tracking.
      const item = url.searchParams.get("Item");
      url.search = ""; url.hash = "";
      if (item) url.searchParams.set("Item", item);
      if (products.some((p) => p.url === url.href)) return;
      products.push({ id: "", category, title: title.slice(0, 260), priceCents, shipping: /free shipping/i.test(card.find(".price-ship").text()) ? "free" : "unknown", url: url.href });
    } catch { /* Not a purchasable product URL. */ }
  });
  return products;
}
export async function collectParts(signal: AbortSignal, read = fetchPublicDocument) {
  const searches = Object.entries(PART_SEARCHES).flatMap(([category, queries]) => queries.map((query) => ({ category: category as PartCategory, url: `https://www.newegg.com/p/pl?d=${encodeURIComponent(query)}` })));
  const candidates: PartCandidate[] = [];
  const gaps: string[] = [];
  for (let i = 0; i < searches.length; i += 4) {
    const batch = searches.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map((s) => read(s.url, signal)));
    signal.throwIfAborted();
    results.forEach((result, j) => {
      if (result.status === "rejected") { gaps.push(`${batch[j].category}: ${String(result.reason)}`); return; }
      const products = parseNeweggProducts(result.value.body, batch[j].category);
      if (!products.length) gaps.push(`${batch[j].category}: no in-stock, priced candidates could be verified (page may be blocked).`);
      // Spread across price points; avoid wasting the context on near-identical expensive listings.
      const sorted = products.sort((a, b) => a.priceCents - b.priceCents);
      const selected = sorted.length <= 4 ? sorted : [sorted[0], sorted[Math.floor(sorted.length / 3)], sorted[Math.floor(2 * sorted.length / 3)], sorted.at(-1)!];
      for (const product of selected) if (!candidates.some((p) => p.url === product.url)) candidates.push({ ...product, id: `P${candidates.length + 1}` });
    });
  }
  return { candidates, gaps, retrievedAt: new Date().toISOString(), listingRequests: searches.length };
}
export function buildCandidatePayload(candidates: PartCandidate[]) {
  const payload = JSON.stringify(candidates.map(({ id, category, title, priceCents, shipping }) => ({ id, category, title, priceCents, shipping })));
  if (payload.length > 16000) throw Error("Candidate context exceeds the 16,000-character budget.");
  return payload;
}
const selectionSchema = z.object({ summary: z.string().min(1).max(1600), parts: z.array(z.object({ id: z.string(), reason: z.string().min(1).max(700) }).strict()).length(8) }).strict();
export function validateBuild(value: unknown, candidates: PartCandidate[]): Build {
  const selection = selectionSchema.parse(value);
  const parts = selection.parts.map((part) => {
    const candidate = candidates.find((c) => c.id === part.id);
    if (!candidate) throw Error("Model selected an unknown candidate.");
    return { ...candidate, reason: part.reason };
  });
  if (new Set(parts.map((p) => p.category)).size !== 8) throw Error("Each component category must appear exactly once; duplicate category selected.");
  const totalCents = parts.reduce((sum, p) => sum + p.priceCents, 0);
  if (totalCents > 250000) throw Error("Selected components exceed the $2,500 budget.");
  const warnings = ["Prices exclude tax, shipping, OS, peripherals, and assembly. No purchase or cart changes were made."];
  if (totalCents < 225000) warnings.push("This selection uses less than 90% of the budget; review GPU upgrade options before buying.");
  if (parts.some((p) => p.shipping === "unknown")) warnings.push("Some shipping charges are unknown and are not included in the total.");
  return { summary: selection.summary, parts, totalCents, remainingCents: 250000 - totalCents, warnings };
}
export type PartVerification = { id: string; priceCents: number | null; available: boolean; specs: Record<string, string>; error?: string };
export function extractPartVerification(html: string, id: string): PartVerification {
  const $ = load(html);
  // Product JSON-LD avoids confusing a recommended accessory's price with this product.
  let priceCents: number | null = null;
  let available = false;
  function visit(data: unknown) {
    if (Array.isArray(data)) { data.forEach(visit); return; }
    if (!data || typeof data !== "object") return;
    const node = data as Record<string, unknown>;
    if (node["@graph"]) visit(node["@graph"]);
    if (node["@type"] !== "Product") return;
    const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
    for (const offer of offers) {
      if (!offer || typeof offer !== "object") continue;
      const item = offer as Record<string, unknown>;
      if (item.priceCurrency !== "USD" || !/^\d+(?:\.\d{1,2})?$/.test(String(item.price))) continue;
      priceCents = Math.round(Number(item.price) * 100);
      available = /\/InStock$/.test(String(item.availability));
      break;
    }
  }
  $('script[type="application/ld+json"]').each((_, script) => { try { visit(JSON.parse($(script).text())); } catch {} });
  const buyBox = $(".product-buy-box").first();
  const current = buyBox.find(".price-current_2026, .price-current").filter((_, node) => $(node).find("strong").length > 0).first();
  const dollars = current.find("strong").text().replaceAll(",", "");
  const fraction = current.find("sup").text();
  if (/^\d+$/.test(dollars) && /^\.\d{2}$/.test(fraction)) {
    priceCents = Number(dollars) * 100 + Number(fraction.slice(1));
    available = buyBox.find("button:not([disabled])").toArray().some((button) => /add to cart/i.test($(button).text()));
  }
  const specs: Record<string, string> = {};
  $("table tr").each((_, row) => {
    const key = $(row).find("th").text().trim();
    const value = $(row).find("td").text().replace(/\s+/g, " ").trim();
    if (/socket|chipset|memory type|form factor|wattage|connector|gpu length|cooler height|dimensions|compatib|support/i.test(key) && value)
      specs[key.slice(0, 100)] = value.slice(0, 500);
  });
  return { id, priceCents, available, specs };
}
export async function verifySelectedParts(build: Build, signal: AbortSignal, read = fetchPublicDocument) {
  const checks: PartVerification[] = [];
  for (let i = 0; i < build.parts.length; i += 4) {
    const batch = build.parts.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map((p) => read(p.url, signal)));
    signal.throwIfAborted();
    results.forEach((result, j) => checks.push(result.status === "fulfilled" ? extractPartVerification(result.value.body, batch[j].id) : { id: batch[j].id, priceCents: null, available: false, specs: {}, error: String(result.reason) }));
  }
  return checks;
}
