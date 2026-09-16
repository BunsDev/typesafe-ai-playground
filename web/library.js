/* Shared data contract: used by the browser and by offline catalog checks. */
((root) => {
  "use strict";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value, field) => {
    if (typeof value !== "string" || !value.trim()) throw new Error(field + " must not be empty.");
    return value.trim();
  };
  const identifier = (value, field) => {
    const result = text(value, field);
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(result)) throw new Error(field + " must start with a letter and contain only letters, numbers, underscores or hyphens.");
    return result;
  };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function validateState(state) {
    if (typeof state === "string" && state.trim()) return state;
    if (object(state) || Array.isArray(state)) return clone(state);
    throw new Error("State must be non-empty text, a JSON object, or an array.");
  }

  function parseState(raw, mode = "auto") {
    if (!raw.trim()) throw new Error("Enter some state before running.");
    if (!["auto", "text", "json"].includes(mode)) throw new Error("Choose Auto, Text, or JSON input format.");
    if (mode === "text") return raw;
    try {
      const parsed = JSON.parse(raw);
      return mode === "auto" && !object(parsed) && !Array.isArray(parsed) ? raw : validateState(parsed);
    }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      if (mode === "json" || /^[\[{]/.test(raw.trim())) throw new Error("This JSON is invalid. Fix its syntax or choose Text for literal input.");
      return raw;
    }
  }

  function normalizeQuestion(question) {
    if (!object(question)) throw new Error("Each question must be an object.");
    const q = {
      id: identifier(question.id, "Question key"),
      label: text(question.label, "Question name"),
      type: question.type,
      instructions: text(question.instructions, "Question instructions"),
      enabled: question.enabled !== false,
      selected: question.selected !== false
    };
    if (!["noul", "choice", "score"].includes(q.type)) throw new Error("Question type must be noul, choice, or score.");
    if (q.type === "choice") {
      if (!object(question.criteria) || Object.keys(question.criteria).length < 2) throw new Error(q.label + " needs at least two choices.");
      const seen = new Set();
      q.criteria = Object.fromEntries(Object.entries(question.criteria).map(([key, value]) => {
        const name = text(key, "Choice name");
        if (seen.has(name)) throw new Error("Choice names must be unique.");
        seen.add(name);
        return [name, text(value, "Choice description")];
      }));
    }
    if (q.type === "score") {
      if (!Array.isArray(question.criteria) || question.criteria.length < 2) throw new Error(q.label + " needs at least two ordered levels.");
      q.criteria = question.criteria.map((level) => text(level, "Score level"));
    }
    if (typeof question.source === "string") q.source = question.source;
    return q;
  }

  function normalizeQuestions(items) {
    if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error("An example needs 1–100 questions.");
    const questions = items.map(normalizeQuestion);
    if (new Set(questions.map((q) => q.id)).size !== questions.length) throw new Error("Question keys must be unique within an example.");
    return questions;
  }

  function comparisonState(state, comparison) {
    const next = clone(validateState(state));
    if (!object(comparison) || !Array.isArray(comparison.path) || !comparison.path.length || !own(comparison, "value")) throw new Error("Comparison needs a field path and replacement value.");
    let node = next;
    comparison.path.forEach((key, index) => {
      if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key) || !object(node) || !own(node, key)) throw new Error("Comparison field is missing from this state.");
      if (index === comparison.path.length - 1) node[key] = clone(comparison.value);
      else node = node[key];
    });
    return next;
  }

  function normalizeExample(example) {
    if (!object(example)) throw new Error("Each example must be an object.");
    const result = {
      id: identifier(example.id, "Example ID"),
      title: text(example.title, "Example title"),
      category: text(example.category, "Category"),
      collection: typeof example.collection === "string" ? text(example.collection, "Collection") : "Use cases",
      description: text(example.description, "Description"),
      state: validateState(example.state),
      questions: normalizeQuestions(example.questions),
      tryThis: typeof example.tryThis === "string" ? example.tryThis : ""
    };
    if (example.comparison) {
      comparisonState(result.state, example.comparison);
      result.comparison = clone(example.comparison);
      result.comparison.labelA = text(example.comparison.labelA, "Variant A label");
      result.comparison.labelB = text(example.comparison.labelB, "Variant B label");
    }
    if (example.test) {
      const test = example.test;
      if (!object(test) || !["puzzle", "judgment", "consistency"].includes(test.kind)) throw new Error("Test kind must be puzzle, judgment, or consistency.");
      result.test = {kind:test.kind, note:text(test.note, "Test notes")};
      for (const side of ["expectedA", "expectedB"]) {
        if (test[side] === undefined) continue;
        if (test.kind === "judgment") throw new Error("Open-ended judgments must not have an answer key.");
        if (!object(test[side]) || !Object.keys(test[side]).length) throw new Error("An answer key must map question keys to reference choices.");
        result.test[side] = Object.fromEntries(Object.entries(test[side]).map(([key, value]) => [identifier(key, "Reference question key"), text(value, "Reference answer")]));
      }
      if (test.kind === "puzzle" && (!result.test.expectedA || (result.comparison && !result.test.expectedB))) throw new Error("Puzzles need reference answers for each variant.");
      if (result.test.expectedB && !result.comparison) throw new Error("A variant B answer needs a comparison.");
    }
    if (object(example.source) && typeof example.source.url === "string" && /^https:\/\//.test(example.source.url)) result.source = {label: String(example.source.label || "Source"), url: example.source.url};
    if (example.custom === true) result.custom = true;
    return result;
  }

  function catalogExamples(catalog) {
    if (!object(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.packs)) throw new Error("Unsupported catalog format.");
    const examples = catalog.packs.flatMap((pack) => {
      if (!Array.isArray(pack.examples)) throw new Error("Each category needs examples.");
      return pack.examples.map((example) => normalizeExample({...example, category: pack.title, collection:example.collection || pack.collection, questions: example.questions || pack.questions, source: example.source || pack.source}));
    });
    if (!examples.length || new Set(examples.map((e) => e.id)).size !== examples.length) throw new Error("Catalog example IDs must be unique.");
    return examples;
  }

  function draftFor(example) {
    return {stateText: typeof example.state === "string" ? example.state : JSON.stringify(example.state, null, 2), stateMode:typeof example.state === "string" ? "text" : "auto", questions: clone(example.questions)};
  }

  function buildPayload(stateText, questions, model = "jev-latest", stateMode = "auto") {
    const all = normalizeQuestions(questions);
    const selected = all.filter((q) => q.enabled && q.selected);
    if (!selected.length) throw new Error("Select at least one question.");
    return {state: parseState(stateText, stateMode), model: model.trim() || "jev-latest", questions: Object.fromEntries(selected.map((q) => [q.id, {
      type:q.type, instructions:q.instructions, ...(q.type === "noul" ? {} : {criteria:clone(q.criteria)})
    }]))};
  }

  function importExamples(raw, existingIds = []) {
    const doc = typeof raw === "string" ? JSON.parse(raw) : raw;
    let examples;
    if (doc?.packs) examples = catalogExamples(doc);
    else {
      if (doc?.schemaVersion !== 1 || !Array.isArray(doc.examples) || !doc.examples.length || doc.examples.length > 500) throw new Error("Import needs schemaVersion 1 and an examples array (1–500 items).");
      examples = doc.examples.map(normalizeExample);
    }
    if (examples.length > 500) throw new Error("Import at most 500 examples at a time.");
    const used = new Set(existingIds);
    return examples.map((example) => {
      const original = example.id;
      let id = original;
      let suffix = 2;
      while (used.has(id)) id = original + "-copy-" + suffix++;
      used.add(id);
      return {...example, id, custom:true};
    });
  }

  function exportExamples(examples, drafts = {}) {
    return {schemaVersion:1, examples:examples.map((example) => {
      const draft = own(drafts, example.id) ? drafts[example.id] : draftFor(example);
      return normalizeExample({...example, state:parseState(draft.stateText, draft.stateMode), questions:draft.questions});
    })};
  }

  const api = {clone, parseState, validateState, normalizeQuestion, normalizeQuestions, normalizeExample, catalogExamples, draftFor, buildPayload, comparisonState, importExamples, exportExamples};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PlaygroundLibrary = api;
})(globalThis);
