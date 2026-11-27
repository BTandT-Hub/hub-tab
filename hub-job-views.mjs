import { jobView, readHubJobs } from "./hub-jobs.mjs";

export function createJobViews({ onChange = () => {}, now = Date.now } = {}) {
  let revision = 0;
  let snapshot = null;
  let session = null;
  let stillCurrent = null;
  return {
    clear() {
      revision++;
      snapshot = session = stillCurrent = null;
      onChange();
    },
    view(route) {
      if (session && !stillCurrent?.(session)) return jobView({ state: "not-available" }, route, now());
      if (snapshot?.state === "checking") return { label: "Checking Hub Jobs", items: [] };
      return jobView(snapshot ?? { state: "not-connected" }, route, now());
    },
    async refresh(source) {
      const expected = ++revision;
      session = source?.session ?? null;
      stillCurrent = typeof source?.stillCurrent === "function" ? source.stillCurrent : null;
      snapshot = { state: "checking" };
      onChange();
      const result = await readHubJobs({ ...source, now });
      if (revision !== expected) return false;
      snapshot = result;
      onChange();
      return result.state === "verified";
    }
  };
}

export function appendJobEvidence(container, doc, page) {
  if (page.checkedAt) {
    const p = doc.createElement("p");
    const time = doc.createElement("time");
    time.dateTime = page.checkedAt;
    time.textContent = new Date(page.checkedAt).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" }) + " Melbourne time";
    p.append("Checked ", time);
    container.append(p);
  }
  if (!page.items.length) return;
  const list = doc.createElement("ul");
  for (const item of page.items) {
    const li = doc.createElement("li");
    li.textContent = "#" + item.id + " " + item.title + " (" + item.status + ")";
    list.append(li);
  }
  container.append(list);
}
