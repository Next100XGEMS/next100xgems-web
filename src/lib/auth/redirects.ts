const FALLBACK_NEXT_PATH = "/admin";
const REDIRECT_ORIGIN = "https://next100xgems.local";

export function getSafeNextPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    /%(?:2f|5c|2e)/i.test(value)
  ) {
    return FALLBACK_NEXT_PATH;
  }

  let destination: URL;
  try {
    destination = new URL(value, REDIRECT_ORIGIN);
  } catch {
    return FALLBACK_NEXT_PATH;
  }

  const path = destination.pathname;
  const isAdminPath = path === "/admin" || path.startsWith("/admin/");
  const isProjectConsolePath = path === "/projects" || path.startsWith("/projects/");
  if (destination.origin !== REDIRECT_ORIGIN || !(isAdminPath || isProjectConsolePath)) {
    return FALLBACK_NEXT_PATH;
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function getLoginRedirect(nextPath: string) {
  const params = new URLSearchParams({ next: getSafeNextPath(nextPath) });
  return `/login?${params.toString()}`;
}

export function hasVerifiedClaims(claims: { sub?: unknown } | null | undefined) {
  return typeof claims?.sub === "string" && claims.sub.length > 0;
}
