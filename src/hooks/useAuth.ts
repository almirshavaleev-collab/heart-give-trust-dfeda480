import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('[auth] role check started for', userId);
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (error) {
        console.error('[auth] role check error', error.message);
        return false;
      }
      console.log('[auth] role check result:', data);
      return !!data;
    } catch (e) {
      console.error('[auth] role check exception', e);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. Bootstrap session once
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      console.log('[auth] session loaded', u?.id ?? 'none');
      setUser(u);
      if (u) {
        const admin = await checkAdmin(u.id);
        if (!cancelled) setIsAdmin(admin);
      }
      if (!cancelled) setLoading(false);
    });

    // 2. Listen for changes — no await inside callback to prevent deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      console.log('[auth] state change', _event, u?.id ?? 'none');
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // Fire-and-forget role check (no await in callback)
      checkAdmin(u.id).then((admin) => {
        if (!cancelled) {
          setIsAdmin(admin);
          setLoading(false);
        }
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const signIn = async (email: string, password: string) => {
    console.log('[auth] login started');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[auth] login error', error.message);
      return { error, isAdmin: false };
    }
    console.log('[auth] auth success', data.user?.id);
    // Check admin role right here so caller can decide redirect
    const admin = data.user ? await checkAdmin(data.user.id) : false;
    console.log('[auth] admin check after login:', admin);
    return { error: null, isAdmin: admin };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, isAdmin, loading, signIn, signUp, signOut };
}
