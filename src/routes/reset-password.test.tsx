import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";

// ── Mock state ────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => ({ component: (c: unknown) => c }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// ── Inline ResetPasswordPage ──────────────────────────────────────────────────

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    mockGetSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) setReady(true);
    });

    const { data: listener } = mockOnAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toastError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      const { error } = await mockUpdateUser({ password });
      if (error) throw new Error(error.message);
      toastSuccess("Пароль успешно изменён");
      mockNavigate({ to: "/dashboard" });
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <a href="/">← На главную</a>
      <h1>Новый пароль</h1>
      {!ready ? (
        <p>Проверка ссылки...</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="password">Новый пароль</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label htmlFor="confirm">Повторите пароль</label>
          <input
            id="confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? "..." : "Сохранить пароль"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("ResetPassword page", () => {
  it("shows 'Проверка ссылки...' while no session exists", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordPage />);
    expect(screen.getByText(/проверка ссылки/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/новый пароль/i)).not.toBeInTheDocument();
  });

  it("shows form when getSession returns a session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/новый пароль/i)).toBeInTheDocument();
    });
  });

  it("shows form when PASSWORD_RECOVERY event fires", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    let capturedCallback: ((event: string) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(<ResetPasswordPage />);
    expect(screen.getByText(/проверка ссылки/i)).toBeInTheDocument();

    capturedCallback!("PASSWORD_RECOVERY");

    await waitFor(() => {
      expect(screen.getByLabelText(/новый пароль/i)).toBeInTheDocument();
    });
  });

  it("shows error when passwords do not match", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/новый пароль/i));

    fireEvent.change(screen.getByLabelText(/новый пароль/i), { target: { value: "abc123" } });
    fireEvent.change(screen.getByLabelText(/повторите пароль/i), { target: { value: "xyz999" } });
    fireEvent.submit(screen.getByLabelText(/новый пароль/i).closest("form")!);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Пароли не совпадают");
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with new password when passwords match", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    mockUpdateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/новый пароль/i));

    fireEvent.change(screen.getByLabelText(/новый пароль/i), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText(/повторите пароль/i), { target: { value: "newpass123" } });
    fireEvent.submit(screen.getByLabelText(/новый пароль/i).closest("form")!);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpass123" });
    });
  });

  it("navigates to /dashboard after successful password update", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    mockUpdateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/новый пароль/i));

    fireEvent.change(screen.getByLabelText(/новый пароль/i), { target: { value: "pass123" } });
    fireEvent.change(screen.getByLabelText(/повторите пароль/i), { target: { value: "pass123" } });
    fireEvent.submit(screen.getByLabelText(/новый пароль/i).closest("form")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" });
    });
  });

  it("shows error toast when updateUser returns an error", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    mockUpdateUser.mockResolvedValue({ error: { message: "Token expired" } });
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/новый пароль/i));

    fireEvent.change(screen.getByLabelText(/новый пароль/i), { target: { value: "pass123" } });
    fireEvent.change(screen.getByLabelText(/повторите пароль/i), { target: { value: "pass123" } });
    fireEvent.submit(screen.getByLabelText(/новый пароль/i).closest("form")!);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Token expired");
    });
  });
});
