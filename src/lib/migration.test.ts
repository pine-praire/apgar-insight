import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SQL = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260504120000_admin_roles.sql"),
  "utf-8"
);

describe("Admin roles migration — SQL structure", () => {
  it("creates the user_roles table", () => {
    expect(SQL).toMatch(/create table public\.user_roles/i);
  });

  it("user_roles.user_id is a uuid primary key referencing auth.users", () => {
    expect(SQL).toMatch(/user_id\s+uuid\s+primary key/i);
    expect(SQL).toMatch(/references auth\.users/i);
  });

  it("user_roles.role has a check constraint limiting to 'admin'", () => {
    expect(SQL).toMatch(/check\s*\(\s*role\s*=\s*'admin'\s*\)/i);
  });

  it("enables RLS on user_roles", () => {
    expect(SQL).toMatch(/alter table public\.user_roles enable row level security/i);
  });

  it("creates user_roles_select_own policy (users can only read their own role)", () => {
    expect(SQL).toMatch(/create policy "user_roles_select_own"/i);
    expect(SQL).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
  });

  it("creates profiles_select_admin policy (admins see all profiles)", () => {
    expect(SQL).toMatch(/create policy "profiles_select_admin" on public\.profiles/i);
  });

  it("creates results_select_admin policy (admins see all apgar_results)", () => {
    expect(SQL).toMatch(/create policy "results_select_admin" on public\.apgar_results/i);
  });

  it("admin policies use subselect on user_roles", () => {
    const policyBlock = SQL.slice(SQL.indexOf("profiles_select_admin"));
    expect(policyBlock).toMatch(/select 1 from public\.user_roles/i);
  });

  it("creates get_admin_users function", () => {
    expect(SQL).toMatch(/create or replace function public\.get_admin_users/i);
  });

  it("get_admin_users is security definer", () => {
    expect(SQL).toMatch(/security definer/i);
  });

  it("get_admin_users performs in-body admin check", () => {
    expect(SQL).toMatch(/raise exception 'Forbidden'/i);
  });

  it("get_admin_users returns email, display_name, created_at", () => {
    const fn = SQL.slice(SQL.indexOf("get_admin_users"));
    expect(fn).toMatch(/email/i);
    expect(fn).toMatch(/display_name/i);
    expect(fn).toMatch(/created_at/i);
  });

  it("get_admin_users joins auth.users with public.profiles", () => {
    const fn = SQL.slice(SQL.indexOf("get_admin_users"));
    expect(fn).toMatch(/from auth\.users/i);
    expect(fn).toMatch(/join public\.profiles/i);
  });

  it("revokes execute from public and anon", () => {
    expect(SQL).toMatch(/revoke execute on function public\.get_admin_users\(\) from public, anon/i);
  });

  it("grants execute to authenticated role only", () => {
    expect(SQL).toMatch(/grant\s+execute on function public\.get_admin_users\(\) to authenticated/i);
  });
});
