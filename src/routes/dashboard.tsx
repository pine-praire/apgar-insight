import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getVerdict } from "@/lib/apgar";
import { LogOut, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

interface Result {
  id: string;
  score: number;
  scores: Record<string, number>;
  created_at: string;
}

function Dashboard() {
  const { user, loading, displayName } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<Result[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("apgar_results")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setResults((data as unknown as Result[]) ?? []);
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Здравствуйте,</p>
            <h1 className="text-3xl font-bold">{displayName || user.email}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Выйти">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div
          className="mt-8 rounded-2xl border bg-card p-8 text-center"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <h2 className="text-2xl font-semibold">Готовы пройти тест?</h2>
          <p className="mt-2 text-muted-foreground">
            5 коротких вопросов · около 2 минут
          </p>
          <Button asChild size="lg" className="mt-6 px-8">
            <Link to="/test">
              <Plus className="mr-2 h-4 w-4" /> Пройти тест
            </Link>
          </Button>
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">История прохождений</h2>
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
