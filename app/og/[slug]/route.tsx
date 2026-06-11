// The ONLY dynamic route on the site (Group C). Renders 1200×630 OG cards for
// PT and street pages from .data/og/stats.json (traced into the lambda via
// next.config outputFileTracingIncludes, together with assets/og fonts).
import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';

type OgStat = [t: 'pt' | 'st', name: string, sector: number | null, days: number, year: number];

let statsCache: Record<string, OgStat> | null = null;

function getStats(): Record<string, OgStat> {
  if (statsCache === null) {
    const dataDir = process.env.TERMO_DATA_DIR ?? path.join(process.cwd(), '.data');
    statsCache = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'og', 'stats.json'), 'utf8'),
    ) as Record<string, OgStat>;
  }
  return statsCache;
}

const fontCache = new Map<string, Buffer>();

function font(file: string): Buffer {
  let buf = fontCache.get(file);
  if (!buf) {
    buf = fs.readFileSync(path.join(process.cwd(), 'assets', 'og', file));
    fontCache.set(file, buf);
  }
  return buf;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const stat = getStats()[slug];
  if (!stat) {
    return Response.json({ error: 'unknown slug' }, { status: 404 });
  }
  const [t, name, sector, days, year] = stat;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FAF8F5',
          color: '#1C1917',
          padding: '64px 72px',
          fontFamily: 'Inter',
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 16,
            backgroundColor: '#C2410C',
          }}
        />
        <div style={{ fontSize: 28, color: '#57534E', display: 'flex' }}>
          {t === 'pt' ? `Punct termic · Sector ${sector ?? '—'}` : 'Stradă'}
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
            marginTop: 12,
            display: 'flex',
            maxWidth: 1000,
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 'auto' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Source Serif 4',
              fontSize: 200,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}
          >
            {String(days)}
          </div>
          <div
            style={{
              fontSize: 36,
              color: '#57534E',
              marginLeft: 28,
              maxWidth: 560,
              display: 'flex',
            }}
          >
            {`zile fără apă caldă în ${year}`}
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: '1px solid #E7E2DA',
            fontSize: 26,
            color: '#57534E',
            display: 'flex',
          }}
        >
          faraapacalda.ro
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Source Serif 4', data: font('SourceSerif4-Bold.ttf'), weight: 700 },
        { name: 'Inter', data: font('Inter-Regular.ttf'), weight: 400 },
        { name: 'Inter', data: font('Inter-SemiBold.ttf'), weight: 600 },
      ],
    },
  );
}
