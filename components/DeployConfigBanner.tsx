"use client";

/**
 * NEXT_PUBLIC_* vars are inlined at build time. If Netlify/Vercel builds without
 * them, Supabase requests fail with TypeError: Failed to fetch.
 */
export default function DeployConfigBanner() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const configured =
    typeof url === "string" &&
    url.trim().length > 0 &&
    typeof key === "string" &&
    key.trim().length > 0 &&
    !url.includes("build-placeholder");

  if (configured) return null;

  return (
    <div
      role="alert"
      className="bg-amber-400 text-amber-950 text-center text-sm font-medium py-2.5 px-4 border-b border-amber-500"
    >
      Supabase is not configured for this deploy. In Netlify go to{" "}
      <strong>Site configuration → Environment variables</strong> and set{" "}
      <code className="font-mono text-xs bg-amber-300/80 px-1 rounded">
        NEXT_PUBLIC_SUPABASE_URL
      </code>{" "}
      and{" "}
      <code className="font-mono text-xs bg-amber-300/80 px-1 rounded">
        NEXT_PUBLIC_SUPABASE_ANON_KEY
      </code>{" "}
      (same as your <code className="font-mono text-xs">.env.local</code>), then
      trigger a new deploy.
    </div>
  );
}
