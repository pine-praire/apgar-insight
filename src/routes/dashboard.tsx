import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getVerdict } from "@/lib/apgar";
import { PROCRASTINATION_TYPES, type ProcrastinationType } from "@/lib/procrastination";
import { LogOut, Plus, Shield } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

interface ApgarResult {
  id: string;
  score: number;
  scores: Record<string, number>;
  created_at: string;
}

interface ProcrastinationResult {
  id: string;
  types: string[];
  created_at: string;
}

function Dashboard() {
  const { user, loading, displayName, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<ApgarResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [lastProcrastination, setLastProcrastination] = useState<ProcrastinationResult | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("apgar_results")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("procrastination_results")
        .select("id, types, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([apgarRes, procRes]) => {
      setResults((apgarRes.data as unknown as ApgarResult[]) ?? []);
      setLastProcrastination((procRes.data as unknown as ProcrastinationResult) ?? null);
      setLoadingResults(false);
    });
  }, [user]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Здравствуйте,</p>
            <h1 className="text-3xl font-bold">{displayName || user.email}</h1>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button asChild variant="ghost" size="icon" aria-label="Администрирование">
                <Link to="/admin">
                  <Shield className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Выйти">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Test cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* APGAR card */}
          <div
            className="rounded-2xl border bg-card p-6 flex flex-col"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              APGAR-тест
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-tight">
              Оцените свой стресс
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              5 вопросов · около 2 минут
            </p>
            <div className="mt-auto pt-5">
              <Button asChild size="sm" className="w-full">
                <Link to="/test">
                  <Plus className="mr-2 h-4 w-4" /> Пройти тест
                </Link>
              </Button>
            </div>
          </div>

          {/* Procrastination card */}
          <div
            className="rounded-2xl border bg-card p-6 flex flex-col"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Тип прокрастинатора
            </p>
            {lastProcrastination ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  {(lastProcrastination.types as ProcrastinationType[]).map((t) => (
                    <span key={t} className="text-2xl">
                      {PROCRASTINATION_TYPES[t]?.emoji}
                    </span>
                  ))}
                  <h2 className="text-lg font-semibold leading-tight">
                    {(lastProcrastination.types as ProcrastinationType[])
                      .map((t) => PROCRASTINATION_TYPES[t]?.title)
                      .join(" + ")}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(lastProcrastination.created_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <div className="mt-auto pt-5">
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/procrastination">Пройти снова</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-lg font-semibold leading-tight">
                  Узнайте свой тип
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  12 вопросов · около 3 минут
                </p>
                <div className="mt-auto pt-5">
                  <Button asChild size="sm" className="w-full">
                    <Link to="/procrastination">
                      <Plus className="mr-2 h-4 w-4" /> Пройти тест
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* APGAR history */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">История APGAR</h2>
          {loadingResults ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока нет результатов — пройдите первый тест!
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => {
                const v = getVerdict(r.score);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border bg-card px-5 py-4"
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-0.5 font-medium">{v.short}</p>
                    </div>
                    <div
                      className="text-3xl font-bold"
                      style={{
                        color:
                          v.level === "good"
                            ? "var(--success)"
                            : v.level === "warning"
                              ? "var(--warning)"
                              : "var(--destructive)",
                      }}
                    >
                      {r.score}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
