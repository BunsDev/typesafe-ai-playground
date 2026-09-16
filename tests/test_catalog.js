const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../web/library.js");
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname,"../web/catalog.json"),"utf8"));
const examples = L.catalogExamples(catalog);

test("every authored example builds a bounded API payload", () => {
  assert.ok(examples.length >= 110);
  assert.ok(new Set(examples.map((e) => e.category)).size >= 22);
  for (const e of examples) {
    const draft = L.draftFor(e);
    const payload = L.buildPayload(draft.stateText,e.questions,"jev-latest",draft.stateMode);
    assert.deepEqual(Object.keys(payload),["state","model","questions"]);
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
  assert.ok(paired.length>=41);
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
  assert.throws(()=>L.parseState("42","json"),/State must/);
  assert.throws(()=>L.parseState("plain text","json"),/invalid/);
  assert.equal(L.parseState("Please review this text."),"Please review this text.");
});

test("explicit text preserves bracketed dialogue, JSON-looking text and primitives", () => {
  for (const raw of ["[FYI] the train is late", '{"unfinished":', "42", "true", "null", '"quoted"', '{"literal":"object"}']) {
    assert.equal(L.parseState(raw,"text"),raw);
    const example = L.normalizeExample({...examples[0],state:raw});
    const draft = L.draftFor(example);
    assert.equal(draft.stateMode,"text");
    assert.equal(L.buildPayload(draft.stateText,draft.questions,"jev-latest",draft.stateMode).state,raw);
    assert.equal(L.importExamples(L.exportExamples([example],{[example.id]:draft}))[0].state,raw);
  }
  for (const raw of ["42","true","null",'"quoted"']) assert.equal(L.parseState(raw),raw);
  assert.deepEqual(L.parseState('{"value":42}'),{value:42});
  assert.deepEqual(L.parseState("[1,2]","json"),[1,2]);
  assert.equal(L.parseState('"quoted"',"json"),"quoted");
  assert.throws(()=>L.parseState("hello","invalid"),/input format/);
  assert.throws(()=>L.parseState("  ","text"),/Enter some state/);
});

test("collections include business use cases, playful choices, dilemmas and challenges", () => {
  for (const [collection,minimum] of Object.entries({"Use cases":60,"Fun & games":10,"Dilemmas & debates":10,"Model challenges":30})) {
    assert.ok(examples.filter((e)=>e.collection===collection).length>=minimum,collection);
  }
  const legacy = {...examples[0]};
  delete legacy.collection;
  assert.equal(L.normalizeExample(legacy).collection,"Use cases");
});

test("authored test notes distinguish judgments and use valid reference choices", () => {
  const annotated = examples.filter((e)=>e.test);
  assert.ok(annotated.length>=50);
  for (const e of annotated) {
    assert.ok(e.test.note.length>30,e.id);
    if (e.test.kind==="judgment") {
      assert.equal(e.test.expectedA,undefined,e.id);
      assert.equal(e.test.expectedB,undefined,e.id);
    }
    for (const side of ["A","B"]) {
      const answers=e.test["expected"+side];
      if (e.test.kind==="puzzle" && (side==="A" || e.comparison)) assert.ok(answers,e.id+side);
      for (const [id,choice] of Object.entries(answers||{})) {
        const q=e.questions.find((q)=>q.id===id);
        assert.equal(q?.type,"choice",e.id+":"+id);
        assert.ok(Object.hasOwn(q.criteria,choice),e.id+":"+choice);
      }
    }
    const payload=L.buildPayload(L.draftFor(e).stateText,e.questions);
    assert.equal(payload.test,undefined);
    assert.equal(payload.collection,undefined);
    for (const q of Object.values(payload.questions)) assert.deepEqual(Object.keys(q),["type","instructions","criteria"]);
  }
});

test("test notes and collections survive export, import and edited questions", () => {
  const example=examples.find((e)=>e.id==="challenge-monty-hall");
  const draft=L.draftFor(example);
  draft.questions[0].id="edited_answer";
  const imported=L.importExamples(L.exportExamples([example],{[example.id]:draft}))[0];
  assert.equal(imported.collection,example.collection);
  assert.deepEqual(imported.test,example.test);
  assert.equal(imported.questions[0].id,"edited_answer"); // Reference notes describe the original, not a grading rule.
  assert.deepEqual(imported.comparison,example.comparison);
});

test("malformed test notes and moral answer keys are rejected on import", () => {
  const example=examples.find((e)=>e.id==="challenge-monty-hall");
  assert.throws(()=>L.normalizeExample({...example,test:{kind:"benchmark",note:"Invalid"}}),/Test kind/);
  assert.throws(()=>L.normalizeExample({...example,test:{kind:"judgment",note:"Open-ended",expectedA:{answer:"switch"}}}),/must not have an answer key/);
  assert.throws(()=>L.normalizeExample({...example,test:{kind:"puzzle",note:"Missing keys"}}),/reference answers/);
  assert.throws(()=>L.normalizeExample({...example,comparison:undefined}),/B answer needs a comparison/);
});

const caseById = (id) => examples.find((e)=>e.id===id);
const variants = (id) => {
  const e=caseById(id);
  return [[e.state,e.test.expectedA.answer],...(e.comparison ? [[L.comparisonState(e.state,e.comparison),e.test.expectedB.answer]] : [])];
};

test("arithmetic and probability reference answers match independent calculations", () => {
  for (const [s,answer] of variants("challenge-bat-ball")) assert.equal({5:"five",15:"fifteen"}[(s.total_cents-s.bat_costs_more_than_ball_cents)/2],answer);
  for (const [s,answer] of variants("challenge-lily-pond")) assert.equal("day"+(s.first_fully_covered_day-1),answer);
  for (const [s,answer] of variants("challenge-machines")) assert.equal({5:"five",50:"fifty"}[Math.ceil(s.widgets_required/s.machine_count)*5],answer);
  for (const [s,answer] of variants("challenge-birthday")) {
    const unique=Array.from({length:s.people},(_,i)=>(365-i)/365).reduce((a,b)=>a*b,1);
    assert.equal(1-unique>0.5 ? "above" : "below",answer);
  }
  const bot=caseById("challenge-rare-bot");
  assert.equal(bot.state.flagged_fake_accounts/(bot.state.flagged_fake_accounts+bot.state.flagged_real_accounts),1/12);
  assert.equal(bot.test.expectedA.answer,"one_twelfth");
  const rolls=Array.from({length:36},(_,i)=>[Math.floor(i/6)+1,i%6+1]);
  assert.equal(rolls.filter(([a,b])=>a===6||b===6).length,11);
  assert.equal(rolls.filter(([a,b])=>a===6&&b===6).length,1);
  assert.deepEqual(variants("challenge-dice").map(([,a])=>a),["eleven_36","one_36"]);
});

test("Monty Hall answer keys distinguish informed and random hosts", () => {
  function winningProbabilities(informed) {
    let stay=0,switchWin=0;
    for(let prize=0;prize<3;prize++) {
      const doors=[1,2].filter((door)=>!informed||door!==prize); // Player always initially picks door 0.
      for(const opened of doors) {
        if(opened===prize) continue; // Condition on observing an empty door.
        const weight=1/3/doors.length;
        if(prize===0) stay+=weight; else switchWin+=weight;
      }
    }
    const total=stay+switchWin;
    return [stay/total,switchWin/total];
  }
  assert.deepEqual(winningProbabilities(true),[1/3,2/3]);
  assert.deepEqual(winningProbabilities(false),[0.5,0.5]);
  assert.deepEqual(variants("challenge-monty-hall").map(([,a])=>a),["switch","equal"]);
});

test("knights and shell-game keys follow exhaustive assignments and state transitions", () => {
  const assignments=[{a:true,b:true},{a:true,b:false},{a:false,b:true},{a:false,b:false}];
  const bothKnaves=assignments.filter(({a,b})=>a===(!a&&!b));
  const atLeastOneKnight=assignments.filter(({a,b})=>a===(a||b));
  assert.deepEqual(bothKnaves,[{a:false,b:true}]);
  assert.equal(atLeastOneKnight.length,3);
  assert.deepEqual(variants("challenge-knights").map(([,a])=>a),["A_knave_B_knight","not_unique"]);
  for (const [s,answer] of variants("challenge-shell-game")) {
    const cups={...s.start};
    for (const instruction of [s.first_swap,s.last_swap]) {
      const [a,b]=instruction.match(/cup[123]/g);
      [cups[a],cups[b]]=[cups[b],cups[a]];
    }
    assert.equal(Object.keys(cups).find((cup)=>cups[cup]==="red"),answer);
  }
});
