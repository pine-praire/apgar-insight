import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? "signup" : "login",
  }),
  component: AuthPage,
});

type View = "login" | "signup" | "forgot";

function AuthPage() {
  const { mode } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>(mode === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setView(mode === "signup" ? "signup" : "login"), [mode]);
  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Письмо отправлено — проверьте почту");
        setView("login");
      } else if (view === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Регистрация успешна!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("С возвращением!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<View, string> = {
    login: "Вход",
    signup: "Регистрация",
    forgot: "Восстановление пароля",
  };

  const subtitles: Record<View, string> = {
    login: "Войдите, чтобы продолжить",
    signup: "Создайте аккаунт, чтобы пройти тест",
    forgot: "Введите email — мы пришлём ссылку для сброса пароля",
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← На главную
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{titles[view]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitles[view]}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {view === "signup" && (
            <div>
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как вас зовут"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {view !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Пароль</Label>
                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {view === "signup" && (
            <p className="text-xs text-muted-foreground">
              Регистрируясь, вы соглашаетесь с нашей{" "}
              <Link
                to="/privacy"
                className="text-primary underline underline-offset-2"
              >
                Политикой конфиденциальности
              </Link>
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "..."
              : view === "forgot"
                ? "Отправить письмо"
                : view === "signup"
                  ? "Зарегистрироваться"
                  : "Войти"}
          </Button>
        </form>

        {view !== "forgot" ? (
          <button
            onClick={() => setView(view === "signup" ? "login" : "signup")}
            className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {view === "signup"
              ? "Уже есть аккаунт? Войти"
              : "Нет аккаунта? Зарегистрироваться"}
          </button>
        ) : (
          <button
            onClick={() => setView("login")}
            className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            ← Вернуться ко входу
          </button>
        )}
      </div>
    </div>
  );
}
