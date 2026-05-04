import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  // createFileRoute(path) must return a function that accepts options
  createFileRoute: () => (options: { component: unknown }) => options,
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

// Import AFTER mocks are hoisted
import { PrivacyPage } from "./privacy";

describe("Privacy policy page", () => {
  it("renders without crashing", () => {
    render(<PrivacyPage />);
  });

  it("contains the page heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /политика конфиденциальности/i })).toBeInTheDocument();
  });

  it("contains section about data collected", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/какие данные мы собираем/i)).toBeInTheDocument();
  });

  it("contains section about user rights", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/ваши права/i)).toBeInTheDocument();
  });

  it("contains section about cookies", () => {
    render(<PrivacyPage />);
    expect(screen.getAllByText(/файлы cookie/i).length).toBeGreaterThan(0);
  });

  it("contains contact email", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: /alex\.boldin\.v@gmail\.com/i })).toBeInTheDocument();
  });

  it("has a link back to home", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: /на главную/i })).toHaveAttribute("href", "/");
  });

  it("date shows correct year (2026 not 2025)", () => {
    render(<PrivacyPage />);
    const dateEl = screen.getByText(/последнее обновление/i);
    expect(dateEl.textContent).not.toContain("2025");
    expect(dateEl.textContent).toContain("2026");
  });

  it("mentions both ФЗ-152 and GDPR", () => {
    render(<PrivacyPage />);
    const body = document.body.textContent ?? "";
    expect(body).toContain("152");
    expect(body).toContain("GDPR");
  });

  it("contact section is present", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/контактная информация/i)).toBeInTheDocument();
  });
});
