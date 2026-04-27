import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure data/biblia.json (and biblia.embeddings.json when present) are
  // bundled with the serverless function on Vercel. Without this, the
  // fs.readFileSync calls in lib/bible.ts can't find the data files.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/**/*"],
  },
  // Hide the Next.js dev-mode "N" badge in the corner of the page.
  devIndicators: false,
};

export default nextConfig;
