import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
    experimental: {
      // Allow importing files from outside the Next.js project directory
      externalDir: true
  },
  webpack: (config, { defaultLoaders }) => {
    // Tell Webpack to transpile code in `../shared` or any other outside directory
    config.module.rules.push({
      test: /\.(tsx?|jsx?)$/,
      include: [
        path.resolve(process.cwd(), '../src'),  // Adjust to your folder path
      ],
      use: defaultLoaders.babel
    });

    return config;
  },
  
};

export default nextConfig;
