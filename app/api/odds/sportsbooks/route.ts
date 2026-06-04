import { NextRequest, NextResponse } from 'next/server';
import { fetchOdds } from '@/lib/theOddsApi';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport') || 'Soccer';

  try {
    const result = await fetchOdds(sport);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Sportsbooks odds error:', err);
    return NextResponse.json({ games: [], error: String(err) });
  }
}
