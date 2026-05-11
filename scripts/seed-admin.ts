#!/usr/bin/env bun
// Usage: bun run scripts/seed-admin.ts <email> <password>

const API_KEY = "AIzaSyB6dsgG2B7lOy5tBlG150jlHpfBzSTxSNA";
const PROJECT_ID = "samovyvoz-685ae";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: bun run scripts/seed-admin.ts <email> <password>");
  process.exit(1);
}

const signIn = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  },
);

if (!signIn.ok) {
  const err = await signIn.json();
  console.error("Sign-in failed:", err.error?.message ?? JSON.stringify(err));
  process.exit(1);
}

const { localId: uid, idToken } = await signIn.json();

const write = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/user_roles/${uid}`,
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: { role: { stringValue: "admin" } },
    }),
  },
);

if (!write.ok) {
  const err = await write.json();
  console.error("Firestore write failed:", JSON.stringify(err.error ?? err, null, 2));
  process.exit(1);
}

console.log(`✓ user_roles/${uid} set to admin`);
