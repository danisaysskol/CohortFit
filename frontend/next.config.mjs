/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained production server (.next/standalone) so the Docker
  // runtime image is small and routes are pre-compiled — navigation is instant,
  // unlike the dev server which compiles each route on first visit.
  output: "standalone",
};

export default nextConfig;
