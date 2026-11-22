import type { NextConfig } from "next";

// Backend origin as the Next.js server reaches it (also used by Server Components for the public API).
const apiOrigin = process.env.HAYI_API_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser calls the Customer API on this origin, so the HttpOnly session cookies (Path=/api/customer) and
  // `hy_c_csrf` belong to this host and JS can read the CSRF cookie (API 01-security §3.1; agreed on FE #70, like the
  // Backoffice Vite proxy). Production routing is settled at Deployment.
  async rewrites() {
    return [{ source: "/api/customer/:path*", destination: `${apiOrigin}/api/customer/:path*` }];
  },
};

export default nextConfig;
