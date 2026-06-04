import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ picks: [] }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Picks GET error:', error);
    return NextResponse.json({ picks: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ picks: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, pick } = body;

    if (!userId || !pick) {
      return NextResponse.json({ error: 'Missing userId or pick' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('picks')
      .insert([{ ...pick, user_id: userId }])
      .select()
      .single();

    if (error) {
      console.error('Picks POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pick: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
