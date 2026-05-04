import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CookieBanner } from "./cookie-banner";

// Minimal router mock so <Link> doesn't blow up
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

const STORAGE_KEY = "cookie-consent";

beforeEach(() => {
  localStorage.clear();
});

describe("CookieBanner", () => {
  it("renders when no consent is stored", () => {
    render(<CookieBanner />);
    expect(screen.getByRole("button", { name: /принять/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /отклонить/i })).toBeInTheDocument();
  });

  it("does NOT render when consent is already 'accepted'", () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    render(<CookieBanner />);
    expect(screen.queryByRole("button", { name: /принять/i })).not.toBeInTheDocument();
  });

  it("does NOT render when consent is already 'declined'", () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    render(<CookieBanner />);
    expect(screen.queryByRole("button", { name: /принять/i })).not.toBeInTheDocument();
  });

  it("stores 'accepted' and hides after clicking Accept", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /принять/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("accepted");
    expect(screen.queryByRole("button", { name: /принять/i })).not.toBeInTheDocument();
  });

  it("stores 'declined' and hides after clicking Decline", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /отклонить/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("declined");
    expect(screen.queryByRole("button", { name: /принять/i })).not.toBeInTheDocument();
  });

  it("contains a link to /privacy", () => {
    render(<CookieBanner />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("does not reappear after declining (simulating page revisit)", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: /отклонить/i }));
    // Second render (simulates revisit)
    const { container } = render(<CookieBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
