import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openuidev/react-ui",
    "@openuidev/react-lang",
    "@openuidev/react-headless",
    "@openuidev/lang-core"
  ],
  async headers() {
    // Simulations run in sandboxed iframes (opaque origin), so fonts they load need CORS.
    return [{ source: "/vendor/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
