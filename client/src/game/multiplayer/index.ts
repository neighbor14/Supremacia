// ============================================================
// SUPREMACIA DIGITAL — Multiplayer: ponto de entrada
// ------------------------------------------------------------
// Seleciona o adapter ativo. Hoje só o LocalMultiplayerAdapter
// (simulado, sem backend) está implementado. O Supabase entra
// aqui quando VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// estiverem configurados — sem quebrar o modo local/IA atual.
// ============================================================

import { LocalMultiplayerAdapter } from './LocalMultiplayerAdapter';
import { SupabaseMultiplayerAdapter } from './SupabaseMultiplayerAdapter';
import type { MultiplayerAdapter } from './types';

export * from './types';
export { LocalMultiplayerAdapter, SupabaseMultiplayerAdapter };

let adapter: MultiplayerAdapter | null = null;

/**
 * Retorna o adapter multiplayer ativo (singleton).
 * Usa Supabase quando as envs existem; senão cai no adapter Local simulado
 * (localStorage + BroadcastChannel) para teste em 2 abas sem backend.
 */
export function getMultiplayerAdapter(): MultiplayerAdapter {
  if (adapter) return adapter;
  if (isMultiplayerConfigured()) {
    adapter = new SupabaseMultiplayerAdapter();
  } else {
    adapter = new LocalMultiplayerAdapter();
  }
  return adapter;
}

/** Multiplayer só fica disponível quando há backend OU em modo de teste local. */
export function isMultiplayerConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
