// Hub Jobs read model. The caller supplies the approved, session-bound Graph transport.
// This module does not sign in, fetch arbitrary URLs, write, or act as an access control.
const ACTIVE = new Set(["New", "Queued", "Doing", "Checking", "Blocked", "Needs Evan"]);
const DECISION = "Needs Evan";
const MAX_PAGES = 8;
const MAX_ROWS = 800;
const MAX_AGE_MS = 30 * 60 * 1000;

export function projectHubJobs(items) {
  if (!Array.isArray(items)) return null;
  const jobs = [];
  const ids = new Set();
  for (const item of items) {
    const match = typeof item?.id === "string" && /^[1-9][0-9]{0,14}$/.test(item.id);
    const fields = item?.fields;
    const title = typeof fields?.Title === "string" ? fields.Title.trim() : "";
    const status = fields?.Status;
    if (!match || ids.has(item.id) || !title || typeof status !== "string" || !status.trim()) return null;
    ids.add(item.id);
    if (!ACTIVE.has(status) && status !== "Done" && status !== "Closed" && status !== "Cancelled") return null;
    if (ACTIVE.has(status)) jobs.push(Object.freeze({ id: item.id, title: title.slice(0, 200), status }));
  }
  return Object.freeze({
    today: Object.freeze(jobs),
    needs: Object.freeze(jobs.filter(job => job.status === DECISION))
  });
}

// The session must be backed by authenticated identity and the Hub Jobs source grant.
// Until staff ACLs are independently verified, only the owner view is supported.
export async function readHubJobs({ session, getPage, stillCurrent, now = Date.now } = {}) {
  const result = (state, extra = {}) => Object.freeze({ state, ...extra });
  if (!session || typeof getPage !== "function" || typeof stillCurrent !== "function") {
    return result("not-connected");
  }
  if (session.owner !== true || session.hubJobsRead !== true || !stillCurrent(session)) {
    return result("not-available");
  }
  const collected = [];
  const visited = new Set();
  let cursor = null;
  for (let n = 0; n < MAX_PAGES; n++) {
    let page;
    try {
      page = await getPage({ session, cursor });
    } catch {
      return result(stillCurrent(session) ? "unavailable" : "not-available");
    }
    if (!stillCurrent(session)) return result("not-available");
    if (!page || !Array.isArray(page.items) || !Object.hasOwn(page, "nextCursor")) return result("unavailable");
    if (collected.length + page.items.length > MAX_ROWS) return result("incomplete");
    collected.push(...page.items);
    if (page.nextCursor === null) {
      const jobs = projectHubJobs(collected);
      const checkedAt = now();
      if (!jobs || !Number.isFinite(checkedAt) || Math.abs(checkedAt) > 8.64e15) return result("unavailable");
      return result("verified", { jobs, checkedAt: new Date(checkedAt).toISOString() });
    }
    if (typeof page.nextCursor !== "string" || !page.nextCursor || visited.has(page.nextCursor)) {
      return result("incomplete");
    }
    visited.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  return result("incomplete");
}

export function jobView(snapshot, route, now = Date.now()) {
  if (route !== "today" && route !== "needs") return { items: [], label: "Not a Hub Jobs view" };
  const labels = {
    "not-connected": "Not connected",
    "not-available": "Not available with this access",
    unavailable: "Could not verify Hub Jobs",
    incomplete: "Hub Jobs results are incomplete"
  };
  if (snapshot?.state !== "verified") {
    const state = snapshot?.state;
    return { items: [], label: Object.hasOwn(labels, state) ? labels[state] : labels.unavailable };
  }
  const items = snapshot.jobs?.[route];
  const at = Date.parse(snapshot.checkedAt);
  if (!Array.isArray(items) || !Number.isFinite(at) || !Number.isFinite(now) || now < at || now - at > MAX_AGE_MS) {
    return { items: [], label: "Hub Jobs needs a fresh check" };
  }
  return { items, checkedAt: snapshot.checkedAt, label: items.length ? "Verified Hub Jobs" : "No matching records" };
}
