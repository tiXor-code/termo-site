// Hand-rolled SVG silhouette of Bucharest's 6 sectors (Group B, server-only).
// Returns null when sectoare.geojson is absent — pages degrade gracefully.
import type { Position } from 'geojson';
import { getSectoareGeo } from '@/lib/data';
import { fmtZile } from '@/lib/format';

const VIEW_W = 400;
const VIEW_H = 320;
const PAD = 8;

const HEAT = [
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
  'var(--color-heat-5)',
];

function heatFill(value: number, min: number, max: number): string {
  if (max <= min) return HEAT[2];
  const t = (value - min) / (max - min);
  return HEAT[Math.min(4, Math.floor(t * 5))];
}

export default function SectorSilhouetteMap({
  values,
  highlight,
  ariaLabel,
}: {
  values: Record<number, number>;
  highlight?: number;
  ariaLabel: string;
}) {
  const geo = getSectoareGeo();
  if (geo === null) return null;

  // Collect rings per sector. Equirectangular: x ~ lon * cos(midLat), y ~ -lat.
  const sectors: { sector: number; rings: Position[][] }[] = [];
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of geo.features) {
    const sector = Number((f.properties as { sector?: number } | null)?.sector);
    if (!Number.isFinite(sector)) continue;
    const polys: Position[][][] =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates
          : [];
    const rings: Position[][] = [];
    for (const poly of polys) {
      for (const ring of poly) {
        rings.push(ring);
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
    if (rings.length > 0) sectors.push({ sector, rings });
  }
  if (sectors.length === 0) return null;

  const latScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLon - minLon) * latScale || 1;
  const spanY = maxLat - minLat || 1;
  const scale = Math.min((VIEW_W - 2 * PAD) / spanX, (VIEW_H - 2 * PAD) / spanY);
  const offX = (VIEW_W - spanX * scale) / 2;
  const offY = (VIEW_H - spanY * scale) / 2;
  const project = ([lon, lat]: Position): [number, number] => [
    offX + (lon - minLon) * latScale * scale,
    offY + (maxLat - lat) * scale,
  ];

  const vals = Object.values(values);
  const min = vals.length > 0 ? Math.min(...vals) : 0;
  const max = vals.length > 0 ? Math.max(...vals) : 0;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="block w-full max-w-sm"
      role="img"
      aria-label={ariaLabel}
    >
      {sectors.map(({ sector, rings }) => {
        const value = values[sector] ?? 0;
        const d = rings
          .map(
            (ring) =>
              ring
                .map((pos, i) => {
                  const [x, y] = project(pos);
                  return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
                })
                .join('') + 'Z',
          )
          .join('');
        const isHighlight = highlight === sector;
        return (
          <a key={sector} href={`/sector/${sector}`}>
            <path
              d={d}
              fill={heatFill(value, min, max)}
              stroke={isHighlight ? 'var(--color-ink)' : 'var(--color-paper)'}
              strokeWidth={isHighlight ? 2 : 1}
            >
              <title>{`Sector ${sector}: ${fmtZile(value)}`}</title>
            </path>
          </a>
        );
      })}
      {sectors.map(({ sector, rings }) => {
        // Label at the ring's centroid-ish (bbox middle of the largest ring).
        const ring = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0]);
        let sx = 0;
        let sy = 0;
        for (const pos of ring) {
          const [x, y] = project(pos);
          sx += x;
          sy += y;
        }
        return (
          <text
            key={sector}
            x={sx / ring.length}
            y={sy / ring.length}
            textAnchor="middle"
            fontSize={13}
            fill="var(--color-ink)"
            pointerEvents="none"
          >
            {sector}
          </text>
        );
      })}
    </svg>
  );
}
