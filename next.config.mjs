/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = (process.env.API_BACKEND_URL || "http://127.0.0.1:5500").replace(/\/$/, "");
    return [
      { source: "/api/auth/:path*", destination: `${backend}/api/auth/:path*` },
      { source: "/api/todos/:path*", destination: `${backend}/api/todos/:path*` },
    ];
  },
};

export default nextConfig;
