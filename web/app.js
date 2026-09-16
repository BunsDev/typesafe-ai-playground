(() => {
  "use strict";
  const L = window.PlaygroundLibrary;
  const STORAGE_KEY = "typesafe-playground-workspace-v2";
  const LEGACY_KEY = "signal-lab-typesafe-catalog-v1";
  const $ = (id) => document.getElementById(id);
  let builtins = [], custom = [], drafts = Object.create(null), activeId = "", onlySaved = false;
  let busy = false, latestRun = null, newExampleMode = false, toastTimer, saveTimer;
  let model = "jev-latest";
  let resultsByExample = Object.create(null);
  let storageWritable = true;

  const examples = () => [...builtins, ...custom];
  const active = () => examples().find((item) => item.id === activeId);
  const draft = () => drafts[activeId] ||= L.draftFor(active());
  const selected = () => draft().questions.filter((q) => q.enabled && q.selected);
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const formatState = (value) => typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const percent = (value) => Number.isFinite(Number(value)) ? (Number(value) * 100).toFixed(1) + "%" : "—";
  const width = (value) => Math.max(0, Math.min(100, Number(value) * 100 || 0));
  const testLabels = {puzzle:"Answer-key puzzle", judgment:"Open-ended choice", consistency:"Consistency probe"};
  const inputSignature = () => JSON.stringify({stateText:draft().stateText, stateMode:draft().stateMode, questions:draft().questions, model:$("model-input").value});

  initialize();

  async function initialize() {
    try {
      const response = await fetch("/catalog.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Could not load the example catalog. Reload to try again.");
      builtins = L.catalogExamples(await response.json());
      restoreWorkspace();
      renderCategories();
      openExample(activeId || builtins[0].id);
      wireEvents();
      checkHealth();
    } catch (error) {
      $("example-title").textContent = "Library needs attention";
      $("example-description").textContent = error.message;
      $("library-count").textContent = "Catalog unavailable";
      toast(error.message, true);
    }
  }

  function restoreWorkspace() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.schemaVersion !== 1 || !Array.isArray(saved.custom) || !saved.drafts || typeof saved.drafts !== "object") throw new Error("Unsupported saved workspace.");
        custom = saved.custom.map((item) => ({...L.normalizeExample(item), custom:true}));
        const ids = new Set(builtins.map((item) => item.id));
        custom.forEach((item) => {
          if (ids.has(item.id)) throw new Error("Duplicate saved example ID.");
          ids.add(item.id);
        });
        for (const [id, item] of Object.entries(saved.drafts)) {
          if (ids.has(id) && typeof item.stateText === "string") drafts[id] = {stateText:item.stateText, stateMode:["auto","text","json"].includes(item.stateMode) ? item.stateMode : "auto", questions:L.normalizeQuestions(item.questions)};
        }
        activeId = ids.has(saved.activeId) ? saved.activeId : builtins[0].id;
        if (typeof saved.model === "string") model = saved.model;
      } else {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
        if (Array.isArray(legacy) && legacy.length) {
          custom.push(L.normalizeExample({
            id:"legacy-questions", title:"Your previous question catalog", category:"My examples",
            description:"Questions preserved from the earlier playground.",
            state:builtins[0].state, questions:legacy, custom:true
          }));
        }
      }
    } catch (error) {
      // Preserve unreadable data before starting a usable fresh workspace.
      if (raw) {
        try { localStorage.setItem(STORAGE_KEY + "-recovery-" + Date.now(), raw); } catch { storageWritable = false; }
      }
      custom = []; drafts = Object.create(null); activeId = "";
      toast("Saved workspace could not be restored. Its original data has been kept for recovery.", true);
    }
    $("model-input").value = model;
  }

  function persist() {
    clearTimeout(saveTimer);
    if (!storageWritable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({schemaVersion:1, activeId, model:$("model-input").value, custom, drafts}));
    } catch {
      toast("Browser storage is full or unavailable. Export the library to keep your edits.", true);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 250);
  }

  function wireEvents() {
    $("collection-filter").addEventListener("change", () => { $("category-filter").value = "all"; renderCategories(); renderLibrary(); });
    $("test-notes-button").addEventListener("click", showTestNotes);
    $("mobile-nav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-mobile-view]");
      if (button) setMobileView(button.dataset.mobileView);
    });
    $("example-search").addEventListener("input", renderLibrary);
    $("category-filter").addEventListener("change", renderLibrary);
    $("saved-filter").addEventListener("click", () => {
      onlySaved = !onlySaved;
      $("saved-filter").setAttribute("aria-pressed", String(onlySaved));
      renderLibrary();
    });
    $("example-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-example]");
      if (button && !busy) {
        openExample(button.dataset.example);
        setMobileView("test");
      }
    });
    $("state-input").addEventListener("input", () => {
      draft().stateText = $("state-input").value;
      updateDraftNote(); updateStateNote(); markResultsEdited(); scheduleSave();
    });
    $("model-input").addEventListener("input", () => { markResultsEdited(); scheduleSave(); });
    $("state-mode").addEventListener("change", () => {
      draft().stateMode = $("state-mode").value;
      updateDraftNote(); updateStateNote(); markResultsEdited(); persist();
    });
    $("format-state-button").addEventListener("click", () => attempt(() => {
      const value = JSON.parse($("state-input").value);
      L.validateState(value);
      draft().stateText = JSON.stringify(value, null, 2);
      draft().stateMode = "json";
      $("state-mode").value = "json";
      $("state-input").value = draft().stateText;
      updateDraftNote(); updateStateNote(); markResultsEdited(); persist(); toast("JSON formatted.");
    }));
    $("copy-payload-button").addEventListener("click", () => attempt(async () => {
      await navigator.clipboard.writeText(JSON.stringify(currentPayload(), null, 2));
      toast("Request copied.");
    }));
    $("run-button").addEventListener("click", () => run(false));
    $("bias-run-button").addEventListener("click", () => run(true));
    $("preview-pair-button").addEventListener("click", () => attempt(() => {
      const comparison = active().comparison;
      $("comparison-path").textContent = "Only " + comparison.path.join(".") + " changes to " + JSON.stringify(comparison.value) + ".";
      $("comparison-preview").textContent = formatState(L.comparisonState(L.parseState(draft().stateText, draft().stateMode), comparison));
      $("comparison-dialog").showModal();
    }));
    $("select-all-button").addEventListener("click", () => {
      if (busy) return;
      const allSelected = draft().questions.every((q) => q.selected && q.enabled);
      draft().questions.forEach((q) => { q.enabled = true; q.selected = !allSelected; });
      questionsChanged();
    });
    $("catalog-list").addEventListener("change", (event) => {
      if (event.target.dataset.select && !busy) {
        draft().questions.find((q) => q.id === event.target.dataset.select).selected = event.target.checked;
        questionsChanged();
      }
    });
    $("catalog-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || busy) return;
      const item = draft().questions.find((q) => q.id === button.dataset.question);
      if (!item) return;
      if (button.dataset.action === "edit") editQuestion(item);
      if (button.dataset.action === "toggle") { item.enabled = !item.enabled; questionsChanged(); }
      if (button.dataset.action === "remove") {
        if (draft().questions.length === 1) return toast("Keep at least one question, or add another first.", true);
        if (!confirm("Remove “" + item.label + "” from this example? Reset example can restore starter questions.")) return;
        draft().questions = draft().questions.filter((q) => q.id !== item.id);
        questionsChanged();
      }
    });
    $("new-question-button").addEventListener("click", () => { if (!busy) editQuestion(); });
    $("question-type").addEventListener("change", updateCriteriaEditor);
    $("question-form").addEventListener("submit", saveQuestion);
    $("save-example-button").addEventListener("click", () => openSaveDialog(false));
    $("new-example-button").addEventListener("click", () => openSaveDialog(true));
    $("example-form").addEventListener("submit", saveExample);
    $("reset-example-button").addEventListener("click", () => {
      if (busy || !confirm("Restore the original input and questions for this example?")) return;
      drafts[activeId] = L.draftFor(active());
      openExample(activeId);
      markResultsEdited();
      toast("Example restored.");
    });
    $("import-button").addEventListener("click", () => {
      if (busy) return;
      $("import-error").textContent = "";
      $("import-input").value = "";
      $("import-dialog").showModal();
    });
    $("import-form").addEventListener("submit", importLibrary);
    $("export-library-button").addEventListener("click", () => attempt(() => {
      download("typesafe-example-library.json", L.exportExamples(examples(), drafts));
      toast("Library exported with your edits.");
    }));
    $("export-run-button").addEventListener("click", () => {
      if (latestRun) download("typesafe-run-" + latestRun.exampleId + ".json", latestRun);
    });
    document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
    window.addEventListener("pagehide", persist);
  }

  async function checkHealth() {
    try {
      const response = await fetch("/api/health", {cache:"no-store"});
      const health = await response.json();
      $("connection-status").textContent = health.configured ? "API ready" : "Key not configured";
      $("connection-status").className = "status-chip " + (health.configured ? "status-ready" : "status-offline");
    } catch {
      $("connection-status").textContent = "Server offline";
      $("connection-status").className = "status-chip status-offline";
    }
  }

  function renderCategories() {
    const current = $("category-filter").value;
    const collection = $("collection-filter").value;
    const collections = [...new Set(examples().map((item) => item.collection))];
    $("collection-filter").innerHTML = '<option value="all">All collections</option>' + collections.map((name) => '<option value="' + esc(name) + '">' + esc(name) + ' (' + examples().filter((e) => e.collection === name).length + ')</option>').join("");
    if (collections.includes(collection)) $("collection-filter").value = collection;
    $("collection-options").innerHTML = collections.map((name) => '<option value="' + esc(name) + '"></option>').join("");
    const pool = examples().filter((e) => $("collection-filter").value === "all" || e.collection === $("collection-filter").value);
    const names = [...new Set(pool.map((item) => item.category))];
    $("category-filter").innerHTML = '<option value="all">All categories</option>' + names.map((name) =>
      '<option value="' + esc(name) + '">' + esc(name) + ' (' + pool.filter((e) => e.category === name).length + ')</option>').join("");
    if (names.includes(current)) $("category-filter").value = current;
    $("category-options").innerHTML = [...new Set(examples().map((e) => e.category))].map((name) => '<option value="' + esc(name) + '"></option>').join("");
    $("example-total").textContent = examples().length;
  }

  function renderLibrary() {
    const query = $("example-search").value.trim().toLowerCase();
    const category = $("category-filter").value;
    const collection = $("collection-filter").value;
    const visible = examples().filter((item) =>
      (collection === "all" || item.collection === collection) &&
      (!onlySaved || item.custom) &&
      (category === "all" || item.category === category) &&
      (!query || [item.title,item.category,item.collection,item.description,item.tryThis,...item.questions.map((q) => q.label)].join(" ").toLowerCase().includes(query))
    );
    $("library-count").textContent = visible.length + " of " + examples().length + " examples";
    $("example-list").innerHTML = visible.map((item) =>
      '<button type="button" class="example-item" data-example="' + esc(item.id) + '" aria-current="' + (activeId === item.id) + '"' + (busy ? " disabled" : "") + '>' +
      '<span class="example-category">' + esc(item.category) + '<span class="example-badge">' + (item.custom ? "SAVED" : item.comparison ? "A/B" : "") + '</span></span>' +
      '<strong>' + esc(item.title) + '</strong><p>' + esc(item.description) + '</p></button>'
    ).join("") || '<div class="empty-state"><strong>No matching examples</strong><p>Try another search, or clear the collection, category and My examples filters.</p></div>';
  }

  function openExample(id) {
    if (busy) return;
    const item = examples().find((e) => e.id === id);
    if (!item) return;
    activeId = id;
    $("example-category").textContent = item.category;
    $("example-title").textContent = item.title;
    $("example-description").textContent = item.description;
    $("test-kind").hidden = !item.test;
    $("test-kind").textContent = item.test ? testLabels[item.test.kind] : "";
    $("test-notes-button").hidden = !item.test;
    $("example-tip").textContent = item.tryThis ? "Try this: " + item.tryThis : "";
    $("source-link").hidden = !item.source;
    if (item.source) {
      $("source-link").href = item.source.url;
      $("source-link").title = item.source.label;
    }
    $("state-input").value = draft().stateText;
    $("state-mode").value = draft().stateMode;
    $("comparison-panel").hidden = !item.comparison;
    if (item.comparison) $("comparison-summary").textContent = item.comparison.labelA + " → " + item.comparison.labelB + " · one field";
    renderLibrary(); renderQuestions(); updateStateNote(); updateDraftNote();
    latestRun = resultsByExample[id] || null;
    renderResults();
    persist();
  }

  function updateStateNote() {
    try {
      const state = L.parseState(draft().stateText, draft().stateMode);
      $("state-format-note").textContent = typeof state === "string" ? "Plain text" : "JSON";
    } catch (error) { $("state-format-note").textContent = error.message; }
  }

  function updateDraftNote() {
    const original = L.draftFor(active());
    $("draft-indicator").hidden = original.stateText === draft().stateText && original.stateMode === draft().stateMode && JSON.stringify(original.questions) === JSON.stringify(draft().questions);
    $("input-kind").textContent = active().custom || !$("draft-indicator").hidden ? "Your local example" : "Synthetic starter data";
    updateRunControls();
  }

  function renderQuestions() {
    $("catalog-list").innerHTML = draft().questions.map((q) => {
      const criteria = q.type === "choice" ? Object.entries(q.criteria).map(([key,value]) => '<li><b>' + esc(key) + ':</b> ' + esc(value) + '</li>').join("") :
        q.type === "score" ? q.criteria.map((value,index) => '<li><b>' + index + ':</b> ' + esc(value) + '</li>').join("") : "";
      return '<article class="question-card' + (q.enabled ? "" : " is-disabled") + '">' +
        '<div class="question-card-head"><label><input type="checkbox" aria-label="Use ' + esc(q.label) + '" data-select="' + esc(q.id) + '"' +
        (q.selected ? " checked" : "") + (!q.enabled || busy ? " disabled" : "") + ' /><span>' + esc(q.label) + '</span></label><span class="type-pill type-' + q.type + '">' + q.type + '</span></div>' +
        '<p>' + esc(q.instructions) + '</p>' +
        (criteria ? '<details class="question-details"><summary>' + (q.type === "choice" ? Object.keys(q.criteria).length + " choices" : q.criteria.length + " ordered levels") + '</summary><ul>' + criteria + '</ul></details>' : "") +
        '<div class="question-actions"><span class="question-key">' + esc(q.id) + '</span>' +
        [["edit","Edit"],["toggle",q.enabled?"Pause":"Enable"],["remove","Remove"]].map(([action,label]) =>
          '<button type="button" class="text-button" data-action="' + action + '" data-question="' + esc(q.id) + '"' + (busy ? " disabled" : "") + '>' + label + '</button>').join("") + '</div></article>';
    }).join("");
    updateRunControls();
  }

  function showTestNotes() {
    const item = active(), test = item.test;
    if (!test) return;
    $("test-notes-title").textContent = item.title;
    $("test-notes-kind").textContent = testLabels[test.kind];
    $("test-notes-copy").textContent = test.note;
    $("test-reference-answers").innerHTML = ["A", "B"].filter((side) => test["expected" + side]).map((side) =>
      '<div class="reference-answer"><strong>' + (item.comparison ? 'Variant ' + side + ' · ' + esc(item.comparison["label" + side]) : 'Reference answer') + '</strong>' +
      Object.entries(test["expected" + side]).map(([key, value]) => '<div><code>' + esc(key) + ': ' + esc(value) + '</code></div>').join("") + '</div>'
    ).join("");
    $("test-notes-dialog").showModal();
  }

  function updateRunControls() {
    const count = selected().length;
    $("selection-count").textContent = count + "/" + draft().questions.length;
    $("run-summary").textContent = count + (count === 1 ? " question" : " questions");
    $("select-all-button").textContent = count === draft().questions.length ? "Clear selection" : "Select all";
    $("run-button").disabled = busy || count === 0;
    $("bias-run-button").disabled = busy || count === 0;
  }

  function questionsChanged() {
    renderQuestions(); updateDraftNote(); markResultsEdited(); persist();
  }

  function editQuestion(item = null) {
    $("question-error").textContent = "";
    $("dialog-title").textContent = item ? "Edit question" : "New question";
    $("editing-id").value = item?.id || "";
    $("question-label").value = item?.label || "";
    $("question-id").value = item?.id || "";
    $("question-type").value = item?.type || "noul";
    $("question-instructions").value = item?.instructions || "";
    $("criteria-input").value = item?.type === "choice" ? Object.entries(item.criteria).map(([key,value]) => key + " | " + value).join("\n") :
      item?.type === "score" ? item.criteria.join("\n") : "";
    updateCriteriaEditor();
    $("question-dialog").showModal();
  }

  function updateCriteriaEditor() {
    const type = $("question-type").value;
    $("criteria-field").hidden = type === "noul";
    $("criteria-help").textContent = type === "choice" ? "One choice per line: key | description" : "One ordered level per line, from lowest to highest.";
    $("criteria-input").placeholder = type === "choice" ? "review | Needs a person\nready | Ready to proceed" : "Low\nMedium\nHigh";
  }

  function saveQuestion(event) {
    event.preventDefault();
    try {
      const originalId = $("editing-id").value;
      const value = {id:$("question-id").value, label:$("question-label").value, type:$("question-type").value, instructions:$("question-instructions").value};
      if (draft().questions.some((q) => q.id === value.id.trim() && q.id !== originalId)) throw new Error("That question key is already used in this example.");
      const lines = $("criteria-input").value.split("\n").map((x) => x.trim()).filter(Boolean);
      if (value.type === "score") value.criteria = lines;
      if (value.type === "choice") {
        const entries = lines.map((line) => {
          const separator = line.indexOf("|");
          if (separator < 1) throw new Error("Use key | description for each choice.");
          return [line.slice(0,separator).trim(),line.slice(separator+1).trim()];
        });
        if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error("Choice keys must be unique.");
        value.criteria = Object.fromEntries(entries);
      }
      const existing = draft().questions.find((q) => q.id === originalId);
      const q = L.normalizeQuestion({...value, enabled:existing?.enabled ?? true, selected:existing?.selected ?? true});
      const next = originalId ? draft().questions.map((item) => item.id === originalId ? q : item) : [...draft().questions,q];
      draft().questions = L.normalizeQuestions(next);
      questionsChanged();
      $("question-dialog").close();
      toast("Question saved for this example.");
    } catch (error) { $("question-error").textContent = error.message; }
  }

  function openSaveDialog(blank) {
    if (busy) return;
    newExampleMode = blank;
    $("example-error").textContent = "";
    $("save-dialog-title").textContent = blank ? "New example" : "Save as new example";
    $("save-dialog-note").textContent = blank ? "Create an example, then edit its input and questions in the workspace." : "Save the current input and questions as a separate example.";
    $("new-example-title").value = blank ? "" : active().title + " — my version";
    $("new-example-collection").value = blank ? "My experiments" : active().collection;
    $("new-example-category").value = blank ? "My examples" : active().category;
    $("new-example-description").value = blank ? "" : active().description;
    $("new-example-tip").value = blank ? "" : active().tryThis;
    $("example-dialog").showModal();
  }

  function saveExample(event) {
    event.preventDefault();
    try {
      const base = newExampleMode ? {
        state:{message:"Could you send the report by Friday?"},
        questions:[{id:"request_present",label:"A request is present",type:"noul",instructions:"Does this message ask the reader to do something?"}]
      } : {...active(), state:L.parseState(draft().stateText, draft().stateMode), questions:L.clone(draft().questions)};
      const item = L.normalizeExample({...base, id:"custom-" + crypto.randomUUID(), custom:true,
        title:$("new-example-title").value, category:$("new-example-category").value,
        collection:$("new-example-collection").value,
        description:$("new-example-description").value, tryThis:$("new-example-tip").value
      });
      custom.push(item);
      $("example-dialog").close();
      clearLibraryFilters();
      renderCategories(); openExample(item.id); setMobileView("test");
      toast("Example saved. It is available under My examples.");
    } catch (error) { $("example-error").textContent = error.message; }
  }

  function clearLibraryFilters() {
    $("collection-filter").value = "all";
    $("example-search").value = ""; $("category-filter").value = "all";
    onlySaved = false; $("saved-filter").setAttribute("aria-pressed","false");
  }

  function importLibrary(event) {
    event.preventDefault();
    try {
      const raw = $("import-input").value;
      if (raw.length > 2 * 1024 * 1024) throw new Error("Import a library smaller than 2 MB.");
      const imported = L.importExamples(raw, examples().map((e) => e.id));
      custom.push(...imported);
      clearLibraryFilters(); renderCategories(); openExample(imported[0].id); setMobileView("test");
      $("import-dialog").close();
      toast(imported.length + " examples imported.");
    } catch (error) { $("import-error").textContent = error.message; }
  }

  function currentPayload() {
    return L.buildPayload(draft().stateText, draft().questions, $("model-input").value, draft().stateMode);
  }

  async function requestRun(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch("/api/run", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload), signal:controller.signal});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Request failed (HTTP " + response.status + ").");
      return body;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The request timed out. Try again.");
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function run(pair) {
    if (busy) return;
    let payload, payloadB;
    try {
      payload = currentPayload();
      if (pair) payloadB = {...payload, state:L.comparisonState(payload.state, active().comparison)};
    } catch (error) { return toast(error.message, true); }
    const item = L.clone(active());
    const questions = L.clone(selected());
    const started = performance.now();
    const inputSnapshot = inputSignature();
    setBusy(true);
    $("result-status").textContent = "Running";
    $("results-meta").textContent = item.title + (pair ? " · two requests" : " · one request");
    $("results-content").innerHTML = '<div class="empty-state"><strong>Running ' + (pair ? "both variants" : "selected questions") + '…</strong><p>Waiting for TypeSafe AI.</p></div>';
    try {
      const outcomes = await Promise.allSettled(pair ? [requestRun(payload),requestRun(payloadB)] : [requestRun(payload)]);
      const failure = outcomes.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      const responses = outcomes.map((result) => result.value);
      latestRun = {
        exampleId:item.id, title:item.title, timestamp:new Date().toISOString(),
        durationMs:Math.round(performance.now()-started), questions, pair,
        ...(pair ? {comparison:item.comparison} : {}),
        requests:pair ? [payload,payloadB] : [payload], responses, inputSnapshot
      };
      resultsByExample[item.id] = latestRun;
      renderResults();
      setMobileView("results");
      toast(pair ? "A/B comparison complete." : "Run complete.");
    } catch (error) {
      latestRun = null;
      delete resultsByExample[item.id];
      $("result-status").textContent = "Error";
      $("results-content").innerHTML = '<div class="error-card">' + esc(error.message) + '</div>';
      setMobileView("results");
      $("export-run-button").disabled = true;
      $("results-note").textContent = pair ? "One or both requests failed; no comparison shown." : "Adjust the input or retry.";
      toast(error.message, true);
    } finally { setBusy(false); }
  }

  function setBusy(value) {
    busy = value;
    $("run-button").textContent = value ? "Running…" : "Run example";
    for (const id of ["state-input","state-mode","model-input","new-example-button","save-example-button","new-question-button","reset-example-button","select-all-button","format-state-button","import-button"]) $(id).disabled = value;
    renderQuestions(); renderLibrary();
  }

  function setMobileView(view) {
    if (!["library","test","results"].includes(view)) return;
    document.querySelector(".workspace").dataset.mobileView = view;
    document.querySelectorAll(".mobile-nav-button").forEach((button) => {
      const active = button.dataset.mobileView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (window.matchMedia("(max-width: 660px)").matches) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      window.scrollTo({top:0, behavior});
    }
  }

  function markResultsEdited() {
    if (!latestRun) return;
    const signature = inputSignature();
    $("result-status").textContent = signature === latestRun.inputSnapshot ? "Complete" : "Input changed";
  }

  function renderResults() {
    $("export-run-button").disabled = !latestRun;
    if (!latestRun) {
      $("result-status").textContent = "Ready";
      $("results-meta").textContent = "";
      $("results-note").textContent = "Runs only when you click Run.";
      $("results-content").innerHTML = '<div class="empty-state"><strong>Ready to test this example.</strong><p>Click Run example to evaluate its input with the selected questions.</p></div>';
      return;
    }
    const run = latestRun;
    const modelNames = [...new Set(run.responses.map((r) => r.model).filter(Boolean))].join(" / ") || "Model unavailable";
    const tokens = run.responses.reduce((sum,r) => sum + (r.usage?.input_tokens || 0), 0);
    $("results-meta").textContent = run.title + " · " + modelNames + " · " + run.durationMs + " ms · " + tokens + " input tokens";
    $("results-note").textContent = run.pair ? "One comparison is exploratory. Check assumptions and repeat before drawing conclusions." : "Latest run for this example · not saved after reload.";
    $("results-content").innerHTML = run.questions.map((q) =>
      '<article class="result-card"><div class="result-card-head"><h3>' + esc(q.label) + '</h3><span class="type-pill type-' + q.type + '">' + q.type + '</span></div>' +
      (run.pair ? renderPair(q,run) : renderAnswer(run.responses[0].answers?.[q.id],q)) + '</article>'
    ).join("");
    $("results-content").scrollTop = 0;
    markResultsEdited();
  }

  function renderPair(q,run) {
    const a = run.responses[0].answers?.[q.id], b = run.responses[1].answers?.[q.id];
    return '<div class="pair-answers"><div class="pair-answer"><span class="variant-label">A · ' + esc(run.comparison.labelA) + '</span>' + renderAnswer(a,q) +
      '</div><div class="pair-answer"><span class="variant-label variant-b">B · ' + esc(run.comparison.labelB) + '</span>' + renderAnswer(b,q) +
      '</div></div><div class="delta-note">' + difference(a,b) + '</div>';
  }

  function renderAnswer(answer, question) {
    if (!answer) return '<p class="answer-caption">No answer returned for this question.</p>';
    let html = "";
    if (answer.type === "noul") {
      html = '<div class="answer-number">' + percent(answer.noul) + '</div><div class="answer-caption">Probability of yes</div><div class="answer-bar"><span style="width:' + width(answer.noul) + '%"></span></div>';
    } else if (answer.type === "choice") {
      html = '<div class="answer-number">' + esc(answer.choice ?? "—") + '</div><div class="answer-caption">Selected choice</div>' + probabilities(answer.probabilities);
    } else if (answer.type === "score") {
      const score = Number(answer.score);
      const legend = answer.legend || Object.fromEntries((question.criteria || []).map((level,i) => [i,level]));
      html = '<div class="answer-number">' + (Number.isFinite(score) ? score.toFixed(2) : "—") + '</div><div class="answer-caption">Ordered score</div><div class="score-legend">' +
        Object.entries(legend).map(([key,value]) => '<div class="score-legend-row"><b>' + esc(key) + '</b><span>' + esc(value) + '</span></div>').join("") + '</div>' + probabilities(answer.probabilities);
    } else {
      html = '<p class="answer-caption">Unexpected answer type. Export the run to inspect it.</p>';
    }
    if (answer.confidence !== undefined) html += '<div class="confidence-line"><span>Confidence</span><strong>' + percent(answer.confidence) + '</strong></div>';
    return html;
  }

  function probabilities(values) {
    return '<div class="probability-list">' + Object.entries(values || {}).sort((a,b) => b[1]-a[1]).map(([key,value]) =>
      '<div class="probability-row"><span class="probability-row-label">' + esc(key) + '</span><span class="probability-row-value">' + percent(value) + '</span><div class="probability-track"><span style="width:' + width(value) + '%"></span></div></div>'
    ).join("") + '</div>';
  }

  function difference(a,b) {
    if (!a || !b || a.type !== b.type) return "A comparable answer was not returned on both sides.";
    const signed = (number) => (number >= 0 ? "+" : "") + number.toFixed(1);
    if (a.type === "noul") return "<strong>Probability change:</strong> " + signed((b.noul-a.noul)*100) + " percentage points (B − A).";
    if (a.type === "score") return "<strong>Score change:</strong> " + (b.score-a.score).toFixed(2) + " (B − A).";
    const keys = new Set([...Object.keys(a.probabilities || {}),...Object.keys(b.probabilities || {})]);
    const delta = Math.max(0,...[...keys].map((key) => Math.abs((b.probabilities?.[key] || 0)-(a.probabilities?.[key] || 0)))) * 100;
    return "<strong>" + (a.choice === b.choice ? "Same selected choice." : "Selected choice changed.") + "</strong> Largest probability shift: " + delta.toFixed(1) + " percentage points.";
  }

  function download(filename,value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  async function attempt(fn) {
    try { await fn(); } catch (error) { toast(error.message,true); }
  }

  function toast(message,error=false) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").className = "toast is-visible" + (error ? " toast-error" : "");
    toastTimer = setTimeout(() => $("toast").className = "toast",4200);
  }
})();
