import { createClient } from '@supabase/supabase-js';
import { SAVE_VERSION } from './config.js';
import { normalizeState } from './engine.js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let client = null;

function getClient() {
  if (!url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey);
  return client;
}

export function isCloudSaveEnabled() {
  return Boolean(getClient());
}

/**
 * @param {string} walletAddress
 * @returns {Promise<import('./engine.js').GameState|null>}
 */
export async function fetchCloudSave(walletAddress) {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('game_saves')
    .select('save_data, save_version')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error || !data?.save_data) return null;
  if (data.save_version !== SAVE_VERSION) return null;

  try {
    return normalizeState(data.save_data);
  } catch {
    return null;
  }
}

/**
 * @param {string} walletAddress
 * @param {import('./engine.js').GameState} state
 */
export async function pushCloudSave(walletAddress, state) {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase.from('game_saves').upsert(
    {
      wallet_address: walletAddress,
      save_version: SAVE_VERSION,
      save_data: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'wallet_address' },
  );

  if (error) throw error;
}

/** @param {string} walletAddress */
export async function deleteCloudSave(walletAddress) {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('game_saves')
    .delete()
    .eq('wallet_address', walletAddress);

  if (error) throw error;
}
