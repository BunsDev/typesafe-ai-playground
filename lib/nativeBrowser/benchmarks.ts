import type { NativeVerification } from "./types";
export interface NativeBenchmark {
  id: "pc" | "profile";
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
  { label: "Resolution", value: "1440p" },
  { label: "Budget", value: "2500" },
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
    title: "12-action PC configuration",
    fields: pcFields,
    goal: `Configure a gaming PC draft with these exact choices: ${pcFields.map((f) => `${f.label}: "${f.value}"`).join("; ")}. Click Save draft once every field is correct. Stop when PC draft saved appears.`,
    confirmation: "PC draft saved",
    targetOutputTokens: 2400,
    requiredActions: 12,
  },
  profile: {
    id: "profile",
    title: "Account-style profile setup",
    fields: profileFields,
    goal: `Prepare a synthetic profile draft using these exact values: ${profileFields.map((f) => `${f.label}: "${f.value}"`).join("; ")}. Click Save draft once every field is correct. Stop when Profile draft saved appears.`,
    confirmation: "Profile draft saved",
    targetOutputTokens: 1500,
    requiredActions: 10,
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
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(task.title)}</title><style>*{box-sizing:border-box}body{font:15px/1.5 system-ui;margin:0;padding:24px;background:#f6f7fb;color:#20212b}main{max-width:900px;margin:auto}h1{font-size:24px}form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:24px;background:white;border:1px solid #dde0e8;border-radius:16px}label{display:grid;gap:6px;font-weight:600}input,select,button{font:inherit;padding:10px;border:1px solid #c9cfdb;border-radius:8px;min-width:0;width:100%}button{background:#282b38;color:white;cursor:pointer}#confirmation{font-weight:700}@media(max-width:600px){form{grid-template-columns:1fr}body{padding:16px}}</style><main><h1>${escape(task.title)}</h1><p>Synthetic benchmark. Complete the requested fields and save a draft.</p><form>${task.fields.map((f, i) => `<label>${escape(f.label)}${f.options ? `<select id="f${i}" required><option value="">Choose…</option>${f.options.map((o) => `<option value="${escape(o)}">${escape(o)}</option>`).join("")}</select>` : `<input id="f${i}" required autocomplete="off">`}</label>`).join("")}<button type="submit">Save draft</button></form><p id="confirmation" role="status"></p></main><script>document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('#confirmation').textContent=${JSON.stringify(task.confirmation)};});</script></html>`;
}
