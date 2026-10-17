import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getViewAs, storeViewAs, supabase } from '@/lib/supabase';
import type { Profile, Role } from './types';


type AuthValue = {
  session: Session | null;
  profile: Profile | null; // الدور الفعّال في الواجهة (قد يختلف عن الفعلي عند «عرض كمشرف»)
  realRole: Role | null;
  viewAs: Role | null;
  setViewAs: (role: Role | null) => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [realProfile, setProfile] = useState<Profile | null>(null);
  const [viewAs, setViewAsState] = useState<Role | null>(getViewAs);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, role, active')
      .eq('user_id', s.user.id)
      .maybeSingle();
    setProfile(data && data.active ? (data as Profile) : null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // نؤجل الاستعلام لتفادي القفل داخل مستمع المصادقة
      setTimeout(() => {
        loadProfile(s);
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return 'بيانات الدخول غير صحيحة أو الحساب غير مفعّل';
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const setViewAs = useCallback((role: Role | null) => {
    setViewAsState(role);
    storeViewAs(role === 'supervisor' ? 'supervisor' : null);
  }, []);

  // التبديل متاح لمدير النظام فقط، ويغيّر شكل الواجهة وصلاحياتها المعروضة
  const profile = useMemo<Profile | null>(
    () => (realProfile && realProfile.role === 'admin' && viewAs ? { ...realProfile, role: viewAs } : realProfile),
    [realProfile, viewAs]
  );
  const realRole = realProfile?.role ?? null;

  const value = useMemo(
    () => ({ session, profile, realRole, viewAs, setViewAs, loading, signIn, signOut }),
    [session, profile, realRole, viewAs, setViewAs, loading, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
