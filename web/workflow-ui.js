(() => {
  "use strict";
  const W=window.WorkflowChat, $=id=>document.getElementById(id);
  let rules=W.defaults(), turns=[], runs=[], busy=false, controller=null;
  function node(tag,text,className) { const element=document.createElement(tag); if(text!==undefined) element.textContent=text; if(className) element.className=className; return element; }
  function scrollChat() { $("workflow-log").scrollTop=$("workflow-log").scrollHeight; }
  function bubble(role,text,result) {
    const article=node("article",undefined,"chat-message chat-message-"+role);
    article.append(node("span",role==="user"?"You":"Workflow assistant","chat-author"));
    if(result?.kind==="recommendation") {
      const card=node("div",undefined,"workflow-decision");
      card.append(node("span","RECOMMENDED NEXT STEP","workspace-eyebrow"),node("h3",result.action),node("p","Matched rule: "+result.name,"decision-rule"),node("p","Based on reported facts. No action has been executed.","surface-caption"));
      article.append(card);
    } else article.append(node("p",text,"chat-message-text"));
    $("workflow-log").append(article); scrollChat(); return article;
  }
  function reset() {
    turns=[]; runs=[]; $("workflow-log").replaceChildren(); $("workflow-message").value=""; $("workflow-error").textContent=""; $("workflow-export").disabled=true;
    $("workflow-suggestions").hidden=false;
    $("workflow-status").textContent="One request per message · Jev";
    bubble("assistant","Tell me what happened. I’ll apply your decision rules and ask for missing facts before recommending a next step.");
  }
  function renderRules() {
    $("workflow-rules").replaceChildren(); $("workflow-rule-count").textContent=rules.length;
    rules.forEach((rule,index)=>{
      const details=node("details",undefined,"workflow-rule");
      const summary=node("summary"); summary.append(node("span",String(index+1).padStart(2,"0"),"rule-number"),node("span",rule.name)); details.append(summary);
      const preview=node("p",rule.action,"rule-preview");
      const fields=node("div",undefined,"rule-fields");
      for(const [key,label] of [["name","Rule name"],["condition","When these facts are established"],["action","Recommend this action"]]) {
        const id="rule-"+rule.id+"-"+key, field=node(key==="name"?"input":"textarea"); field.id=id; field.value=rule[key]; field.maxLength=2000;
        if(key!=="name") field.rows=3;
        const heading=node("label",label); heading.htmlFor=id;
        field.addEventListener("input",()=>{rule[key]=field.value; if(key==="name") summary.lastChild.textContent=field.value||"Untitled rule"; if(key==="action") preview.textContent=field.value; $("workflow-status").textContent="Rules changed. Your next message uses the updated workflow.";});
        fields.append(heading,field);
      }
      const remove=node("button","Remove rule","text-button"); remove.type="button";
      remove.addEventListener("click",()=>{rules=rules.filter(item=>item.id!==rule.id); renderRules(); $("workflow-status").textContent="Rules changed. Your next message uses the updated workflow.";}); fields.append(remove); details.append(fields);
      const wrapper=node("div",undefined,"workflow-rule-wrap"); wrapper.append(details,preview); $("workflow-rules").append(wrapper);
    });
    $("workflow-add").disabled=rules.length>=12;
  }
  function setBusy(value) {
    busy=value;
    $("workflow-message").disabled=value; $("workflow-send").hidden=value; $("workflow-cancel").hidden=!value; $("workflow-new").disabled=value;
    document.querySelectorAll('.workflow-sidebar input,.workflow-sidebar textarea,.workflow-sidebar button,.chat-suggestions button').forEach(element=>{element.disabled=value;});
    if(!value) $("workflow-add").disabled=rules.length>=12;
    $("workflow-log").setAttribute("aria-busy",String(value));
  }
  async function send(event) {
    event.preventDefault(); if(busy) return;
    const text=$("workflow-message").value.trim(); if(!text) return;
    $("workflow-error").textContent="";
    let payload,snapshot;
    try { snapshot=W.validateRules(rules); payload=W.buildRequest([...turns,{role:"user",content:text}],snapshot); }
    catch(error) { $("workflow-error").textContent=error.message; $("workflow-policy").open=true; return; }
    setBusy(true); $("workflow-suggestions").hidden=true;
    const user=bubble("user",text), pending=bubble("assistant","Checking the reported facts against your workflow…"); pending.classList.add("is-pending");
    $("workflow-status").textContent="Evaluating case…";
    controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),55000); const started=performance.now();
    try {
      const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      const data=await response.json().catch(()=>null);
      if(!response.ok) throw new Error(data?.error||"Request failed. Try again.");
      const result=W.resolve(data,snapshot); pending.remove();
      turns.push({role:"user",content:text},{role:"assistant",content:result.text});
      runs.push({timestamp:new Date().toISOString(),request:payload,response:data,result,durationMs:Math.round(performance.now()-started)});
      bubble("assistant",result.text,result); $("workflow-message").value="";
      $("workflow-export").disabled=false;
      $("workflow-status").textContent=(result.kind==="recommendation"?"Recommendation ready":"Waiting for more case details")+" · "+(data?.model||"Model not reported");
    } catch(error) {
      pending.remove(); user.remove();
      $("workflow-error").textContent=error.name==='AbortError'?"Stopped or timed out. Your message is still in the composer; the provider may have received it.":error.message;
      $("workflow-status").textContent="Message not evaluated. You can retry.";
    } finally { clearTimeout(timeout); controller=null; setBusy(false); $("workflow-message").focus(); scrollChat(); }
  }
  $("workflow-form").addEventListener('submit',send);
  $("workflow-message").addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$("workflow-form").requestSubmit();}});
  $("workflow-cancel").addEventListener('click',()=>controller?.abort());
  $("workflow-new").addEventListener('click',()=>{if((turns.length||$("workflow-message").value.trim())&&!confirm('Start a new case? This clears the current chat. Export it first if you want to keep it.')) return; reset(); $("workflow-message").focus();});
  $("workflow-add").addEventListener('click',()=>{if(rules.length>=12) return; rules.push({id:'rule_'+crypto.randomUUID().replaceAll('-',''),name:'New rule',condition:'',action:''});renderRules(); const details=$("workflow-rules").lastChild.querySelector('details');details.open=true;details.querySelector('input').focus();});
  document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{$("workflow-message").value=button.dataset.example;$("workflow-message").focus();}));
  $("workflow-export").addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({rules,turns,runs},null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='workflow-case.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  renderRules();reset();
  const narrowScreen=window.matchMedia('(max-width:800px)');
  if(narrowScreen.matches) $("workflow-policy").open=false;
  narrowScreen.addEventListener('change',event=>{if(event.matches) $("workflow-policy").open=false;});
  fetch('/api/health').then(response=>{if(!response.ok) throw new Error();return response.json();}).then(health=>{$("workflow-health").textContent=health.configured?'API ready':'API key needed';$("workflow-health").classList.add(health.configured?'status-ready':'status-offline');}).catch(()=>{$("workflow-health").textContent='Server offline'; $("workflow-health").classList.add("status-offline");});
})();
