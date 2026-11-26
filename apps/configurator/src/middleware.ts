import { NextRequest, NextResponse } from "next/server";
import { getTenantProfileByIdOrSlug } from "@birim/core";

export function middleware(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").split(":")[0].trim().toLowerCase();
  const explicitSlug = req.nextUrl.searchParams.get("tenant");

  let resolvedSlug = "birim";
  if (explicitSlug) {
    resolvedSlug = getTenantProfileByIdOrSlug(explicitSlug).slug;
  } else if (hostHeader && hostHeader !== "localhost" && hostHeader !== "127.0.0.1") {
    const byDomain = getTenantProfileByIdOrSlug(hostHeader);
    if (byDomain.brand.customDomain.toLowerCase() === hostHeader) {
      resolvedSlug = byDomain.slug;
    } else if (hostHeader.endsWith(".modul.app") || hostHeader.endsWith(".modul.studio")) {
      const sub = hostHeader.split(".")[0];
      if (sub && sub !== "app" && sub !== "www") {
        resolvedSlug = getTenantProfileByIdOrSlug(sub).slug;
      }
    }
  }

  const requestHeaders = new Headers(req.headers);
  // Always overwrite incoming header so external clients cannot spoof resolved tenant slug
  requestHeaders.set("x-modul-resolved-tenant-slug", resolvedSlug);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const isEmbedRoute = req.nextUrl.pathname.startsWith("/embed/");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!isEmbedRoute) {
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  }
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.headers.set("X-Modul-Tenant-Slug", resolvedSlug);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
