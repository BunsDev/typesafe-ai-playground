import type { NativeVerification } from "./types";
export interface NativeBenchmark {
  id: "pc" | "profile";
  version: number;
  title: string;
  goal: string;
  targetOutputTokens: number;
  requiredActions: number;
  fields: { label: string; options?: string[]; value: string }[];
  confirmation: string;
}
const pcFields = [
  {
    label: "GPU",
    options: ["Radeon RX 9070 XT", "GeForce RTX 5070 Ti", "Radeon RX 9060 XT"],
    value: "Radeon RX 9070 XT",
  },
  {
    label: "CPU",
    options: ["Ryzen 5 9600X", "Ryzen 7 9800X3D", "Ryzen 9 9950X"],
    value: "Ryzen 7 9800X3D",
  },
  {
    label: "Motherboard",
    options: ["B650 ATX", "B850 ATX", "X870 ATX"],
    value: "B850 ATX",
  },
  {
    label: "Memory",
    options: ["16GB DDR5", "32GB DDR5", "64GB DDR5"],
    value: "32GB DDR5",
  },
  {
    label: "Storage",
    options: ["1TB NVMe", "2TB NVMe", "4TB NVMe"],
    value: "2TB NVMe",
  },
  {
    label: "Power supply",
    options: ["650W Gold", "850W Gold", "1000W Gold"],
    value: "850W Gold",
  },
  {
    label: "Case",
    options: ["Compact case", "Airflow mid tower", "Full tower"],
    value: "Airflow mid tower",
  },
  {
    label: "Cooling",
    options: ["Single tower", "Dual tower", "360mm AIO"],
    value: "Dual tower",
  },
  { label: "Build name", value: "Orion" },
];
const profileFields = [
  { label: "Given name", value: "Ada" },
  { label: "Family name", value: "Lovelace" },
  { label: "Email", value: "ada@example.test" },
  { label: "City", value: "Austin" },
  { label: "Region", value: "Texas" },
  { label: "Country", value: "United States" },
  { label: "Organization", value: "Example Lab" },
  { label: "Display name", value: "Ada L" },
  { label: "Plan", options: ["Free", "Team", "Enterprise"], value: "Free" },
];
export const nativeBenchmarks: Record<"pc" | "profile", NativeBenchmark> = {
  pc: {
    id: "pc",
    version: 2,
    title: "12-action PC configuration",
    fields: pcFields,
    goal: `Configure a gaming PC draft with these exact choices: ${pcFields.map((f) => `${f.label}: "${f.value}"`).join("; ")}. Use Continue after completing each section. Click Save draft once every field is correct. Stop when PC draft saved appears.`,
    confirmation: "PC draft saved",
    targetOutputTokens: 2400,
    requiredActions: 12,
  },
  profile: {
    id: "profile",
    version: 2,
    title: "Account-style profile setup",
    fields: profileFields,
    goal: `Prepare a synthetic profile draft using these exact values: ${profileFields.map((f) => `${f.label}: "${f.value}"`).join("; ")}. Use Continue after completing each section. Click Save draft once every field is correct. Stop when Profile draft saved appears.`,
    confirmation: "Profile draft saved",
    targetOutputTokens: 1500,
    requiredActions: 12,
  },
};
export function benchmarkVerification(
  task: NativeBenchmark,
): NativeVerification {
  return {
    fields: Object.fromEntries(task.fields.map((f) => [f.label, f.value])),
    text: [task.confirmation],
  };
}
export function benchmarkValues(task: NativeBenchmark) {
  return Object.fromEntries(
    task.fields.filter((f) => !f.options).map((f) => [f.label, f.value]),
  );
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Synthetic controls only: no account, network, cart or payment side effects. */
export function nativeBenchmarkHtml(task: NativeBenchmark) {
  const size = task.id === "pc" ? 4 : 3;
  const groups = Array.from({ length: 3 }, (_, step) =>
    task.fields.slice(step * size, (step + 1) * size),
  );
  const field = (f: NativeBenchmark["fields"][number], index: number) =>
    `<label>${escape(f.label)}${
      f.options
        ? `<select id="f${index}" required><option value="">Choose…</option>${f.options.map((o) => `<option value="${escape(o)}">${escape(o)}</option>`).join("")}</select>`
        : `<input id="f${index}" required autocomplete="off">`
    }</label>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(task.title)}</title>
<style>*{box-sizing:border-box}[hidden]{display:none!important}body{font:15px/1.5 system-ui;margin:0;padding:24px;background:#f6f7fb;color:#20212b}main{max-width:900px;margin:auto}h1{font-size:24px}form{padding:24px;background:white;border:1px solid #dde0e8;border-radius:16px}.step{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}label{display:grid;gap:6px;font-weight:600}input,select,button{font:inherit;padding:10px;border:1px solid #c9cfdb;border-radius:8px;min-width:0;width:100%}.controls{display:flex;gap:12px;margin-top:20px}button{background:#282b38;color:white;cursor:pointer}#confirmation{font-weight:700}@media(max-width:600px){.step{grid-template-columns:1fr}body{padding:16px}}</style>
<main><h1>${escape(task.title)}</h1><p>Synthetic benchmark. Complete all three sections, then review the saved draft.</p><p id="progress" role="status">Section 1 of 3</p>
<form>${groups.map((group, step) => `<section class="step" data-step="${step}"${step ? " hidden" : ""}>${group.map((f, i) => field(f, step * size + i)).join("")}</section>`).join("")}
<div class="controls"><button type="button" id="back" hidden>Back</button><button type="button" id="next">Continue</button><button type="submit" id="save" hidden>Save draft</button></div></form>
<p id="confirmation" role="status"></p><section id="review" hidden aria-label="Saved draft"></section><button type="button" id="edit" hidden>Edit draft</button></main>
<script>
const form=document.querySelector('form'), steps=[...document.querySelectorAll('.step')], back=document.querySelector('#back'), next=document.querySelector('#next'), save=document.querySelector('#save'), review=document.querySelector('#review'), edit=document.querySelector('#edit'), confirmation=document.querySelector('#confirmation');
let step=0;
function show(){
  steps.forEach((section,index)=>section.hidden=index!==step);
  back.hidden=step===0; next.hidden=step===2; save.hidden=step!==2;
  document.querySelector('#progress').textContent='Section '+(step+1)+' of 3';
  const url=new URL(location.href);url.searchParams.set('step',String(step+1));history.replaceState(null,'',url);
}
next.onclick=()=>{const fields=[...steps[step].querySelectorAll('input,select')];if(fields.every(field=>field.reportValidity())){step++;show();}};
back.onclick=()=>{if(step>0){step--;show();}};
form.addEventListener('submit',event=>{
  event.preventDefault(); if(step!==2)return;
  review.replaceChildren();
  ${JSON.stringify(task.fields.map((f) => f.label))}.forEach((label,index)=>{const line=document.createElement('p');line.textContent=label+': '+document.querySelector('#f'+index).value;review.append(line);});
  form.hidden=true; review.hidden=false; edit.hidden=false; confirmation.textContent=${JSON.stringify(task.confirmation)};
});
edit.onclick=()=>{step=0;form.hidden=false;review.hidden=true;edit.hidden=true;confirmation.textContent='';show();};
</script></html>`;
}
