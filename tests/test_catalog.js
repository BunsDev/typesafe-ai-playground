const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../web/library.js");
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname,"../web/catalog.json"),"utf8"));
const examples = L.catalogExamples(catalog);

test("every authored example builds a bounded API payload", () => {
  assert.ok(examples.length >= 60);
  assert.ok(new Set(examples.map((e) => e.category)).size >= 12);
  for (const e of examples) {
    const payload = L.buildPayload(L.draftFor(e).stateText,e.questions);
    assert.equal(Object.keys(payload.questions).length,e.questions.filter((q)=>q.enabled&&q.selected).length,e.id);
    assert.equal(payload.model,"jev-latest");
    assert.ok(e.description && e.tryThis,e.id);
    for (const q of Object.values(payload.questions)) {
      assert.equal(q.label,undefined);
      assert.equal(q.selected,undefined);
    }
  }
});

test("example drafts do not share question edits with another case in their pack", () => {
  const first = L.draftFor(examples[0]), second = L.draftFor(examples[1]);
  first.questions[0].instructions = "A local edit";
  first.questions[0].criteria.new_option = "Only in one draft";
  assert.notEqual(second.questions[0].instructions,first.questions[0].instructions);
  assert.equal(second.questions[0].criteria.new_option,undefined);
  assert.equal(examples[0].questions[0].criteria.new_option,undefined);
});

test("each comparison changes exactly its declared field without mutating A", () => {
  function diffs(a,b,prefix="") {
    if (a && b && typeof a==="object" && typeof b==="object") return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap((k)=>diffs(a[k],b[k],prefix?prefix+"."+k:k));
    return a===b ? [] : [prefix];
  }
  const paired = examples.filter((e) => e.comparison);
  assert.ok(paired.length>=5);
  for (const e of paired) {
    const before=JSON.stringify(e.state);
    const b=L.comparisonState(e.state,e.comparison);
    assert.deepEqual(diffs(e.state,b),[e.comparison.path.join(".")],e.id);
    assert.equal(JSON.stringify(e.state),before);
  }
  assert.throws(()=>L.comparisonState({}, {path:["__proto__"],value:{}}),/missing/);
});

test("export/import round trip preserves edits, comparison definitions and choice order", () => {
  const selected = [examples[0],examples.find((e)=>e.comparison)];
  const drafts = {[selected[0].id]:L.draftFor(selected[0])};
  drafts[selected[0].id].stateText="A custom plain-text state.";
  drafts[selected[0].id].questions[0].selected=false;
  const result=L.importExamples(JSON.stringify(L.exportExamples(selected,drafts)));
  assert.equal(result[0].state,"A custom plain-text state.");
  assert.equal(result[0].questions[0].selected,false);
  assert.deepEqual(result[1].comparison,selected[1].comparison);
  assert.deepEqual(Object.keys(result[0].questions[0].criteria),Object.keys(selected[0].questions[0].criteria));
});

test("import gives collisions new IDs and does not overwrite existing examples", () => {
  const doc=L.exportExamples([examples[0],examples[0]]);
  const imported=L.importExamples(doc,[examples[0].id]);
  assert.equal(imported[0].id,examples[0].id+"-copy-2");
  assert.equal(imported[1].id,examples[0].id+"-copy-3");
  assert.ok(imported.every((e)=>e.custom));
});

test("example IDs that match object properties still export and import safely", () => {
  for (const id of ["constructor", "toString", "hasOwnProperty"]) {
    const example = L.normalizeExample({...examples[0], id});
    const exported = L.exportExamples([example]);
    assert.deepEqual(exported.examples[0].state, example.state);
    assert.equal(L.importExamples(exported)[0].id, id);
    const drafts = Object.create(null);
    drafts[id] = L.draftFor(example);
    drafts[id].stateText = "An edited example.";
    assert.equal(L.exportExamples([example], drafts).examples[0].state, "An edited example.");
  }
});

test("invalid imports fail before a partial library can be appended", () => {
  const doc=L.exportExamples([examples[0],examples[1]]);
  doc.examples[1].questions[0].type="freeform";
  assert.throws(()=>L.importExamples(doc),/type must be/);
  const duplicate=L.clone(examples[0]);
  duplicate.questions[1].id=duplicate.questions[0].id;
  assert.throws(()=>L.normalizeExample(duplicate),/unique/);
});

test("API projection only includes selected, enabled questions", () => {
  const draft=L.draftFor(examples[0]);
  draft.questions[0].selected=false;
  draft.questions[1].enabled=false;
  assert.deepEqual(Object.keys(L.buildPayload(draft.stateText,draft.questions).questions),[draft.questions[2].id]);
  draft.questions[2].selected=false;
  assert.throws(()=>L.buildPayload(draft.stateText,draft.questions),/Select at least one/);
});

test("invalid JSON is not silently sent as a different plain-text experiment", () => {
  assert.throws(()=>L.parseState('{"message":'),/invalid/);
  assert.throws(()=>L.parseState("42"),/State must/);
  assert.equal(L.parseState("Please review this text."),"Please review this text.");
});
