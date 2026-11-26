const pages = Object.freeze({
  today: {title:"Today", explanation:"Current jobs and their evidence."},
  needs: {title:"Needs you", explanation:"Decisions that need your attention."},
  takings: {title:"Daily Take", explanation:"Owner-only reconciliation and posting evidence."},
  orders: {title:"Purchase orders", explanation:"Drafts, acknowledgements, ETAs and receipts."}
});
export function routeFromHash(hash) {
  const key = String(hash ?? "").slice(1);
  return Object.hasOwn(pages, key) ? key : "today";
}
export function stateFor(route, {connected=false, allowed=false, snapshot=null}={}) {
  const page = Object.hasOwn(pages, route) ? pages[route] : pages.today;
  if (!connected) return {...page, label:"Not connected", items:[]};
  if (allowed !== true) return {...page, label:"Not available with this access", items:[]};
  if (!Array.isArray(snapshot?.items) || !Number.isFinite(Date.parse(snapshot.checkedAt))) {
    return {...page, label:"No verified data available", items:[]};
  }
  return {...page, label:snapshot.items.length ? "Verified source" : "No matching records", items:snapshot.items, checkedAt:snapshot.checkedAt};
}
