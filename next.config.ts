import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openuidev/react-ui",
    "@openuidev/react-lang",
    "@openuidev/react-headless",
    "@openuidev/lang-core"
  ],
};

export default nextConfig;
