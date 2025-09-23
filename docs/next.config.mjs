import { createRequire } from "node:module";
import { createMDX } from "fumadocs-mdx/next";

const require = createRequire(import.meta.url);
const withMdx = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Make sure base64-js and ieee754 resolve correctly
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      "base64-js": require.resolve("base64-js"),
      ieee754: require.resolve("ieee754"),
    };

    return config;
  },
};

export default withMdx(config);
