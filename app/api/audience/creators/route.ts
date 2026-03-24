import { NextResponse } from 'next/server';

/**
 * GET /api/audience/creators
 * Returns a slim list of registered creators (id + username) so the audience
 * wallet UI can populate the creator dropdown for tipping / auto-tip rules.
 */
export async function GET() {
  const { isSupabaseConfigured, getSupabase } = await import('@/server/storage/supabase');

  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('creators')
      .select('id, username, preferred_chain')
      .order('username', { ascending: true })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ creators: data ?? [] });
  }

  const { CreatorsRepository } = await import('@/server/storage/repositories/creators');
  const repo = new CreatorsRepository();
  const all = repo.findAll().map((c: { id: string; username: string; preferred_chain: string }) => ({
    id: c.id,
    username: c.username,
    preferred_chain: c.preferred_chain,
  }));
  return NextResponse.json({ creators: all });
}
