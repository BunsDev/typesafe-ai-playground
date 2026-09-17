import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateNeweggBrowserUrl,
  requireLocalBrowser,
} from "../lib/localBrowser";
test("local browser accepts observed Newegg product slugs and listing URLs only", () => {
  for (const url of [
    "https://www.newegg.com/p/pl?d=AM5",
    "https://www.newegg.com/p/N82E16814150900",
    "https://www.newegg.com/xfx-swift-rx-97tswf3b9-radeon-rx-9070-xt-16gb-graphics-card-triple-fans/p/N82E16814150900?Item=123",
  ])
    assert.doesNotThrow(() => validateNeweggBrowserUrl(url));
  for (const url of [
    "http://www.newegg.com/p/pl",
    "https://evil.example/p/pl",
    "https://www.newegg.com/account",
    "https://user:pass@www.newegg.com/p/pl",
    "https://www.newegg.com/p/pl/evil",
  ])
    assert.throws(() => validateNeweggBrowserUrl(url));
});
test("local browser refuses hosted and cross-origin access", () => {
  assert.throws(() =>
    requireLocalBrowser(new Request("https://example.com/api/local-browser")),
  );
  assert.throws(() =>
    requireLocalBrowser(
      new Request("http://localhost/api/local-browser", {
        headers: { origin: "https://evil.example" },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    requireLocalBrowser(
      new Request("http://localhost/api/local-browser", {
        headers: { origin: "http://localhost" },
      }),
    ),
  );
});

test("retired public research routes cannot spend text-model credits", async () => {
  const helper = await import("../app/api/text-helper/route");
  const research = await import("../app/api/browser-research/route");
  assert.equal(helper.POST().status, 410);
  assert.equal(research.POST().status, 410);
  assert.deepEqual(await helper.GET().json(), {
    configured: false,
    model: null,
  });
});
