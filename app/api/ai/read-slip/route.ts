import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = 'image/jpeg' } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `This is a sports betting slip. Extract every individual bet you can see. For player props, identify the stat type as specifically as possible (e.g. "Shots on Target", "Passes Attempted", "Goals Scored", "Points", "Assists", "Rushing Yards", etc.).

Return JSON only, no other text:
{
  "bets": [
    {
      "player": "full player name",
      "propType": "specific stat name",
      "line": 2.5,
      "direction": "Over" or "Under" or "Yes" or "No",
      "odds": "-115" or null,
      "result": "win" or "loss" or "pending"
    }
  ],
  "slipNote": "any useful context (date, sportsbook name, total odds, etc.)"
}

If a field is not visible, use null. Extract ALL bets on the slip.`,
            },
          ],
        },
      ],
    });

    const text = message.content.map(c => c.type === 'text' ? c.text : '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Read slip error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
