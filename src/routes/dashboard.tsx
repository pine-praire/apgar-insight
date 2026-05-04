import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getVerdict } from "@/lib/apgar";
import { PROCRASTINATION_TYPES, type ProcrastinationType } from "@/lib/procrastination";
import { ApgarCircle } from "@/components/apgar-circle";
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

interface ProcResult {
  id: string;
  types: string[];
  created_at: string;
}

function Dashboard() {
  const { user, loading, displayName, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<ApgarResult[]>([]);
  const [procResults, setProcResults] = useState<ProcResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

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
        .order("created_at", { ascending: false }),
    ]).then(([apgarRes, procRes]) => {
      setResults((apgarRes.data as unknown as ApgarResult[]) ?? []);
      setProcResults((procRes.data as unknown as ProcResult[]) ?? []);
      setLoadingResults(false);
    });
  }, [user]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !user) return null;

  const latestApgar = results[0];
  const latestProc = procResults[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <div className="mx-auto max-w-5xl px-6 py-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Здравствуйте,</p>
            <h1 className="text-3xl font-bold">{displayName || user.email}</h1>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button asChild variant="ghost" size="icon" aria-label="Администрирование">
                <Link to="/admin"><Shield className="h-5 w-5" /></Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Выйти">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Test cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 flex flex-col" style={{ boxShadow: "var(--shadow-soft)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">APGAR-тест</p>
            <h2 className="mt-2 text-lg font-semibold leading-tight">Оцените свой стресс</h2>
            <p className="mt-1 text-sm text-muted-foreground">5 вопросов · около 2 минут</p>
            <div className="mt-auto pt-5">
              <Button asChild size="sm" className="w-full">
                <Link to="/test"><Plus className="mr-2 h-4 w-4" /> Пройти тест</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 flex flex-col" style={{ boxShadow: "var(--shadow-soft)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Тип прокрастинатора</p>
            {latestProc ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  {(latestProc.types as ProcrastinationType[]).map((t) => (
                    <span key={t} className="text-2xl">{PROCRASTINATION_TYPES[t]?.emoji}</span>
                  ))}
                  <h2 className="text-lg font-semibold leading-tight">
                    {(latestProc.types as ProcrastinationType[]).map((t) => PROCRASTINATION_TYPES[t]?.title).join(" + ")}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(latestProc.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </p>
                <div className="mt-auto pt-5">
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/procrastination">Пройти снова</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-lg font-semibold leading-tight">Узнайте свой тип</h2>
                <p className="mt-1 text-sm text-muted-foreground">12 вопросов · около 3 минут</p>
                <div className="mt-auto pt-5">
                  <Button asChild size="sm" className="w-full">
                    <Link to="/procrastination"><Plus className="mr-2 h-4 w-4" /> Пройти тест</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Circle tracker + Advice panel */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">

          {/* Circle tracker */}
          <div className="rounded-2xl border bg-card p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Трекер этого месяца
            </h2>
            <ApgarCircle results={results} />
          </div>

          {/* Advice panel */}
          <div className="rounded-2xl border bg-card p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Рекомендации
            </h2>
            {!latestApgar && !latestProc ? (
              <p className="text-sm text-muted-foreground">
                Пройдите хотя бы один тест, чтобы получить персональные рекомендации.
              </p>
            ) : (
              <div className="space-y-5">
                {latestApgar && (() => {
                  const v = getVerdict(latestApgar.score);
                  const color = v.level === "good" ? "var(--success)" : v.level === "warning" ? "var(--warning)" : "var(--destructive)";
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold" style={{ color }}>{latestApgar.score}</span>
                        <span className="text-sm font-medium">{v.short}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                    </div>
                  );
                })()}

                {latestApgar && latestProc && (
                  <div className="border-t" />
                )}

                {latestProc && (() => {
                  const types = latestProc.types as ProcrastinationType[];
                  const info = PROCRASTINATION_TYPES[types[0]];
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{info.emoji}</span>
                        <span className="text-sm font-medium">{types.map((t) => PROCRASTINATION_TYPES[t].title).join(" + ")}</span>
                      </div>
                      <ul className="space-y-2">
                        {info.tools.map((tool, i) => {
                          const colon = tool.indexOf(":");
                          const title = colon > -1 ? tool.slice(0, colon) : tool;
                          const body = colon > -1 ? tool.slice(colon + 1).trim() : "";
                          return (
                            <li key={i} className="flex gap-2 text-sm">
                              <span
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
                                style={{ background: "var(--primary)" }}
                              >
                                {i + 1}
                              </span>
                              <span className="text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground">{title}.</span>{body && ` ${body}`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* History section */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">

          {/* APGAR history */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">История APGAR</h2>
            {loadingResults ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет результатов — пройдите первый тест!</p>
            ) : (
              <ul className="space-y-2">
                {results.map((r) => {
                  const v = getVerdict(r.score);
                  return (
                    <li key={r.id} className="flex items-center justify-between rounded-xl border bg-card px-5 py-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="mt-0.5 font-medium">{v.short}</p>
                      </div>
                      <div
                        className="text-3xl font-bold"
                        style={{ color: v.level === "good" ? "var(--success)" : v.level === "warning" ? "var(--warning)" : "var(--destructive)" }}
                      >
                        {r.score}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Procrastination history */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">История типа прокрастинатора</h2>
            {loadingResults ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : procResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет результатов — пройдите тест!</p>
            ) : (
              <ul className="space-y-2">
                {procResults.map((r) => {
                  const types = r.types as ProcrastinationType[];
                  return (
                    <li key={r.id} className="flex items-center justify-between rounded-xl border bg-card px-5 py-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="mt-0.5 font-medium">
                          {types.map((t) => PROCRASTINATION_TYPES[t]?.title).join(" + ")}
                        </p>
                      </div>
                      <div className="text-2xl">
                        {types.map((t) => PROCRASTINATION_TYPES[t]?.emoji).join("")}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
