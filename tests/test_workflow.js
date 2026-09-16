const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../web/workflow.js');
const reply=(route,evidence=0.95,missing='cause')=>({answers:{route:{type:'choice',choice:route},supported:{type:'noul',noul:evidence},missing:{type:'choice',choice:missing}}});
test('workflow request preserves context and uses editable rule conditions',()=>{
  const rules=W.defaults();
  const turns=[{role:'user',content:'Item arrived broken.'},{role:'assistant',content:'Who caused the damage?'},{role:'user',content:'The delivery driver dropped it.'}];
  const request=W.buildRequest(turns,rules);
  assert.deepEqual(request.state.conversation,turns);
  assert.equal(request.questions.route.criteria.delivery,rules[1].condition);
  assert.ok(request.questions.route.criteria.need_information);
  rules[1].action='Arrange an inspection';
  assert.equal(W.resolve(reply('delivery'),rules).action,'Arrange an inspection');
});
test('all four damage branches map to policy actions without executing them',()=>{
  const rules=W.defaults();
  for(const rule of rules) {
    const result=W.resolve(reply(rule.id),rules);
    assert.equal(result.kind,'recommendation');
    assert.equal(result.action,rule.action);
  }
});
test('missing facts and weak evidence produce follow-up questions',()=>{
  const rules=W.defaults();
  assert.equal(W.resolve(reply('need_information'),rules).kind,'question');
  assert.match(W.resolve(reply('buyer_repeat',0.4,'history'),rules).text,/previous/i);
  assert.match(W.resolve(reply('need_information',0,'cause'),rules).text,/caused/i);
  assert.equal(W.resolve(reply('buyer_repeat',0.95),rules).action,'Ban the buyer for fraud.');
});
test('malformed answers cannot recommend an action',()=>{
  for(const response of [{},reply('invented'),reply('sender',null),reply('sender',1.5)]) assert.equal(W.resolve(response,W.defaults()).kind,'question');
});
test('empty rules, duplicate IDs and excessive history are rejected before sending',()=>{
  assert.throws(()=>W.buildRequest([],W.defaults()),/message/i);
  assert.throws(()=>W.buildRequest([{role:'user',content:'hi'}],[]),/rule/i);
  const rules=W.defaults(); rules[1].id=rules[0].id;
  assert.throws(()=>W.buildRequest([{role:'user',content:'hi'}],rules),/unique/i);
  assert.throws(()=>W.buildRequest([{role:'user',content:'a'.repeat(41000)}],W.defaults()),/new case/i);
});
