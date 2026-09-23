import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Supabase's own package ships some very recent JS syntax (e.g. class
  // static initialization blocks) that Next.js does NOT compile down for
  // older browsers by default — it only does that for your own source code,
  // not third-party packages in node_modules. This tells it to also compile
  // Supabase's packages down to older, broadly-compatible syntax, which was
  // causing a hard SyntaxError (and a frozen page) on iOS 15 Safari
  // (e.g. an iPhone 6s).
  transpilePackages: [
    '@supabase/supabase-js',
    '@supabase/auth-js',
    '@supabase/postgrest-js',
    '@supabase/realtime-js',
    '@supabase/storage-js',
    '@supabase/functions-js',
  ],
};

export default nextConfig;