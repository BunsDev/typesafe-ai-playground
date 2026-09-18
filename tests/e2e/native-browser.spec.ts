import { test, expect } from "@playwright/test";
import { nativeBrowserDom } from "../../lib/nativeBrowser/dom";
import type {
  NativeSnapshot,
  NativeExecution,
} from "../../lib/nativeBrowser/types";
const observe = async (page: any) =>
  (await page.evaluate(nativeBrowserDom, {
    type: "observe",
  })) as NativeSnapshot;
test("native commands fill independent fields in a batch without another observation", async ({
  page,
}) => {
  await page.setContent(
    '<form><label>Name<input></label><label>Email<input></label><button type="button">Save draft</button></form>',
  );
  const s = await observe(page);
  const fields = s.nodes.filter((n) => n.kind === "fill");
  const actions = fields.map((n, i) => ({
    operation: "TYPE_TEXT" as const,
    target: n.id,
    text: i ? "ada@example.test" : "Ada",
    guard: n.guard,
    documentId: s.documentId,
    revision: s.revision,
  }));
  const results = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions,
  })) as NativeExecution[];
  expect(results.map((r) => r.status)).toEqual(["executed", "executed"]);
  expect(
    await page
      .locator("input")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value)),
  ).toEqual(["Ada", "ada@example.test"]);
});
test("a dependent DOM change stops the remaining batch", async ({ page }) => {
  await page.setContent(
    '<label>First<input id="first"></label><label>Second<input id="second"></label><script>first.oninput=()=>second.replaceWith(document.createElement("input"))</script>',
  );
  const s = await observe(page);
  const actions = s.nodes
    .filter((n) => n.kind === "fill")
    .map((n) => ({
      operation: "TYPE_TEXT" as const,
      target: n.id,
      text: "test",
      guard: n.guard,
      documentId: s.documentId,
      revision: s.revision,
    }));
  const results = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions,
  })) as NativeExecution[];
  expect(results[0].status).toBe("executed");
  expect(results[1].status).toBe("rejected");
  expect(await page.locator("input").last().inputValue()).toBe("");
});
test("covered targets and stale documents cannot execute", async ({ page }) => {
  await page.setContent(
    '<button style="position:absolute;left:20px;top:20px">Save</button><div style="position:absolute;inset:0;background:white;z-index:4">Cover</div>',
  );
  const s = await observe(page);
  const n = s.nodes[0];
  const action = {
    operation: "CLICK" as const,
    target: n.id,
    guard: n.guard,
    documentId: s.documentId,
    revision: s.revision,
  };
  const result = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: [action],
  })) as NativeExecution[];
  expect(result[0].detail).toContain("covered");
  const stale = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: [{ ...action, documentId: "old-document" }],
  })) as NativeExecution[];
  expect(stale[0].status).toBe("rejected");
});
test("cheap freshness checks reject changed field values without scanning the whole document", async ({
  page,
}) => {
  await page.setContent("<label>Name<input></label>");
  const s = await observe(page),
    n = s.nodes[0];
  await page.locator("input").evaluate((e: HTMLInputElement) => {
    e.value = "changed";
  });
  const result = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: [
      {
        operation: "TYPE_TEXT",
        target: n.id,
        text: "Ada",
        guard: n.guard,
        documentId: s.documentId,
        revision: s.revision,
      },
    ],
  })) as NativeExecution[];
  expect(result[0].status).toBe("rejected");
  expect(await page.locator("input").inputValue()).toBe("changed");
});

test("select labels exclude option text and verification checks exact values", async ({
  page,
}) => {
  await page.setContent(
    '<label>GPU<select><option value="">Choose</option><option value="rx">Radeon</option></select></label><p role="status">Draft ready</p>',
  );
  const snapshot = await observe(page);
  expect(snapshot.nodes[0].label).toBe("GPU");
  const failed = (await page.evaluate(nativeBrowserDom, {
    type: "verify",
    expected: { fields: { GPU: "rx" }, text: ["Draft ready"] },
  })) as { passed: boolean };
  expect(failed.passed).toBe(false);
  await page.locator("select").selectOption("rx");
  const passed = (await page.evaluate(nativeBrowserDom, {
    type: "verify",
    expected: { fields: { GPU: "rx" }, text: ["Draft ready"] },
  })) as { passed: boolean };
  expect(passed.passed).toBe(true);
});

test("repeated actions are paced and stale select options are rejected", async ({
  page,
}) => {
  await page.setContent(
    '<button type="button">Toggle</button><label>Plan<select><option value="a">A</option><option value="b">B</option></select></label>',
  );
  const s = await observe(page);
  const button = s.nodes.find((n) => n.kind === "click")!;
  const action = {
    operation: "CLICK" as const,
    target: button.id,
    guard: button.guard,
    documentId: s.documentId,
    revision: s.revision,
  };
  await page.evaluate(nativeBrowserDom, { type: "execute", actions: [action] });
  const second = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: [action],
  })) as NativeExecution[];
  expect(second[0].status).toBe("executed");
  expect(second[0].elapsedMs).toBeGreaterThan(550);
  const select = s.nodes.find((n) => n.kind === "select")!;
  await page
    .locator("option")
    .last()
    .evaluate((e) => {
      (e as HTMLOptionElement).value = "other";
    });
  const changed = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: [
      {
        operation: "SELECT",
        target: select.id,
        optionIndex: 1,
        value: "b",
        guard: select.guard,
        documentId: s.documentId,
        revision: s.revision,
      },
    ],
  })) as NativeExecution[];
  expect(changed[0].status).toBe("rejected");
  expect(await page.locator("select").inputValue()).toBe("a");
});

test("an ambiguous completion field cannot pass verification", async ({
  page,
}) => {
  await page.setContent(
    '<label>Name<input value="Ada"></label><label>Name<input value="wrong"></label>',
  );
  const result = (await page.evaluate(nativeBrowserDom, {
    type: "verify",
    expected: { fields: { Name: "Ada" }, text: [] },
  })) as { passed: boolean };
  expect(result.passed).toBe(false);
});

test("independent checkbox clicks share one observed batch", async ({
  page,
}) => {
  await page.setContent(
    '<label>Updates<input type="checkbox"></label><label>Tips<input type="checkbox"></label>',
  );
  const snapshot = await observe(page);
  expect(snapshot.nodes.map((n) => n.kind)).toEqual(["toggle", "toggle"]);
  const results = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: snapshot.nodes.map((n) => ({
      operation: "CLICK" as const,
      target: n.id,
      guard: n.guard,
      documentId: snapshot.documentId,
      revision: snapshot.revision,
      batchable: true,
    })),
  })) as NativeExecution[];
  expect(results.map((r) => r.status)).toEqual(["executed", "executed"]);
  await expect(page.getByRole("checkbox", { name: "Updates" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Tips" })).toBeChecked();
});

test("unrelated page updates do not strand stable targets before a batch", async ({
  page,
}) => {
  await page.setContent(
    '<form><label>Name<input></label><label>Email<input></label></form><p id="ad">Promotion</p>',
  );
  const snapshot = await observe(page);
  await page.locator("#ad").evaluate((e) => {
    e.textContent = "New promotion";
  });
  const results = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: snapshot.nodes.map((n) => ({
      operation: "TYPE_TEXT" as const,
      target: n.id,
      guard: n.guard,
      documentId: snapshot.documentId,
      revision: snapshot.revision,
      text: "value",
    })),
  })) as NativeExecution[];
  expect(results.map((r) => r.status)).toEqual(["executed", "executed"]);
});

test("changed form context invalidates an otherwise identical target", async ({
  page,
}) => {
  await page.setContent(
    '<form><p id="context">Save settings</p><button type="button">Continue</button></form>',
  );
  const snapshot = await observe(page),
    node = snapshot.nodes[0];
  await page.locator("#context").evaluate((e) => {
    e.textContent = "Delete settings";
  });
  const results = (await page.evaluate(nativeBrowserDom, {
    type: "execute",
    actions: [
      {
        operation: "CLICK",
        target: node.id,
        guard: node.guard,
        documentId: snapshot.documentId,
        revision: snapshot.revision,
      },
    ],
  })) as NativeExecution[];
  expect(results[0].status).toBe("rejected");
});
