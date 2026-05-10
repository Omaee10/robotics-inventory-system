"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "@/lib/sessionContext";
import { validateAccessCode } from "@/lib/supabase";
import type { Program, UserRole } from "@/lib/types";

type Step = "role" | "program" | "student-name" | "mentor-code";

export default function LandingPage() {
  const { session, sessionHydrated, setSession } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [pendingProgram, setPendingProgram] = useState<Program | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (session) {
      router.replace(session.role === "mentor" ? "/admin" : "/dashboard");
    }
  }, [session, sessionHydrated, router]);

  const handleStudentEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    const program = pendingProgram ?? "frc";
    setSession({ role: "student", name: trimmed, program });
    router.push("/dashboard");
  };

  const handleMentorEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    const valid = await validateAccessCode(code);
    setLoading(false);
    if (valid) {
      const program = pendingProgram ?? "frc";
      setSession({ role: "mentor", name: "Mentor", program });
      router.push("/admin");
    } else {
      setError("Invalid code. Please try again.");
    }
  };

  const goBackToRole = () => {
    setStep("role");
    setPendingRole(null);
    setPendingProgram(null);
    setError("");
    setName("");
    setCode("");
  };

  const goBackToProgram = () => {
    setStep("program");
    setPendingProgram(null);
    setError("");
    setName("");
    setCode("");
  };

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
          <h1 className="text-2xl font-bold text-white tracking-tight">Robotics Inventory</h1>
          <p className="text-gray-400 text-sm mt-1">Parts Management System</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {step === "role" && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Welcome</h2>
              <p className="text-slate-500 text-sm text-center mb-8">Who are you entering as?</p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPendingRole("student");
                    setStep("program");
                    setError("");
                  }}
                  className="w-full py-4 rounded-2xl bg-black hover:bg-gray-900 text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-3 border border-gray-200"
                >
                  <span className="text-2xl">🎓</span>
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingRole("mentor");
                    setStep("program");
                    setError("");
                    setCode("");
                  }}
                  className="w-full py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-3 border border-gray-200"
                >
                  <span className="text-2xl">🔑</span>
                  Mentor
                </button>
              </div>
            </div>
          )}

          {step === "program" && pendingRole && (
            <div className="p-8">
              <button
                type="button"
                onClick={goBackToRole}
                className="text-xs text-slate-400 hover:text-slate-600 mb-5 flex items-center gap-1 transition-colors"
              >
                ← Back
              </button>
              <div className="mb-6">
                <span className="text-3xl mb-3 block">{pendingRole === "student" ? "🎓" : "🔑"}</span>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Choose program</h2>
                <p className="text-slate-500 text-sm">
                  Inventory is separate for each FIRST program. Pick the one you&apos;re working on.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPendingProgram("frc");
                    setStep(pendingRole === "student" ? "student-name" : "mentor-code");
                    setError("");
                  }}
                  className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-3 border border-gray-200"
                >
                  <span className="text-lg font-black tracking-tight">FRC</span>
                  <span className="text-slate-400 font-normal text-sm">FIRST Robotics Competition</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingProgram("ftc");
                    setStep(pendingRole === "student" ? "student-name" : "mentor-code");
                    setError("");
                  }}
                  className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-3 border border-orange-700"
                >
                  <span className="text-lg font-black tracking-tight">FTC</span>
                  <span className="text-orange-100 font-normal text-sm">FIRST Tech Challenge</span>
                </button>
              </div>
            </div>
          )}

          {step === "student-name" && (
            <form onSubmit={handleStudentEnter} className="p-8">
              <button
                type="button"
                onClick={goBackToProgram}
                className="text-xs text-slate-400 hover:text-slate-600 mb-5 flex items-center gap-1 transition-colors"
              >
                ← Back
              </button>
              <div className="mb-6">
                <span className="text-3xl mb-3 block">🎓</span>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Student Access</h2>
                <p className="text-slate-500 text-sm">
                  <span className="font-semibold text-slate-700 uppercase">{pendingProgram}</span>
                  {" · "}
                  Enter your name so your actions are tracked in the log.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-sm"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-black hover:bg-gray-800 text-white font-bold transition-colors"
                >
                  Enter Inventory →
                </button>
              </div>
            </form>
          )}

          {step === "mentor-code" && (
            <form onSubmit={handleMentorEnter} className="p-8">
              <button
                type="button"
                onClick={goBackToProgram}
                className="text-xs text-slate-400 hover:text-slate-600 mb-5 flex items-center gap-1 transition-colors"
              >
                ← Back
              </button>
              <div className="mb-6">
                <span className="text-3xl mb-3 block">🔑</span>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Mentor Access</h2>
                <p className="text-slate-500 text-sm">
                  <span className="font-semibold text-slate-700 uppercase">{pendingProgram}</span>
                  {" · "}
                  Enter your 6-digit access code to open the admin dashboard.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  autoFocus
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-center tracking-[0.6em] font-bold text-2xl"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-3 rounded-xl bg-black hover:bg-gray-800 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {loading ? "Verifying…" : "Access Admin →"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          FIRST Robotics · FRC &amp; FTC inventory
        </p>
      </div>
    </div>
  );
}
