import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Services no longer have their own pages; old links open the request form with that service chosen.
  redirects() {
    return [{ source: "/services/:slug((?!request$)[a-z0-9-]+)", destination: "/services/request?service=:slug", permanent: true }];
  },
  partialPrefetching: true,
  experimental: {
    // The persisted dev cache served stale CSS (Tailwind output) across restarts on this
    // NTFS drive, so new theme tokens never reached the browser. Recompile on each start.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
