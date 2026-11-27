import { routeFromHash, stateFor } from "./hub-model.mjs";
import { appendJobEvidence, createJobViews } from "./hub-job-views.mjs";
import { createHubJobsTransport } from "./hub-jobs-graph.mjs";
import { createOwnerJobsSource } from "./hub-jobs-auth.mjs";

const view = document.querySelector("#view");
const status = document.querySelector("#session");
const refresh = document.querySelector("#refresh");
const nav = [...document.querySelectorAll("nav a")];
const jobs = createJobViews({onChange:render});
const labels = {
  "not-connected":"Open this tab inside Microsoft Teams.",
  "not-owner":"This preview is only available to the owner.",
  "access-unavailable":"Microsoft access to Hub Jobs is unavailable. Check the app and list permissions.",
  connected:"Hub Jobs is connected, read-only."
};
let revision = 0, timer = null, hostReady = false;
const line = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
function render() {
  const requested = routeFromHash(location.hash);
  const route = requested === "needs" ? "needs" : "today";
  const page = {...stateFor(route), ...jobs.view(route)};
  for (const a of nav) {
    if (a.hash === "#" + route) a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
  }
  const title = line("h2",page.title);
  title.id = "view-title";
  view.replaceChildren(line("p",page.label), title, line("p",page.explanation));
  appendJobEvidence(view, document, page);
}
function clear() {
  revision++;
  clearTimeout(timer);
  timer = null;
  jobs.clear();
  refresh.hidden = true;
}
async function check() {
  clear();
  const expected = revision;
  const active = () => expected === revision && document.visibilityState === "visible";
  if (!active() || window.self === window.top) {
    status.textContent = labels["not-connected"];
    return;
  }
  status.textContent = "Checking Microsoft access…";
  const acquired = await createOwnerJobsSource({
    teams:globalThis.microsoftTeams,
    createNestablePublicClientApplication:globalThis.msal?.createNestablePublicClientApplication,
    createTransport:createHubJobsTransport,
    fetchPage:(url, options) => fetch(url, {...options, signal:AbortSignal.timeout(20000)}),
    active
  });
  if (!active()) return;
  hostReady = ["connected","access-unavailable"].includes(acquired.state);
  status.textContent = labels[acquired.state];
  refresh.hidden = !hostReady;
  if (acquired.state !== "connected") return;
  let verified = false;
  try {
    verified = await jobs.refresh(acquired.source);
  } catch {}
  if (!active()) return;
  if (!verified) {
    jobs.clear();
    status.textContent = "Could not read Hub Jobs. No old results are shown.";
  }
  timer = setTimeout(check, 15 * 60 * 1000);
}
window.addEventListener("hashchange", render);
window.addEventListener("focus", () => { if (hostReady) void check(); });
window.addEventListener("pagehide", clear);
window.addEventListener("pageshow", event => { if (event.persisted) void check(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void check();
  else clear();
});
refresh.addEventListener("click", () => { if (hostReady) void check(); });
render();
void check();
