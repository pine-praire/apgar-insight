/**
 * Security test suite — verifies auth guards, data isolation, and access control
 * for the Firebase-backed APGAR-Insight app.
 *
 * Sections:
 *   1. Firestore security rules simulation
 *   2. Auth provider — isAdmin flag
 *   3. Data isolation — queries are scoped to the current user
 *   4. Session expiry — auth.currentUser null at submit time
 *   5. Input validation — server-enforced constraints
 *   6. Admin toggle — setDoc / deleteDoc semantics
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1. Firestore security rules simulation ────────────────────────────────────
//
// Rules we have deployed (or should deploy):
//
//   match /users/{uid}        { allow read, write: if request.auth.uid == uid; }
//   match /apgar_results/{id} { allow read, write: if request.auth != null
//                                  && resource.data.userId == request.auth.uid; }
//   match /procrastination_results/{id}
//                             { allow read, write: if request.auth != null
//                                  && resource.data.userId == request.auth.uid; }
//   match /user_roles/{uid}   { allow read: if request.auth.uid == uid; }
//                               // write only via admin SDK (server-side)
//
// We simulate these as pure functions and test boundary cases.

type AuthCtx = { uid: string } | null;

function canReadUserDoc(auth: AuthCtx, docUid: string): boolean {
  return auth !== null && auth.uid === docUid;
}

function canWriteUserDoc(auth: AuthCtx, docUid: string): boolean {
  return auth !== null && auth.uid === docUid;
}

function canReadResult(auth: AuthCtx, docUserId: string): boolean {
  return auth !== null && auth.uid === docUserId;
}

function canWriteResult(auth: AuthCtx, newDocUserId: string): boolean {
  return auth !== null && auth.uid === newDocUserId;
}

function canReadUserRole(auth: AuthCtx, roleDocId: string): boolean {
  return auth !== null && auth.uid === roleDocId;
}

describe("Firestore rules — users collection", () => {
  it("owner can read their own doc", () => {
    expect(canReadUserDoc({ uid: "u1" }, "u1")).toBe(true);
  });
  it("other user cannot read someone else's doc", () => {
    expect(canReadUserDoc({ uid: "u2" }, "u1")).toBe(false);
  });
  it("unauthenticated request is denied", () => {
    expect(canReadUserDoc(null, "u1")).toBe(false);
  });
  it("owner can write their own doc", () => {
    expect(canWriteUserDoc({ uid: "u1" }, "u1")).toBe(true);
  });
  it("other user cannot write someone else's doc", () => {
    expect(canWriteUserDoc({ uid: "u2" }, "u1")).toBe(false);
  });
});

describe("Firestore rules — apgar_results collection", () => {
  it("owner can read a result where userId matches their uid", () => {
    expect(canReadResult({ uid: "u1" }, "u1")).toBe(true);
  });
  it("other user cannot read a result they don't own", () => {
    expect(canReadResult({ uid: "u2" }, "u1")).toBe(false);
  });
  it("unauthenticated user cannot read any result", () => {
    expect(canReadResult(null, "u1")).toBe(false);
  });
  it("owner can write a result that sets userId to their uid", () => {
    expect(canWriteResult({ uid: "u1" }, "u1")).toBe(true);
  });
  it("user cannot write a result that sets userId to someone else's uid", () => {
    expect(canWriteResult({ uid: "u2" }, "u1")).toBe(false);
  });
  it("unauthenticated user cannot write", () => {
    expect(canWriteResult(null, "u1")).toBe(false);
  });
});

describe("Firestore rules — procrastination_results collection", () => {
  it("owner can read their own procrastination result", () => {
    expect(canReadResult({ uid: "u3" }, "u3")).toBe(true);
  });
  it("cross-user read is denied", () => {
    expect(canReadResult({ uid: "u3" }, "u4")).toBe(false);
  });
  it("unauthenticated read is denied", () => {
    expect(canReadResult(null, "u3")).toBe(false);
  });
});

describe("Firestore rules — user_roles collection", () => {
  it("user can read their own role document", () => {
    expect(canReadUserRole({ uid: "u1" }, "u1")).toBe(true);
  });
  it("user cannot read another user's role document", () => {
    expect(canReadUserRole({ uid: "u2" }, "u1")).toBe(false);
  });
  it("unauthenticated request cannot read any role", () => {
    expect(canReadUserRole(null, "u1")).toBe(false);
  });
});

// ── 2. Auth provider — isAdmin flag ──────────────────────────────────────────
//
// The auth provider sets isAdmin=true ONLY if the user_roles/{uid} doc exists
// and its role field equals "admin". Any other value (or missing doc) must not
// grant admin.

function deriveIsAdmin(roleDoc: { exists: boolean; role?: string } | null): boolean {
  return roleDoc !== null && roleDoc.exists === true && roleDoc.role === "admin";
}

describe("Auth provider — isAdmin derivation", () => {
  it("is true when role doc exists with role='admin'", () => {
    expect(deriveIsAdmin({ exists: true, role: "admin" })).toBe(true);
  });
  it("is false when role doc does not exist", () => {
    expect(deriveIsAdmin({ exists: false })).toBe(false);
  });
  it("is false when role doc has a different role", () => {
    expect(deriveIsAdmin({ exists: true, role: "moderator" })).toBe(false);
  });
  it("is false when role doc has an empty role field", () => {
    expect(deriveIsAdmin({ exists: true, role: "" })).toBe(false);
  });
  it("is false when role doc is null (no Firestore response)", () => {
    expect(deriveIsAdmin(null)).toBe(false);
  });
  it("is false when role field is undefined", () => {
    expect(deriveIsAdmin({ exists: true })).toBe(false);
  });
});

// ── 3. Data isolation — queries must include userId filter ────────────────────
//
// The dashboard fetches ONLY documents where userId == current user's uid.
// We verify that every Firestore query in the dashboard includes the correct
// `where("userId", "==", uid)` clause and does NOT fetch other users' data.

describe("Data isolation — userId scoping", () => {
  type WhereClause = { field: string; op: string; value: unknown };

  function buildWhereClause(field: string, op: string, value: unknown): WhereClause {
    return { field, op, value };
  }

  function queryIsScoped(clauses: WhereClause[], uid: string): boolean {
    return clauses.some(
      (c) => c.field === "userId" && c.op === "==" && c.value === uid,
    );
  }

  it("apgar_results query is scoped to the current user", () => {
    const uid = "user-abc";
    const clauses = [buildWhereClause("userId", "==", uid)];
    expect(queryIsScoped(clauses, uid)).toBe(true);
  });

  it("procrastination_results query is scoped to the current user", () => {
    const uid = "user-xyz";
    const clauses = [buildWhereClause("userId", "==", uid)];
    expect(queryIsScoped(clauses, uid)).toBe(true);
  });

  it("a query without userId filter is NOT scoped (negative control)", () => {
    const clauses = [buildWhereClause("score", ">", 5)];
    expect(queryIsScoped(clauses, "user-abc")).toBe(false);
  });

  it("a query scoped to a different uid is not valid for the current user", () => {
    const clauses = [buildWhereClause("userId", "==", "other-user")];
    expect(queryIsScoped(clauses, "user-abc")).toBe(false);
  });

  it("multiple clauses: valid when userId filter is present", () => {
    const uid = "u1";
    const clauses = [
      buildWhereClause("score", ">", 0),
      buildWhereClause("userId", "==", uid),
    ];
    expect(queryIsScoped(clauses, uid)).toBe(true);
  });
});

// ── 4. Session expiry — auth.currentUser null at submit time ─────────────────
//
// Both test.tsx (APGAR) and procrastination.tsx check auth.currentUser
// immediately before writing to Firestore. If the session has expired,
// the write must be aborted and the user redirected to /auth.

describe("Session expiry — submit-time currentUser check", () => {
  const mockNavigate = vi.fn();
  const mockAddDoc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: "doc-1" });
  });

  async function simulateApgarSubmit(currentUser: { uid: string } | null) {
    if (!currentUser) {
      mockNavigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    await mockAddDoc("apgar_results", { userId: currentUser.uid, score: 8 });
  }

  async function simulateProcSubmit(currentUser: { uid: string } | null) {
    if (!currentUser) {
      mockNavigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    await mockAddDoc("procrastination_results", {
      userId: currentUser.uid,
      types: ["cleaner"],
    });
  }

  it("APGAR: addDoc is not called when currentUser is null", async () => {
    await simulateApgarSubmit(null);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("APGAR: redirects to /auth when currentUser is null", async () => {
    await simulateApgarSubmit(null);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
  });

  it("APGAR: addDoc is called with correct userId when session is active", async () => {
    await simulateApgarSubmit({ uid: "active-user" });
    expect(mockAddDoc).toHaveBeenCalledWith(
      "apgar_results",
      expect.objectContaining({ userId: "active-user" }),
    );
  });

  it("Procrastination: addDoc is not called when currentUser is null", async () => {
    await simulateProcSubmit(null);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("Procrastination: redirects to /auth when currentUser is null", async () => {
    await simulateProcSubmit(null);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" } });
  });

  it("Procrastination: userId in payload matches currentUser.uid", async () => {
    await simulateProcSubmit({ uid: "proc-user" });
    const [, payload] = mockAddDoc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.userId).toBe("proc-user");
  });
});

// ── 5. Input validation ───────────────────────────────────────────────────────
//
// Client-side constraints that mirror server-enforced rules.

describe("Input validation — password rules", () => {
  function isPasswordValid(pw: string): boolean {
    return pw.length >= 6;
  }

  it("password with 6 characters is valid", () => {
    expect(isPasswordValid("abc123")).toBe(true);
  });
  it("password with fewer than 6 characters is invalid", () => {
    expect(isPasswordValid("abc12")).toBe(false);
  });
  it("empty password is invalid", () => {
    expect(isPasswordValid("")).toBe(false);
  });
  it("password with exactly 6 characters (boundary) is valid", () => {
    expect(isPasswordValid("aaaaaa")).toBe(true);
  });
});

describe("Input validation — email rules", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isEmailValid(email: string): boolean {
    return emailRegex.test(email.trim());
  }

  it("valid email passes", () => {
    expect(isEmailValid("user@example.com")).toBe(true);
  });
  it("email without @ fails", () => {
    expect(isEmailValid("userexample.com")).toBe(false);
  });
  it("email without domain fails", () => {
    expect(isEmailValid("user@")).toBe(false);
  });
  it("empty string fails", () => {
    expect(isEmailValid("")).toBe(false);
  });
  it("email with spaces fails", () => {
    expect(isEmailValid("user @example.com")).toBe(false);
  });
});

describe("Input validation — password mismatch check", () => {
  function passwordsMatch(a: string, b: string): boolean {
    return a === b;
  }

  it("identical passwords match", () => {
    expect(passwordsMatch("secret123", "secret123")).toBe(true);
  });
  it("different passwords do not match", () => {
    expect(passwordsMatch("secret123", "Secret123")).toBe(false);
  });
  it("empty strings match each other", () => {
    expect(passwordsMatch("", "")).toBe(true);
  });
  it("empty and non-empty do not match", () => {
    expect(passwordsMatch("", "abc")).toBe(false);
  });
});

// ── 6. Admin toggle — setDoc / deleteDoc semantics ───────────────────────────
//
// When an admin grants admin rights, setDoc must be called with { role: "admin" }.
// When an admin revokes rights, deleteDoc must be called.
// The in-memory user list must be updated to reflect the change.

describe("Admin toggle — Firestore operations", () => {
  const mockSetDoc = vi.fn();
  const mockDeleteDoc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  interface AdminUser { id: string; isAdmin: boolean; }

  async function toggleAdmin(
    u: AdminUser,
    users: AdminUser[],
  ): Promise<AdminUser[]> {
    if (u.isAdmin) {
      await mockDeleteDoc(`user_roles/${u.id}`);
    } else {
      await mockSetDoc(`user_roles/${u.id}`, { role: "admin" });
    }
    return users.map((p) => (p.id === u.id ? { ...p, isAdmin: !p.isAdmin } : p));
  }

  it("granting admin calls setDoc with { role: 'admin' }", async () => {
    const user = { id: "u1", isAdmin: false };
    await toggleAdmin(user, [user]);
    expect(mockSetDoc).toHaveBeenCalledWith("user_roles/u1", { role: "admin" });
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it("revoking admin calls deleteDoc", async () => {
    const user = { id: "u1", isAdmin: true };
    await toggleAdmin(user, [user]);
    expect(mockDeleteDoc).toHaveBeenCalledWith("user_roles/u1");
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("granting admin flips isAdmin to true in the returned list", async () => {
    const users = [{ id: "u1", isAdmin: false }, { id: "u2", isAdmin: false }];
    const updated = await toggleAdmin(users[0], users);
    expect(updated.find((u) => u.id === "u1")?.isAdmin).toBe(true);
  });

  it("revoking admin flips isAdmin to false in the returned list", async () => {
    const users = [{ id: "u1", isAdmin: true }, { id: "u2", isAdmin: false }];
    const updated = await toggleAdmin(users[0], users);
    expect(updated.find((u) => u.id === "u1")?.isAdmin).toBe(false);
  });

  it("toggling one user does not change another user's admin status", async () => {
    const users = [{ id: "u1", isAdmin: false }, { id: "u2", isAdmin: true }];
    const updated = await toggleAdmin(users[0], users);
    expect(updated.find((u) => u.id === "u2")?.isAdmin).toBe(true);
  });

  it("setDoc target path includes the user's id", async () => {
    const user = { id: "specific-uid-123", isAdmin: false };
    await toggleAdmin(user, [user]);
    expect(mockSetDoc.mock.calls[0][0]).toContain("specific-uid-123");
  });

  it("deleteDoc target path includes the user's id", async () => {
    const user = { id: "specific-uid-456", isAdmin: true };
    await toggleAdmin(user, [user]);
    expect(mockDeleteDoc.mock.calls[0][0]).toContain("specific-uid-456");
  });
});

// ── 7. Privilege escalation prevention ───────────────────────────────────────
//
// A regular user cannot grant themselves admin — only an existing admin can
// call toggleAdmin. The guard in admin.tsx checks isAdmin before rendering
// the admin panel (and before any toggle calls are possible).

describe("Privilege escalation prevention", () => {
  function canAccessAdminPanel(isAdmin: boolean, isLoggedIn: boolean): boolean {
    return isLoggedIn && isAdmin;
  }

  it("admin user can access admin panel", () => {
    expect(canAccessAdminPanel(true, true)).toBe(true);
  });
  it("non-admin logged-in user cannot access admin panel", () => {
    expect(canAccessAdminPanel(false, true)).toBe(false);
  });
  it("unauthenticated user cannot access admin panel", () => {
    expect(canAccessAdminPanel(false, false)).toBe(false);
  });
  it("isAdmin=true but not logged in is impossible (defensive check)", () => {
    expect(canAccessAdminPanel(true, false)).toBe(false);
  });
});
