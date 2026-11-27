// Fixed Graph Hub Jobs transport for the approved, delegated owner session.
const ORIGIN = "https://graph.microsoft.com";
const GUID = "[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}";
const SITE = new RegExp("^[a-zA-Z0-9.-]+[.]sharepoint[.]com," + GUID + "," + GUID + "$");
const LIST = new RegExp("^" + GUID + "$");

export function createHubJobsTransport({ siteId, listId, acquireToken, fetchPage, stillCurrent } = {}) {
  if (typeof siteId !== "string" || !SITE.test(siteId) || typeof listId !== "string" || !LIST.test(listId) ||
      typeof acquireToken !== "function" || typeof fetchPage !== "function" || typeof stillCurrent !== "function") {
    throw new Error("Hub Jobs transport is not configured");
  }
  const collection = ORIGIN + "/v1.0/sites/" + siteId + "/lists/" + listId + "/items";
  const first = collection + "?$expand=fields($select=Title,Status)&$top=100";
  function sameCollection(url) {
    if (typeof url !== "string" || url.length > 16384 || /[\s#]/.test(url)) return false;
    // Treat the continuation as opaque after the question mark, but never send a token off the fixed collection.
    const q = url.indexOf("?");
    return q > 0 && url.slice(0, q) === collection && q < url.length - 1;
  }
  return async ({ session, cursor = null } = {}) => {
    if (!session || session.owner !== true || session.hubJobsRead !== true || !stillCurrent(session)) {
      throw new Error("Hub Jobs source unavailable for this session");
    }
    const url = cursor === null ? first : cursor;
    if (!sameCollection(url)) throw new Error("Hub Jobs continuation is outside the configured source");
    const token = await acquireToken(session);
    if (!stillCurrent(session) || typeof token !== "string" || !token || /\s/.test(token)) {
      throw new Error("Hub Jobs session could not be verified");
    }
    const response = await fetchPage(url, {
      method: "GET", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    });
    if (!response?.ok || !stillCurrent(session)) throw new Error("Hub Jobs source could not be read");
    const data = await response.json();
    if (!stillCurrent(session) || !Array.isArray(data?.value)) throw new Error("Hub Jobs response could not be verified");
    const nextCursor = Object.hasOwn(data, "@odata.nextLink") ? data["@odata.nextLink"] : null;
    if (nextCursor !== null && !sameCollection(nextCursor)) throw new Error("Hub Jobs continuation could not be verified");
    return {
      items: data.value.map(item => ({
        id: item?.id, fields: { Title: item?.fields?.Title, Status: item?.fields?.Status }
      })),
      nextCursor
    };
  };
}
