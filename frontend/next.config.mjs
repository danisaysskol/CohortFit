/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained production server (.next/standalone) so the Docker
  // runtime image is small and routes are pre-compiled — navigation is instant,
  // unlike the dev server which compiles each route on first visit.
  output: "standalone",
  // Same-origin API proxy: when API_ORIGIN is set (Vercel prod), the browser only
  // ever calls /api/* on this domain and the backend origin is resolved server-side.
  // This keeps the backend URL out of the client bundle AND out of the repo (it lives
  // only in the API_ORIGIN env var). When API_ORIGIN is unset (e.g. local docker),
  // no rewrite is added and the app talks to NEXT_PUBLIC_API_BASE_URL directly.
  async rewrites() {
    const origin = process.env.API_ORIGIN;
    return origin ? [{ source: "/api/:path*", destination: `${origin}/:path*` }] : [];
  },
};

export default nextConfig;
