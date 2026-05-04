import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string | null;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  displayName: null,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        // Fetch display_name and admin role in parallel to avoid two render flashes
        Promise.all([
          supabase.from("profiles").select("display_name").eq("id", s.user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", s.user.id).maybeSingle(),
        ]).then(([profileRes, roleRes]) => {
          setDisplayName(profileRes.data?.display_name ?? null);
          setIsAdmin(roleRes.data?.role === "admin");
        });
      } else {
        setDisplayName(null);
        setIsAdmin(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading, displayName, isAdmin }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
