import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase client singleton.
 * Requires SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.
 * In server-side code (Next.js API routes, agent) prefer SUPABASE_SERVICE_ROLE_KEY
 * so row-level security is bypassed for trusted backend operations.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.',
      );
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/** Returns true when SUPABASE_URL + a key are both present in the environment. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY),
  );
}

/**
 * Thin typed helpers used by the audience routes.
 * Each function transparently falls back to null / [] when Supabase is not
 * configured so callers can decide to fall through to the SQLite repository.
 */

export async function sbFindOne<T>(
  table: string,
  match: Record<string, unknown>,
): Promise<T | null> {
  const client = getSupabase();
  let query = client.from(table).select('*');
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val as string);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`Supabase sbFindOne(${table}): ${error.message}`);
  return (data as T) ?? null;
}

export async function sbFindMany<T>(
  table: string,
  match: Record<string, unknown>,
  opts?: { orderBy?: string; descending?: boolean; limit?: number },
): Promise<T[]> {
  const client = getSupabase();
  let query = client.from(table).select('*');
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val as string);
  }
  if (opts?.orderBy) {
    query = query.order(opts.orderBy, { ascending: !(opts.descending ?? false) });
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Supabase sbFindMany(${table}): ${error.message}`);
  return (data as T[]) ?? [];
}

export async function sbUpsert<T>(
  table: string,
  record: Record<string, unknown>,
  conflictColumns?: string[],
): Promise<T> {
  const client = getSupabase();
  const opts = conflictColumns
    ? { onConflict: conflictColumns.join(','), ignoreDuplicates: false }
    : undefined;
  const { data, error } = await client
    .from(table)
    .upsert(record, opts)
    .select()
    .single();
  if (error) throw new Error(`Supabase sbUpsert(${table}): ${error.message}`);
  return data as T;
}

export async function sbInsert<T>(
  table: string,
  record: Record<string, unknown>,
): Promise<T> {
  const client = getSupabase();
  const { data, error } = await client
    .from(table)
    .insert(record)
    .select()
    .single();
  if (error) throw new Error(`Supabase sbInsert(${table}): ${error.message}`);
  return data as T;
}

export async function sbUpdate(
  table: string,
  match: Record<string, unknown>,
  fields: Record<string, unknown>,
): Promise<void> {
  const client = getSupabase();
  let query = client.from(table).update(fields);
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val as string);
  }
  const { error } = await query;
  if (error) throw new Error(`Supabase sbUpdate(${table}): ${error.message}`);
}

export async function sbDelete(
  table: string,
  match: Record<string, unknown>,
): Promise<void> {
  const client = getSupabase();
  let query = client.from(table).delete();
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val as string);
  }
  const { error } = await query;
  if (error) throw new Error(`Supabase sbDelete(${table}): ${error.message}`);
}
