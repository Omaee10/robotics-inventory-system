"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/sessionContext";

/** Mentor landing after sign-in: pick FRC or FTC admin (separate inventory + activity log). */
export default function AdminProgramPickerPage() {
  const router = useRouter();
  const { session, sessionHydrated, logout } = useSession();

  useEffect(() => {
    if (!sessionHydrated) return;
    if (session === null) router.replace("/");
    else if (session.role !== "mentor") router.replace("/dashboard");
  }, [session, sessionHydrated, router]);

  if (!sessionHydrated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  if (!session || session.role !== "mentor") return null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-24 h-24 flex items-center justify-center">
            <Image
              src="/itkan-logo.png"
              alt="ITKAN Logo"
              width={96}
              height={96}
              className="invert"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Choose which program to manage</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-8">
          <p className="text-slate-500 text-sm text-center mb-6">
            Inventory, exports, and activity logs are separate per program. Open the section you need.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/admin/frc"
              className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-3 border border-gray-200 text-center"
            >
              <span className="text-lg font-black tracking-tight">FRC</span>
              <span className="text-slate-400 font-normal text-sm">
                FIRST Robotics Competition
              </span>
            </Link>
            <Link
              href="/admin/ftc"
              className="w-full py-5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-base transition-colors shadow-sm flex flex-col items-center justify-center gap-0.5 border border-orange-700 text-center"
            >
              <span className="text-lg font-black tracking-tight">FTC</span>
              <span className="text-orange-100 font-normal text-sm">
                FIRST Tech Challenge
              </span>
            </Link>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="w-full mt-6 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
