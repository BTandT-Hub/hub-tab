// The tab shows only the registered owner. Entra app assignment and SharePoint
// ACLs are the security boundary; do not use this UI check in place of them.
export const TENANT_ID = "53a25177-3aa9-4203-ba74-deb75d5fe464";
export const CLIENT_ID = "14e21b7f-8231-44d6-8c0d-542a5e48b0c2";
const OWNER_ID = "13b042f4-001e-46cb-b2cb-0843d5f17b9a";
export const JOBS_SITE = "btandt.sharepoint.com,b70901ff-91af-443e-9804-c0d863edd0f2,246285fe-ffe7-49fd-b48c-0bf4c75fef33";
export const JOBS_LIST = "772ef809-c1ec-4c13-b7ce-31b8c549b993";
// Temporary owner-only pilot scope. Replace with selected-list read before staff (T3).
export const JOBS_SCOPE = "Sites.Read.All";
const GRAPH_SCOPE = "https://graph.microsoft.com/" + JOBS_SCOPE;
const ownerSession = Object.freeze({owner:true, hubJobsRead:true});
const lower = value => typeof value === "string" ? value.toLowerCase() : "";
const isOwnerContext = context =>
  lower(context?.user?.id) === OWNER_ID && lower(context?.user?.tenant?.id) === TENANT_ID;
const isOwnerAccount = account =>
  lower(account?.localAccountId) === OWNER_ID && lower(account?.tenantId) === TENANT_ID;
const hasJobsScope = scopes => Array.isArray(scopes) && scopes.some(scope =>
  lower(scope) === lower(JOBS_SCOPE) || lower(scope) === lower(GRAPH_SCOPE));

// Only Teams-embedded silent broker auth. No fallback scope, interactive
// consent, persisted token or data, redirects, app-only path, or write route.
export async function createOwnerJobsSource({
  teams, createNestablePublicClientApplication, createTransport, fetchPage, active
} = {}) {
  const hold = {state:"not-connected"};
  if (!teams?.app?.initialize || !teams?.app?.getContext || !active?.() ||
      typeof createNestablePublicClientApplication !== "function") return hold;
  try {
    await teams.app.initialize();
    const context = await teams.app.getContext();
    if (!active()) return hold;
    if (!isOwnerContext(context)) return {state:"not-owner"};
    const auth = {clientId: CLIENT_ID, authority: "https://login.microsoftonline.com/" + TENANT_ID,
      supportsNestedAppAuth: true};
    const app = await createNestablePublicClientApplication({auth, cache:{cacheLocation:"memoryStorage"}});
    if (!active()) return hold;
    const activeAccount = app.getActiveAccount?.();
    if (activeAccount && !isOwnerAccount(activeAccount)) return {state:"not-owner"};
    const account = activeAccount ?? app.getAccount?.({localAccountId:OWNER_ID, tenantId:TENANT_ID}) ?? undefined;
    if (account && !isOwnerAccount(account)) return {state:"not-owner"};
    const acquire = async () => {
      if (!active() || !isOwnerContext(await teams.app.getContext()) || !active()) return null;
      // With no cached account, an owner-matched Teams context may supply its
      // login hint to the broker. A successful response must still match the owner.
      const request = {scopes:[GRAPH_SCOPE], ...(account ? {account} :
        context.user.loginHint ? {loginHint:context.user.loginHint} : {})};
      const token = await app.acquireTokenSilent(request);
      if (!active() || !isOwnerAccount(token?.account) || !hasJobsScope(token?.scopes) ||
          typeof token?.accessToken !== "string" || !token.accessToken || /\s/.test(token.accessToken)) return null;
      if (!isOwnerContext(await teams.app.getContext()) || !active()) return null;
      return token.accessToken;
    };
    // Make the initial denial explicit. Subsequent pages independently
    // revalidate the authenticated account and browser session.
    let firstToken = await acquire();
    if (!firstToken) return {state:"access-unavailable"};
    const stillCurrent = session => active() && session === ownerSession;
    const validateContext = async () => active() && isOwnerContext(await teams.app.getContext()) && active();
    const getPage = createTransport({siteId:JOBS_SITE, listId:JOBS_LIST, stillCurrent,
      fetchPage: async (url, options) => {
        if (!await validateContext()) return null;
        const res = await fetchPage(url, options);
        if (!await validateContext()) return null;
        return {ok:res.ok, json:async () => {
          const data = await res.json();
          return await validateContext() ? data : null;
        }};
      },
      acquireToken: async () => {
        const initial = firstToken;
        firstToken = null;
        if (initial && active() && isOwnerContext(await teams.app.getContext()) && active()) return initial;
        return acquire();
      }});
    return {state:"connected", source:{session:ownerSession, stillCurrent, getPage}};
  } catch {
    return {state:active() ? "access-unavailable" : "not-connected"};
  }
}
