import {routeFromHash,stateFor} from './hub-model.mjs';
import {mountAskBox} from './ask-box.mjs';
const view = document.querySelector("#view");
const ask = document.querySelector("#ask");
const nav = [...document.querySelectorAll("nav a")];
const line = (tag, text) => { const el=document.createElement(tag); el.textContent=text; return el; };
function render() {
  const route=routeFromHash(location.hash);
  const page=stateFor(route);
  for (const a of nav) {
    if (a.hash === "#"+route) a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
  }
  const title=line("h2",page.title);
  title.id="view-title";
  view.replaceChildren(line("p",page.label), title, line("p",page.explanation));
}
window.addEventListener("hashchange", render);
render();
mountAskBox(ask);
