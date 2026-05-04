import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SQL = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260504150000_procrastination_results.sql"),
  "utf-8",
);

describe("Procrastination results migration — SQL structure", () => {
  it("creates procrastination_results table", () => {
    expect(SQL).toMatch(/create table public\.procrastination_results/i);
  });

  it("id is uuid primary key with default gen_random_uuid()", () => {
    expect(SQL).toMatch(/id\s+uuid\s+primary key\s+default gen_random_uuid\(\)/i);
  });

  it("user_id references auth.users with cascade delete", () => {
    expect(SQL).toMatch(/user_id\s+uuid\s+not null\s+references auth\.users\(id\)\s+on delete cascade/i);
  });

  it("types column is text array", () => {
    expect(SQL).toMatch(/types\s+text\[\]\s+not null/i);
  });

  it("created_at has a default timestamp", () => {
    expect(SQL).toMatch(/created_at\s+timestamptz\s+not null\s+default now\(\)/i);
  });

  it("enables RLS on the table", () => {
    expect(SQL).toMatch(/alter table public\.procrastination_results enable row level security/i);
  });

  it("creates select_own policy", () => {
    expect(SQL).toMatch(/create policy "procrastination_results_select_own"/i);
    expect(SQL).toMatch(/for select using \(auth\.uid\(\) = user_id\)/i);
  });

  it("creates insert_own policy", () => {
    expect(SQL).toMatch(/create policy "procrastination_results_insert_own"/i);
    expect(SQL).toMatch(/for insert with check \(auth\.uid\(\) = user_id\)/i);
  });

  it("creates select_admin policy", () => {
    expect(SQL).toMatch(/create policy "procrastination_results_select_admin"/i);
  });

  it("admin policy uses user_roles subselect", () => {
    const adminBlock = SQL.slice(SQL.indexOf("procrastination_results_select_admin"));
    expect(adminBlock).toMatch(/select 1 from public\.user_roles/i);
    expect(adminBlock).toMatch(/role = 'admin'/i);
  });
});
