import { NextRequest, NextResponse } from 'next/server';
import { fetchPrizePicks } from '@/lib/prizepicks';
import { Sport } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get('sport') || 'Soccer') as Sport;

  try {
    const props = await fetchPrizePicks(sport);
    return NextResponse.json({ props });
  } catch (err) {
    console.error('PrizePicks error:', err);
    return NextResponse.json({ props: [], error: String(err) });
  }
}
