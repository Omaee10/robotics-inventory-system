"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-2">
        404
      </p>
      <h1 className="text-2xl font-bold text-center mb-2">Page not found</h1>
      {pathname ? (
        <p className="text-gray-500 text-xs font-mono mb-4 px-3 py-1 rounded-lg bg-gray-900 border border-gray-800">
          {pathname}
        </p>
      ) : null}
      <p className="text-gray-400 text-sm text-center max-w-md mb-2">
        Only these routes exist:{" "}
        <span className="text-gray-300 font-mono">/</span> (home),{" "}
        <span className="text-gray-300 font-mono">/dashboard</span> (students),{" "}
        <span className="text-gray-300 font-mono">/admin</span> (mentors).
      </p>
      <p className="text-gray-500 text-xs text-center max-w-md mb-8">
        Tip: the project folder is named <code className="text-gray-400">app</code>{" "}
        — but the URL is <span className="text-gray-300 font-mono">/</span>, not{" "}
        <span className="text-gray-300 font-mono">/app</span>.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
        >
          Home
        </Link>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl border border-gray-600 text-white text-sm font-semibold hover:bg-gray-900 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/admin"
          className="px-5 py-2.5 rounded-xl border border-gray-600 text-white text-sm font-semibold hover:bg-gray-900 transition-colors"
        >
          Admin
        </Link>
      </div>
    </div>
  );
}
