// ============================================================
// SUPREMACIA DIGITAL — Cliente Supabase (singleton)
// ------------------------------------------------------------
// Criado só quando VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// existem. Usa Anonymous Auth: cada convidado ganha um auth.uid()
// real (necessário para as policies de RLS) sem tela de login.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error('Supabase não configurado (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).');
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** Garante uma sessão (anônima) e devolve o userId. */
export async function ensureAnonAuth(): Promise<string> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signIn, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  if (!signIn.user) throw new Error('Falha ao iniciar sessão anônima');
  return signIn.user.id;
}
