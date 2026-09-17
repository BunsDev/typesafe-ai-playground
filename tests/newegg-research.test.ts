import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNeweggProducts, validateBuild, buildCandidatePayload, type PartCandidate } from "../lib/neweggResearch";
const card = (name: string, price = "899", cents = ".99", extra = "") => `<div class="item-cell"><a class="item-title" href="https://www.newegg.com/p/N82E16812345678">${name}</a><li class="price-current"><strong>${price}</strong><sup>${cents}</sup></li><li class="price-ship">Free Shipping</li><button>Add to cart</button>${extra}</div>`;
test("Newegg extraction reads current prices, excludes unavailable/prebuilt/sponsored parts, and strips tracking", () => {
  const html = card("Radeon RX 9070 XT 16GB Graphics Card") + card("Gaming Desktop PC Radeon RX 9070 XT") + card("Radeon RX 9070 XT Graphics Card", "999", ".99", "OUT OF STOCK") + card("Sponsored Radeon RX 9070 XT Graphics Card");
  const products = parseNeweggProducts(html, "gpu");
  assert.equal(products.length, 1);
  assert.equal(products[0].priceCents, 89999);
  assert.equal(products[0].shipping, "free");
  assert.equal(products[0].url, "https://www.newegg.com/p/N82E16812345678");
});
test("no price guessing from monthly financing, missing stock or absent current price", () => {
  assert.equal(parseNeweggProducts(card("Graphics Card").replace('<strong>899</strong><sup>.99</sup>', "$50/month"), "gpu").length, 0);
  assert.equal(parseNeweggProducts(card("Graphics Card").replace("Add to cart", "Notify me"), "gpu").length, 0);
});
const categories = ["cpu", "gpu", "motherboard", "memory", "storage", "psu", "case", "cooler"] as const;
const candidates: PartCandidate[] = categories.map((category, i) => ({ id: `P${i}`, category, title: `${category} AM5 DDR5 ATX`, priceCents: i === 1 ? 100000 : 20000, shipping: "free", url: `https://www.newegg.com/p/N82E1681234567${i}` }));
const answer = { summary: "1440p gaming build", parts: candidates.map((p) => ({ id: p.id, reason: "Fits the build." })) };
test("build verifier requires all eight categories exactly once and uses observed integer prices", () => {
  const build = validateBuild(answer, candidates);
  assert.equal(build.totalCents, 240000);
  assert.equal(build.remainingCents, 10000);
  assert.throws(() => validateBuild({ ...answer, parts: answer.parts.slice(1) }, candidates));
  assert.throws(() => validateBuild({ ...answer, parts: [...answer.parts.slice(1), answer.parts[1]] }, candidates), /category|duplicate/i);
  assert.throws(() => validateBuild({ ...answer, parts: answer.parts.map((p) => ({ ...p, id: "invented" })) }, candidates), /candidate/i);
  assert.throws(() => validateBuild(answer, candidates.map((p) => ({ ...p, priceCents: p.priceCents + 2000 }))), /budget/i);
});
test("selection context omits URLs and page HTML and stays within its token proxy budget", () => {
  const payload = buildCandidatePayload(candidates);
  assert.doesNotMatch(payload, /https:|<html/);
  assert.ok(payload.length < 16000);
  assert.match(payload, /priceCents/);
});
