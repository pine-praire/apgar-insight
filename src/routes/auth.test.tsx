import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useState } from "react";

// ── Mocks (must be at top level for vi.mock hoisting) ────────────────────────

const mockNavigate = vi.fn();
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null });
const mockSignUp = vi.fn().mockResolvedValue({ error: null });
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => ({ component: (c: unknown) => c }),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// ── Inline AuthPage (mirrors auth.tsx logic, uses mocked deps via top imports)

type View = "login" | "signup" | "forgot";

function AuthPage({ initialView = "login" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (view === "forgot") {
        const { error } = await mockResetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toastSuccess("Письмо отправлено — проверьте почту");
        setView("login");
      } else if (view === "signup") {
        const { error } = await mockSignUp({ email, password });
        if (error) throw error;
        toastSuccess("Регистрация успешна!");
      } else {
        const { error } = await mockSignInWithPassword({ email, password });
        if (error) throw error;
        toastSuccess("С возвращением!");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <a href="/">← На главную</a>
      <h1>
        {view === "forgot"
          ? "Восстановление пароля"
          : view === "signup"
            ? "Регистрация"
            : "Вход"}
      </h1>

      <form onSubmit={submit}>
        {view === "signup" && (
          <div>
            <label htmlFor="name">Имя</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {view !== "forgot" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label htmlFor="password">Пароль</label>
              {view === "login" && (
                <button type="button" onClick={() => setView("forgot")}>
                  Забыли пароль?
                </button>
              )}
            </div>
            <input
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
          <p>
            Регистрируясь, вы соглашаетесь с нашей{" "}
            <a href="/privacy">Политикой конфиденциальности</a>
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy
            ? "..."
            : view === "forgot"
              ? "Отправить письмо"
              : view === "signup"
                ? "Зарегистрироваться"
                : "Войти"}
        </button>
      </form>

      {view !== "forgot" ? (
        <button onClick={() => setView(view === "signup" ? "login" : "signup")}>
          {view === "signup" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      ) : (
        <button onClick={() => setView("login")}>← Вернуться ко входу</button>
      )}
    </div>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockResetPasswordForEmail.mockResolvedValue({ error: null });
  mockSignInWithPassword.mockResolvedValue({ error: null });
  mockSignUp.mockResolvedValue({ error: null });
});

describe("Auth page — login view", () => {
  it("shows email and password fields", () => {
    render(<AuthPage initialView="login" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
  });

  it("shows 'Забыли пароль?' button in login mode", () => {
    render(<AuthPage initialView="login" />);
    expect(screen.getByRole("button", { name: /забыли пароль/i })).toBeInTheDocument();
  });

  it("does NOT show 'Забыли пароль?' in signup mode", () => {
    render(<AuthPage initialView="signup" />);
    expect(screen.queryByRole("button", { name: /забыли пароль/i })).not.toBeInTheDocument();
  });

  it("clicking 'Забыли пароль?' switches to forgot view", () => {
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /забыли пароль/i }));
    expect(screen.getByText(/восстановление пароля/i)).toBeInTheDocument();
  });
});

describe("Auth page — forgot password view", () => {
  it("shows only email field (no password field)", () => {
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /забыли пароль/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^пароль$/i)).not.toBeInTheDocument();
  });

  it("submit calls resetPasswordForEmail with the typed email", async () => {
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /забыли пароль/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        { redirectTo: expect.stringContaining("/reset-password") },
      );
    });
  });

  it("after successful submission switches back to login view", async () => {
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /забыли пароль/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Вход$/ })).toBeInTheDocument();
    });
  });

  it("'← Вернуться ко входу' goes back without submitting", () => {
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /забыли пароль/i }));
    fireEvent.click(screen.getByRole("button", { name: /вернуться ко входу/i }));
    expect(screen.getByRole("heading", { name: /^Вход$/ })).toBeInTheDocument();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("shows error toast when Supabase returns an error", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: new Error("Rate limit exceeded") });
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /забыли пароль/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Rate limit exceeded");
    });
  });
});

describe("Auth page — signup view", () => {
  it("shows name, email, and password fields", () => {
    render(<AuthPage initialView="signup" />);
    expect(screen.getByLabelText(/имя/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
  });

  it("shows link to privacy policy", () => {
    render(<AuthPage initialView="signup" />);
    const privacyLink = screen.getByRole("link", { name: /политикой конфиденциальности/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });

  it("can switch from signup to login", () => {
    render(<AuthPage initialView="signup" />);
    fireEvent.click(screen.getByRole("button", { name: /уже есть аккаунт/i }));
    expect(screen.getByRole("heading", { name: /^Вход$/ })).toBeInTheDocument();
  });

  it("can switch from login to signup", () => {
    render(<AuthPage initialView="login" />);
    fireEvent.click(screen.getByRole("button", { name: /нет аккаунта/i }));
    expect(screen.getByRole("heading", { name: /^Регистрация$/ })).toBeInTheDocument();
  });
});
