import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Activity, Heart, Sparkles } from "lucide-react";

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
          APGAR-тест <span className="text-primary">для взрослых</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Экспресс-оценка состояния по методике APGAR. Пять параметров,
          понятная шкала и рекомендации по результатам.
        </p>

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

        <div className="mt-20 grid w-full gap-6 md:grid-cols-3">
          {[
            { icon: Sparkles, title: "5 параметров", text: "A · P · G · A · R — комплексный взгляд" },
            { icon: Heart, title: "0–10 баллов", text: "Понятная шкала с расшифровкой" },
            { icon: Activity, title: "История", text: "Отслеживайте динамику со временем" },
          ].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border bg-card p-6 text-left"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
