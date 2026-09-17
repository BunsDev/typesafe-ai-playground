import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  createLocalBrowser,
  getLocalBrowser,
  closeLocalBrowser,
} from "../lib/localBrowser";

test("aborting a browser RPC signals the owned process immediately, without waiting for its batch", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "native-browser-cancel-"));
  const fixture = path.join(dir, "fake-uv"),
    marker = path.join(dir, "signal"),
    ready = path.join(dir, "ready");
  await writeFile(
    fixture,
    `#!/usr/bin/env node
const fs = require('node:fs');
process.on('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(marker)}, 'terminated'); process.exit(0); });
process.stdin.on('data', () => {});
fs.writeFileSync(${JSON.stringify(ready)}, 'ready');
setTimeout(() => process.exit(0), 10000);
`,
    { mode: 0o700 },
  );
  const previous = process.env.UV_EXECUTABLE;
  process.env.UV_EXECUTABLE = fixture;
  let id: string | undefined;
  async function waitFor(file: string) {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try {
        return await readFile(file, "utf8");
      } catch {
        await delay(20);
      }
    }
    throw Error(`Timed out waiting for ${path.basename(file)}`);
  }
  try {
    id = createLocalBrowser();
    await waitFor(ready);
    const c = new AbortController();
    const pending = getLocalBrowser(id).read(
      "https://www.newegg.com/p/pl?d=memory",
      c.signal,
    );
    await delay(30);
    c.abort();
    await assert.rejects(pending);
    assert.equal(await waitFor(marker), "terminated");
  } finally {
    if (id) closeLocalBrowser(id);
    if (previous === undefined) delete process.env.UV_EXECUTABLE;
    else process.env.UV_EXECUTABLE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
