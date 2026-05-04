import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div
          className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
        >
          <Activity className="h-8 w-8" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          САМОВЫВОЗ
        </h1>
        <p className="mt-3 text-xl font-medium text-primary">Тесты, трекеры, подсказки</p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="px-8">
            <Link to="/auth" search={{ mode: "signup" }}>
              Зарегистрироваться
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="px-8">
            <Link to="/auth" search={{ mode: "login" }}>
              Войти
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
