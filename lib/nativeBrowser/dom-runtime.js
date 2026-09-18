/** Self-contained: this same trusted function runs in an iframe or browser-use page. */
export async function nativeBrowserDom(command) {
  const root = window;
  let cache = root.__jevNative;
  if (!cache || cache.document !== document || cache.version !== 2) {
    cache?.observer?.disconnect();
    const state = {
      version: 2,
      document,
      id: Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
        n.toString(16).padStart(8, "0"),
      ).join(""),
      revision: 0,
      next: 1,
      ids: new WeakMap(),
      nodes: new Map(),
      last: new Map(),
      applying: false,
      regions: new WeakMap(),
    };
    const touch = (node) => {
      for (
        let e = node.nodeType === 1 ? node : node.parentElement;
        e;
        e = e.parentElement
      )
        state.regions.set(e, (state.regions.get(e) ?? 0) + 1);
    };
    state.recordChanges = (records) => {
      if (!records.length) return;
      state.revision++;
      for (const record of records) touch(record.target);
    };
    state.observer = new MutationObserver(state.recordChanges);
    state.observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    document.addEventListener(
      "input",
      (event) => {
        if (!state.applying) {
          state.revision++;
          touch(event.target);
        }
      },
      true,
    );
    document.addEventListener(
      "change",
      (event) => {
        if (!state.applying) {
          state.revision++;
          touch(event.target);
        }
      },
      true,
    );
    root.__jevNative = cache = state;
  }
  const state = cache;
  const flush = () => {
    state.recordChanges(state.observer.takeRecords());
  };
  const id = (e) => {
    let key = state.ids.get(e);
    if (!key) {
      key = `n${state.next++}`;
      state.ids.set(e, key);
    }
    state.nodes.set(key, e);
    return key;
  };
  const name = (e) => {
    const labelled = (e.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .map((k) => document.getElementById(k)?.textContent ?? "")
      .join(" ")
      .trim();
    const field = e;
    return (
      labelled ||
      e.getAttribute("aria-label") ||
      Array.from(field.labels ?? [])
        .map((label) => {
          const copy = label.cloneNode(true);
          for (const control of copy.querySelectorAll(
            "input,select,textarea,button",
          ))
            control.remove();
          return copy.textContent;
        })
        .join(" ")
        .trim() ||
      e.getAttribute("placeholder") ||
      e.getAttribute("title") ||
      e.textContent ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160);
  };
  const allowed = (e) =>
    !e.matches(
      "input[type=password],input[type=file],input[type=hidden],[contenteditable]",
    );
  const value = (e) =>
    e.matches("input[type=checkbox],input[type=radio]")
      ? String(e.checked)
      : "value" in e
        ? String(e.value)
        : (e.getAttribute("aria-checked") ?? "");
  const region = (e) =>
    e.closest("form,section,main,nav,aside,[role=form],[role=dialog]") ??
    e.parentElement ??
    e;
  const guard = (e) =>
    JSON.stringify([
      location.href,
      document.title,
      id(region(e)),
      state.regions.get(region(e)) ?? 0,
      e.tagName,
      e.getAttribute("role"),
      name(e),
      value(e),
      e.matches(":disabled"),
      e.getAttribute("readonly"),
      e.getAttribute("aria-disabled"),
      e.getAttribute("href"),
      e.checked,
      e.closest("form")?.getAttribute("action"),
      e.parentElement ? id(e.parentElement) : null,
      e.tagName === "SELECT"
        ? Array.from(e.options).map((o) => [
            o.index,
            o.value,
            o.label,
            o.disabled,
            o.parentElement?.hasAttribute("disabled"),
          ])
        : null,
    ]);
  const visible = (e) => {
    if (e.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(e),
      r = e.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity) !== 0 &&
      r.width > 0 &&
      r.height > 0 &&
      r.y + r.height / 2 >= 0 &&
      r.y + r.height / 2 < innerHeight &&
      r.x + r.width / 2 >= 0 &&
      r.x + r.width / 2 < innerWidth
    );
  };
  flush();
  if (command.type === "verify") {
    const fields = Array.from(
      document.querySelectorAll("input,textarea,select"),
    ).filter(allowed);
    const missing = Object.entries(command.expected.fields)
      .filter(([label, expected]) => {
        const matches = fields.filter((e) => name(e) === label);
        return matches.length !== 1 || value(matches[0]) !== expected;
      })
      .map(([label]) => label);
    const text = document.body.innerText;
    const missingText = command.expected.text.filter(
      (expected) => !text.includes(expected),
    );
    const empty =
      !Object.keys(command.expected.fields).length &&
      !command.expected.text.length;
    return {
      passed: !empty && !missing.length && !missingText.length,
      summary: empty
        ? "No completion contract supplied."
        : missing.length || missingText.length
          ? `Unverified: ${[...missing, ...missingText].join(", ")}`
          : "All supplied field and confirmation checks passed.",
    };
  }
  if (command.type === "observe") {
    for (const [key, node] of state.nodes)
      if (!node.isConnected) state.nodes.delete(key);
    const nodes = [];
    let optionsTruncated = false;
    const selector =
      "a[href],button,input,textarea,select,summary,[role=button],[role=option],[role=checkbox],[role=radio],[role=tab]";
    const candidates = Array.from(document.querySelectorAll(selector));
    for (const e of candidates.slice(0, 2000)) {
      if (
        !allowed(e) ||
        !visible(e) ||
        e.matches(":disabled") ||
        e.getAttribute("aria-disabled") === "true"
      )
        continue;
      const fill =
        e.matches(
          "textarea,input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio])",
        ) && !e.hasAttribute("readonly");
      const kind =
        e.tagName === "SELECT"
          ? "select"
          : fill
            ? "fill"
            : e.matches("input[type=checkbox],[role=checkbox]")
              ? "toggle"
              : "click";
      const role =
        e.getAttribute("role") ||
        (kind === "fill"
          ? "textbox"
          : kind === "select"
            ? "combobox"
            : kind === "toggle"
              ? "checkbox"
              : e.tagName === "A"
                ? "link"
                : "button");
      const node = {
        id: id(e),
        role,
        label: name(e) || role,
        value: value(e).slice(0, 512),
        kind,
        guard: guard(e),
        group: id(e.closest("form") ?? e.parentElement ?? e),
      };
      if (kind === "select") {
        const options = Array.from(e.options).filter(
          (o) => !o.disabled && !o.closest("optgroup[disabled]"),
        );
        const bounded = options
          .filter((o) => o.value.length <= 200)
          .slice(0, 500);
        optionsTruncated ||= bounded.length < options.length;
        node.options = bounded.map((o) => ({
          index: o.index,
          label: o.label.slice(0, 200),
          value: o.value,
        }));
      }
      nodes.push(node);
      if (nodes.length >= 160) break;
    }
    const text = [];
    const textCandidates = Array.from(
      document.querySelectorAll(
        "h1,h2,h3,p,li,[role=status],[role=alert],output",
      ),
    );
    for (const e of textCandidates.slice(0, 2000)) {
      if (!visible(e)) continue;
      const line = (e.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 300);
      if (line && !text.includes(line)) text.push(line);
      if (text.length >= 80) break;
    }
    const challenge =
      text.find((t) =>
        /verify (?:that )?you are human|complete the captcha|access denied|too many requests/i.test(
          t,
        ),
      ) ?? null;
    return {
      documentId: state.id,
      revision: state.revision,
      url: location.href,
      title: document.title,
      nodes,
      text,
      scroll: {
        y: scrollY,
        height: document.documentElement.scrollHeight,
        viewport: innerHeight,
      },
      challenge,
      observationTruncated:
        optionsTruncated ||
        candidates.length > 2000 ||
        nodes.length >= 160 ||
        textCandidates.length > 2000 ||
        text.length >= 80,
    };
  }
  const results = [];
  if (command.actions.length > 4)
    throw Error("Native batches contain at most four actions.");
  let batchRevision = null;
  for (const action of command.actions) {
    const started = performance.now();
    const reject = (detail) =>
      results.push({
        action,
        status: "rejected",
        detail,
        checkedRevision: state.revision,
        elapsedMs: performance.now() - started,
      });
    // Pace before checking freshness: a changed target during the pause must fail.
    const key = action.target ?? action.operation,
      minimum = action.operation === "WAIT" ? 180 : 120;
    const last = state.last.get(key),
      delay =
        last === undefined
          ? minimum
          : Math.max(minimum, 650 - (Date.now() - last));
    await new Promise((resolve) => setTimeout(resolve, delay));
    flush();
    // A rotating banner must not invalidate a structurally unchanged target.
    // Once a batch starts, any new mutation is a dependency barrier.
    if (
      action.documentId !== state.id ||
      (results.length && batchRevision !== state.revision) ||
      (!action.target && action.revision !== state.revision)
    ) {
      reject("Page changed since this batch was chosen.");
      break;
    }
    if (!results.length) batchRevision = state.revision;
    if (["DONE", "BLOCKED"].includes(action.operation)) {
      reject("Completion must be checked by the independent verifier.");
      break;
    }
    if (
      action.operation === "WAIT" ||
      action.operation === "SCROLL_DOWN" ||
      action.operation === "SCROLL_UP"
    ) {
      if (action.operation !== "WAIT")
        scrollBy({
          top:
            Math.max(1, Math.min(480, Math.floor(innerHeight * 0.75))) *
            (action.operation === "SCROLL_UP" ? -1 : 1),
          behavior: "instant",
        });
      state.last.set(key, Date.now());
      results.push({
        action,
        status: "executed",
        detail: action.operation,
        checkedRevision: state.revision,
        elapsedMs: performance.now() - started,
      });
      break;
    }
    const e = action.target ? state.nodes.get(action.target) : null;
    if (
      !e?.isConnected ||
      !allowed(e) ||
      !visible(e) ||
      e.matches(":disabled") ||
      e.closest('[inert],[aria-disabled="true"]')
    ) {
      reject("Target is detached, hidden or disabled.");
      break;
    }
    if (guard(e) !== action.guard) {
      reject("Target structure or value changed.");
      break;
    }
    const r = e.getBoundingClientRect(),
      hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit || !e.contains(hit)) {
      reject("Target is covered.");
      break;
    }
    if (
      action.operation === "CLICK" &&
      /place order|pay now|confirm purchase|delete account/i.test(name(e))
    ) {
      reject(
        "This research runner does not authorize purchases or destructive account actions.",
      );
      break;
    }
    try {
      state.applying = true;
      if (action.operation === "TYPE_TEXT") {
        if (
          !e.matches("input,textarea") ||
          e.hasAttribute("readonly") ||
          typeof action.text !== "string" ||
          action.text.length > 200
        )
          throw Error("Invalid text command.");
        const field = e;
        const prototype =
          e.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        e.focus({ preventScroll: true });
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(
          field,
          action.text,
        );
        field.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: action.text,
            inputType: "insertText",
          }),
        );
        field.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (action.operation === "SELECT") {
        if (e.tagName !== "SELECT" || typeof action.optionIndex !== "number")
          throw Error("Invalid select command.");
        const select = e,
          option = select.options[action.optionIndex];
        if (
          !option ||
          option.value !== action.value ||
          option.disabled ||
          option.closest("optgroup[disabled]")
        )
          throw Error("Option changed.");
        select.selectedIndex = action.optionIndex;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (action.operation === "CLICK") e.click();
      else throw Error("Unsupported native operation.");
      state.last.set(key, Date.now());
      results.push({
        action,
        status: "executed",
        detail: `${action.operation} ${name(e)}`,
        checkedRevision: batchRevision,
        elapsedMs: performance.now() - started,
      });
    } catch (error) {
      reject(error instanceof Error ? error.message : "Execution failed.");
      break;
    } finally {
      state.applying = false;
    }
    if (
      action.operation === "CLICK" &&
      !(action.batchable && e.matches("input[type=checkbox],[role=checkbox]"))
    )
      break;
  }
  for (const action of command.actions.slice(results.length))
    results.push({
      action,
      status: "skipped",
      detail: "Earlier command ended this batch; observe again.",
      elapsedMs: 0,
    });
  return results;
}
