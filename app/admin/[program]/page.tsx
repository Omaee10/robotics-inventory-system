"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { useSession } from "@/lib/sessionContext";
import type { Program } from "@/lib/types";

function parseProgramParam(raw: unknown): Program | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") return null;
  const v = s.trim().toLowerCase();
  if (v === "frc" || v === "ftc") return v;
  return null;
}

export default function AdminProgramSectionPage() {
  const params = useParams();
  const router = useRouter();
  const { session, sessionHydrated, setSession } = useSession();
  const program = parseProgramParam(params.program);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (session === null) {
      router.replace("/");
      return;
    }
    if (session.role !== "mentor") {
      router.replace("/dashboard");
      return;
    }
    if (!program) {
      router.replace("/admin");
      return;
    }
    if (session.program !== program) {
      setSession({ ...session, program });
    }
  }, [sessionHydrated, session, program, router, setSession]);

  if (!sessionHydrated || !session || session.role !== "mentor" || !program) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return <AdminDashboard sectionProgram={program} />;
}
