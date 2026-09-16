import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateImageUrl,
  isPublicAddress,
  fetchMemeImage,
} from "../lib/meme-image";
import { POST } from "../app/api/meme-image/route";
test("image URL rejects credentials, non-HTTPS schemes, and custom ports", () => {
  for (const value of [
    "http://example.com/a.jpg",
    "file:///etc/passwd",
    "data:image/png,test",
    "https://user:pass@example.com/a.jpg",
    "https://example.com:8443/a.jpg",
    "garbage",
  ])
    assert.throws(() => validateImageUrl(value));
  assert.equal(
    validateImageUrl("https://example.com/meme.png").hostname,
    "example.com",
  );
});
test("image fetch rejects private, reserved, mapped, and transition addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "172.16.0.1",
    "0.0.0.0",
    "192.0.2.10",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "64:ff9b::a00:1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
test("loopback URL is rejected before opening an HTTP connection", async () => {
  await assert.rejects(
    fetchMemeImage("https://127.0.0.1/meme.png"),
    /public internet/,
  );
});
test("image endpoint rejects webpages as malformed requests and cross-origin callers", async () => {
  const request = (body: unknown, origin = "https://demo.test") =>
    new Request("https://demo.test/api/meme-image", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await POST(
        request({ url: "https://example.com/a.png" }, "https://evil.test"),
      )
    ).status,
    403,
  );
  assert.equal((await POST(request({ url: 123 }))).status, 400);
  assert.equal(
    (await POST(request({ url: "file:///etc/passwd" }))).status,
    400,
  );
});
