import type { VerificationReport } from "../types/browserAgent";
/**
 * The demo task: a synthetic flight-search site rendered in a same-origin
 * iframe, plus an independent verifier that reads the resulting DOM. The
 * goal and this verifier belong to the task; the acting policy sees neither
 * airport lists nor field names.
 */
export const FLIGHT_GOAL =
  "Find one-way flights from Zurich to London on September 20, 2026, for one adult in economy. " +
  "Stop when matching flight options are visible. Do not select or book a flight.";
export interface SandboxOptions {
  /** A promo popover covers the Search button until dismissed (covered-target path). */
  overlay: boolean;
  /** Results take longer to load, so WAIT is needed after Search. */
  slowResults: boolean;
}
export const defaultSandbox: SandboxOptions = {
  overlay: true,
  slowResults: false,
};
const airports = [
  ["ZRH", "Zürich", "Zurich", "Switzerland"],
  ["GVA", "Geneva", "Geneva", "Switzerland"],
  ["BSL", "Basel", "Basel", "Switzerland"],
  ["LHR", "London Heathrow", "London", "United Kingdom"],
  ["LGW", "London Gatwick", "London", "United Kingdom"],
  ["LTN", "London Luton", "London", "United Kingdom"],
  ["CDG", "Paris Charles de Gaulle", "Paris", "France"],
  ["BER", "Berlin Brandenburg", "Berlin", "Germany"],
  ["LIS", "Lisbon", "Lisbon", "Portugal"],
  ["ZAG", "Zagreb", "Zagreb", "Croatia"],
  ["JFK", "New York JFK", "New York", "United States"],
];
const airlines = ["Helvetia Air", "Alpenjet", "Thames Wings", "Nordlicht"];
/** Builds the sandbox page. Everything in it is synthetic. */
export function flightSandboxHtml(
  options: SandboxOptions = defaultSandbox,
): string {
  const data = JSON.stringify({ airports, airlines, options });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skyline · Search flights</title>
<style>
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; font: 14px/1.5 system-ui, sans-serif; color: #22262b; background: #f6f7fb; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 10px 24px; background: #fff; border-bottom: 1px solid #e3e6ee; }
  .logo { font-weight: 800; letter-spacing: -0.5px; font-size: 20px; color: #2b4ec9; }
  nav a { margin-left: 18px; color: #4a5160; text-decoration: none; }
  main { max-width: 860px; margin: 0 auto; padding: 16px 20px 40px; }
  h1 { font-size: 24px; margin: 0 0 2px; letter-spacing: -0.5px; }
  .lede { color: #5b6270; margin: 0 0 12px; font-size: 13px; }
  form { background: #fff; border: 1px solid #e3e6ee; border-radius: 12px; padding: 14px; display: grid; gap: 10px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  label { display: grid; gap: 4px; font-size: 12px; font-weight: 600; color: #3b4250; flex: 1; min-width: 150px; }
  .field { display: grid; gap: 4px; flex: 1; min-width: 150px; }
  .field > label { display: block; }
  input, select { font: inherit; padding: 9px 11px; border: 1px solid #c9cfdb; border-radius: 8px; background: #fff; width: 100%; }
  .combo { position: relative; }
  .listbox { position: absolute; z-index: 5; top: calc(100% - 20px); left: 0; right: 0; margin: 4px 0 0; padding: 4px 0; list-style: none; background: #fff; border: 1px solid #c9cfdb; border-radius: 8px; box-shadow: 0 8px 24px rgba(20,30,60,.12); }
  .listbox li { padding: 8px 12px; cursor: pointer; font-weight: 400; }
  .listbox li:hover { background: #eef2ff; }
  .listbox li small { color: #6b7280; margin-left: 6px; }
  .hint { font-weight: 400; color: #6b7280; font-size: 12px; min-height: 16px; }
  .actions { position: relative; display: flex; gap: 12px; align-items: center; }
  button { font: inherit; padding: 10px 18px; border-radius: 8px; border: 1px solid #2b4ec9; background: #2b4ec9; color: #fff; cursor: pointer; font-weight: 600; }
  button.secondary { background: #fff; color: #2b4ec9; }
  .tip { position: absolute; left: 0; top: -14px; z-index: 6; background: #1f2937; color: #fff; padding: 12px 14px; border-radius: 10px; display: flex; gap: 12px; align-items: center; width: 320px; box-shadow: 0 10px 24px rgba(0,0,0,.25); }
  .tip p { margin: 0; font-size: 13px; }
  .tip button { padding: 6px 12px; background: #fff; color: #1f2937; border-color: #fff; }
  #status { margin: 0; flex: 1; min-width: 180px; font-size: 13px; color: #3b4250; }
  #status.error { color: #b42318; font-weight: 600; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #c9cfdb; border-top-color: #2b4ec9; border-radius: 50%; animation: spin .8s linear infinite; vertical-align: -2px; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #results { display: grid; gap: 12px; margin-top: 14px; }
  #results h2 { font-size: 16px; margin: 6px 0 0; }
  article { background: #fff; border: 1px solid #e3e6ee; border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  article h3 { margin: 0 0 4px; font-size: 15px; }
  article p { margin: 0; color: #5b6270; font-size: 13px; }
  .price { font-weight: 700; font-size: 16px; }
  footer { color: #8b93a3; font-size: 12px; text-align: center; padding: 30px 0 0; }
</style>
</head>
<body>
<header>
  <div class="logo">Skyline</div>
  <nav><a href="#flights">Flights</a><a href="#stays">Stays</a><a href="#trips">My trips</a></nav>
</header>
<main>
  <h1>Where next?</h1>
  <p class="lede">Search synthetic flights. This page is a demo site: no real airline, prices, or bookings.</p>
  <form id="search" novalidate>
    <div class="row">
      <label>Trip type
        <select id="trip" name="trip">
          <option value="round">Round trip</option>
          <option value="one-way">One way</option>
        </select>
      </label>
      <label>Passengers
        <select id="pax" name="pax">
          <option value="1">1 adult</option>
          <option value="2">2 adults</option>
          <option value="3">3 adults</option>
          <option value="4">4 adults</option>
        </select>
      </label>
      <label>Cabin
        <select id="cabin" name="cabin">
          <option value="economy">Economy</option>
          <option value="premium">Premium economy</option>
          <option value="business">Business</option>
        </select>
      </label>
    </div>
    <div class="row">
      <div class="field combo">
        <label for="from">Where from?</label>
        <input id="from" role="combobox" aria-autocomplete="list" aria-controls="from-list" aria-expanded="false" autocomplete="off" placeholder="City or airport">
        <ul id="from-list" class="listbox" role="listbox" aria-label="Departure suggestions" hidden></ul>
        <span class="hint" id="from-hint"></span>
      </div>
      <div class="field combo">
        <label for="to">Where to?</label>
        <input id="to" role="combobox" aria-autocomplete="list" aria-controls="to-list" aria-expanded="false" autocomplete="off" placeholder="City or airport">
        <ul id="to-list" class="listbox" role="listbox" aria-label="Destination suggestions" hidden></ul>
        <span class="hint" id="to-hint"></span>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label for="date">Departure date</label>
        <input id="date" placeholder="e.g. 20 September 2026" autocomplete="off">
        <span class="hint" id="date-hint"></span>
      </div>
      <div class="field" id="return-field">
        <label for="return">Return date</label>
        <input id="return" placeholder="e.g. 27 September 2026" autocomplete="off">
        <span class="hint" id="return-hint"></span>
      </div>
    </div>
    <div class="actions">
      <button type="submit" id="search-button">Search flights</button>
      <button type="button" class="secondary" id="clear">Clear</button>
      <div class="tip" id="tip" role="dialog" aria-label="Price tracking tip" hidden>
        <p>New: track prices for any route and get alerts.</p>
        <button type="button" id="tip-close">Got it</button>
      </div>
      <p id="status" aria-live="polite"></p>
    </div>
  </form>
  <section id="results" aria-label="Flight results"></section>
  <footer>Skyline is a fictional demo. Nothing here can be booked.</footer>
</main>
<script>
(() => {
  const { airports, airlines, options } = ${data};
  const $ = (id) => document.getElementById(id);
  const fold = (s) => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const short = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const iso = (y, m, d) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    return date.toISOString().slice(0, 10);
  };
  const monthIndex = (name) => {
    const f = fold(name);
    const i = months.findIndex((m) => m.startsWith(f.slice(0, 3)));
    return i < 0 ? null : i + 1;
  };
  function parseDate(text) {
    const t = text.trim().replace(/,/g, " ").replace(/\\s+/g, " ");
    let m;
    if ((m = t.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})$/))) return iso(+m[1], +m[2], +m[3]);
    if ((m = t.match(/^(\\d{1,2})[\\/.](\\d{1,2})[\\/.](\\d{4})$/))) return iso(+m[3], +m[2], +m[1]);
    if ((m = t.match(/^(?:[a-z]+ )?(\\d{1,2})(?:st|nd|rd|th)? ([a-z]+) (\\d{4})$/i))) {
      const mo = monthIndex(m[2]); return mo ? iso(+m[3], mo, +m[1]) : null;
    }
    if ((m = t.match(/^(?:[a-z]+ )?([a-z]+) (\\d{1,2})(?:st|nd|rd|th)? (\\d{4})$/i))) {
      const mo = monthIndex(m[1]); return mo ? iso(+m[3], mo, +m[2]) : null;
    }
    return null;
  }
  const pretty = (isoDate) => {
    const d = new Date(isoDate + "T00:00:00Z");
    return days[d.getUTCDay()] + ", " + d.getUTCDate() + " " + short[d.getUTCMonth()] + " " + d.getUTCFullYear();
  };
  function combobox(id) {
    const input = $(id), list = $(id + "-list"), hint = $(id + "-hint");
    let timer = null;
    const close = () => { list.hidden = true; list.innerHTML = ""; input.setAttribute("aria-expanded", "false"); };
    const render = () => {
      const q = fold(input.value.trim());
      if (!q) return close();
      const matches = airports.filter(([code, name, city]) =>
        fold(code).startsWith(q) || fold(name).startsWith(q) || fold(city).startsWith(q) || fold(name).includes(" " + q)).slice(0, 5);
      if (!matches.length) return close();
      list.innerHTML = "";
      for (const [code, name, city, country] of matches) {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.dataset.code = code;
        li.innerHTML = "<strong>" + name + " (" + code + ")</strong><small>" + city + ", " + country + "</small>";
        li.addEventListener("mousedown", (e) => e.preventDefault());
        li.addEventListener("click", () => {
          input.value = name + " (" + code + ")";
          input.dataset.code = code;
          input.dataset.city = city;
          hint.textContent = city + ", " + country;
          close();
        });
        list.appendChild(li);
      }
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("input", () => {
      delete input.dataset.code;
      delete input.dataset.city;
      hint.textContent = input.value.trim() ? "Choose an airport from the suggestions" : "";
      clearTimeout(timer);
      // Suggestions arrive asynchronously, like a real autocomplete request.
      timer = setTimeout(render, 120);
    });
    input.addEventListener("blur", () => setTimeout(close, 150));
    input.addEventListener("focus", () => { if (input.value.trim() && !input.dataset.code) render(); });
  }
  combobox("from");
  combobox("to");
  function dateField(id) {
    const input = $(id), hint = $(id + "-hint");
    input.addEventListener("input", () => {
      const parsed = parseDate(input.value);
      if (parsed) { input.dataset.iso = parsed; hint.textContent = pretty(parsed); }
      else { delete input.dataset.iso; hint.textContent = input.value.trim() ? "Enter a date like 20 September 2026" : ""; }
    });
  }
  dateField("date");
  dateField("return");
  const trip = $("trip");
  const syncTrip = () => { $("return-field").hidden = trip.value === "one-way"; };
  trip.addEventListener("change", syncTrip);
  syncTrip();
  const tip = $("tip");
  if (options.overlay) tip.hidden = false;
  $("tip-close").addEventListener("click", () => { tip.hidden = true; });
  const status = $("status"), results = $("results");
  const setStatus = (text, error) => { status.textContent = text; status.className = error ? "error" : ""; };
  $("clear").addEventListener("click", () => {
    for (const id of ["from", "to", "date", "return"]) { const el = $(id); el.value = ""; delete el.dataset.code; delete el.dataset.city; delete el.dataset.iso; $(id + "-hint").textContent = ""; }
    results.innerHTML = ""; setStatus("", false);
  });
  const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1000003; return h; };
  let searchTimer = null;
  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const from = $("from"), to = $("to"), date = $("date"), ret = $("return");
    results.innerHTML = "";
    const problems = [];
    if (!from.dataset.code) problems.push("choose a departure airport from the suggestions");
    if (!to.dataset.code) problems.push("choose a destination airport from the suggestions");
    if (!date.dataset.iso) problems.push("enter a departure date");
    if (trip.value === "round" && !ret.dataset.iso) problems.push("enter a return date or switch to one way");
    if (from.dataset.code && from.dataset.code === to.dataset.code) problems.push("pick two different airports");
    if (problems.length) return setStatus("Before searching, " + problems.join("; ") + ".", true);
    clearTimeout(searchTimer);
    status.innerHTML = '<span class="spinner"></span>Searching flights…';
    status.className = "";
    const snapshot = { from: from.dataset.code, fromCity: from.dataset.city, to: to.dataset.code, toCity: to.dataset.city, date: date.dataset.iso, trip: trip.value, pax: $("pax").value, cabin: $("cabin").value };
    searchTimer = setTimeout(() => {
      const seed = hash(snapshot.from + snapshot.to + snapshot.date);
      const count = 3 + (seed % 3);
      const cabinLabel = $("cabin").selectedOptions[0].label;
      const heading = document.createElement("h2");
      heading.textContent = count + " " + (snapshot.trip === "one-way" ? "one-way" : "round-trip") + " flights from " + from.value + " to " + to.value + " · " + pretty(snapshot.date) + " · " + $("pax").selectedOptions[0].label + " · " + cabinLabel;
      results.appendChild(heading);
      for (let i = 0; i < count; i++) {
        const dep = 6 + ((seed + i * 7) % 14), mins = ((seed + i * 13) % 4) * 15;
        const duration = 95 + ((seed + i * 3) % 40);
        const arr = dep * 60 + mins + duration;
        const pad = (n) => String(n).padStart(2, "0");
        const price = 89 + ((seed + i * 37) % 260) * (snapshot.cabin === "business" ? 4 : snapshot.cabin === "premium" ? 2 : 1);
        const article = document.createElement("article");
        article.dataset.result = "";
        article.dataset.from = snapshot.from; article.dataset.to = snapshot.to; article.dataset.date = snapshot.date;
        article.dataset.trip = snapshot.trip; article.dataset.pax = snapshot.pax; article.dataset.cabin = snapshot.cabin;
        article.innerHTML = "<div><h3>" + airlines[(seed + i) % airlines.length] + " · " + snapshot.from + " → " + snapshot.to + "</h3><p>" + pretty(snapshot.date) + " · " + pad(dep) + ":" + pad(mins) + " – " + pad(Math.floor(arr / 60)) + ":" + pad(arr % 60) + " · " + Math.floor(duration / 60) + "h " + (duration % 60) + "m · " + cabinLabel + " · " + (snapshot.trip === "one-way" ? "One way" : "Round trip") + "</p></div><div class=\\"price\\">CHF " + price + "</div><button type=\\"button\\" class=\\"secondary\\">Select flight</button>";
        article.querySelector("button").addEventListener("click", () => { article.dataset.selected = "true"; setStatus("Selected " + article.querySelector("h3").textContent + ". This demo cannot book flights.", false); });
        results.appendChild(article);
      }
      setStatus("Showing " + count + " flights.", false);
    }, options.slowResults ? 2600 : 700);
  });
})();
</script>
</body>
</html>`;
}
export interface FlightRequirements {
  originCity: string;
  destinationCity: string;
  date: string;
  passengers: string;
  cabin: string;
}
export const flightRequirements: FlightRequirements = {
  originCity: "Zurich",
  destinationCity: "London",
  date: "2026-09-20",
  passengers: "1",
  cabin: "economy",
};
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const shown = (e: Element | null) =>
  !!e && e.getClientRects().length > 0 && !e.closest("[hidden]");
/**
 * Independent verification from the sandbox DOM. It reads what the site
 * shows, not what the model said, so a DONE choice is never evidence.
 */
export function verifyFlightSearch(
  doc: Document,
  requirements: FlightRequirements = flightRequirements,
): VerificationReport {
  const field = (id: string) =>
    doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  const from = field("from"),
    to = field("to"),
    date = field("date");
  const trip = field("trip"),
    pax = field("pax"),
    cabin = field("cabin");
  const results = Array.from(
    doc.querySelectorAll<HTMLElement>("[data-result]"),
  ).filter(shown);
  const matching = results.filter(
    (r) =>
      fold(from?.dataset.city ?? "") === fold(requirements.originCity) &&
      r.dataset.from === from?.dataset.code &&
      r.dataset.to === to?.dataset.code &&
      r.dataset.date === requirements.date &&
      r.dataset.trip === "one-way" &&
      r.dataset.pax === requirements.passengers &&
      r.dataset.cabin === requirements.cabin,
  );
  const checks = {
    one_way: trip?.value === "one-way",
    origin: fold(from?.dataset.city ?? "") === fold(requirements.originCity),
    destination:
      fold(to?.dataset.city ?? "") === fold(requirements.destinationCity),
    date: date?.dataset.iso === requirements.date,
    passengers: pax?.value === requirements.passengers,
    cabin: cabin?.value === requirements.cabin,
    results_visible: matching.length > 0,
    nothing_selected: !doc.querySelector("[data-result][data-selected]"),
  };
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name.replaceAll("_", " "));
  return {
    passed: failed.length === 0,
    checks,
    summary: failed.length
      ? `Not verified: ${failed.join(", ")}.`
      : `Verified: ${matching.length} matching one-way ${requirements.originCity} → ${requirements.destinationCity} flights on ${requirements.date}, nothing selected.`,
  };
}
