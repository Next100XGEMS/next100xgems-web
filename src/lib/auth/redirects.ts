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

  if (
    destination.origin !== REDIRECT_ORIGIN ||
    !(destination.pathname === "/admin" || destination.pathname.startsWith("/admin/"))
  ) {
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
