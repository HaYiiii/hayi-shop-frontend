import type { NextConfig } from "next";

// Upstream API as the Next.js server reaches it (also used by Server Components for the public API).
const apiOrigin = process.env.HAYI_API_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser calls the API only on this origin (Decision AU1, API 01-security §2): path, method, body, headers and
  // `Set-Cookie` pass through unchanged, so the HttpOnly cookies and `hy_c_csrf` belong to this host. Only this web's
  // surface and the public API; never `/api/backoffice`.
  async rewrites() {
    return [
      { source: "/api/customer/:path*", destination: `${apiOrigin}/api/customer/:path*` },
      { source: "/api/public/:path*", destination: `${apiOrigin}/api/public/:path*` },
    ];
  },
};

export default nextConfig;
