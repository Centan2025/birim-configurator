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
  if (!requestHeaders.has("x-modul-resolved-tenant-slug")) {
    requestHeaders.set("x-modul-resolved-tenant-slug", resolvedSlug);
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Modul-Tenant-Slug", resolvedSlug);
  if (hostHeader.endsWith(".vercel.app")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  // Statik dosyaları (3B .glb modelleri, görseller, fontlar, scriptler) middleware'den muaf tutarak
  // Vercel CDN → Compute trafiğini ve gereksiz Edge/Function CPU kullanımını önle.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:glb|gltf|svg|png|jpg|jpeg|webp|gif|ico|woff|woff2|ttf|eot|css|js|map|txt|xml|md|hdr|exr)$).*)",
  ],
};
