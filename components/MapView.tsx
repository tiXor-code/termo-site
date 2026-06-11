'use client';

// maplibre-gl map of all PTs (Group B). The ONLY heavy client dependency on
// the site — imported exclusively through app/harta/harta-client.tsx via
// next/dynamic({ ssr: false }) so it stays in its own chunk.

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fmtZile } from '@/lib/format';

const SOURCE_ID = 'pt';
const LAYER_ID = 'pt-circles';

export interface MapViewProps {
  years: number[];
  defaultYear: number;
  geojsonUrls: Record<string, string>;
  maxDays: number;
}

export default function MapView({ years, defaultYear, geojsonUrls, maxDays }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const [year, setYear] = useState(defaultYear);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [26.1, 44.43],
      zoom: 11,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution:
          'OpenFreeMap · © OpenMapTiles · © contribuitorii OpenStreetMap',
      }),
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.on('error', () => {
      // Tile/style fetch failures must not crash the page (offline builds, CI).
    });
    map.on('load', () => {
      loadedRef.current = true;
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojsonUrls[String(defaultYear)] });
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'days'],
            0,
            3,
            Math.max(1, maxDays),
            14,
          ],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'days'],
            0,
            '#9CA3AF',
            Math.max(1, maxDays),
            '#C2410C',
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#FAF8F5',
        },
      });
      map.on('click', LAYER_ID, (ev) => {
        const feature = ev.features?.[0];
        if (!feature) return;
        const props = feature.properties as {
          slug: string;
          name: string;
          days: number;
        };
        const el = document.createElement('div');
        el.style.font = '13px system-ui, sans-serif';
        const strong = document.createElement('strong');
        strong.textContent = props.name;
        const line = document.createElement('div');
        line.textContent = fmtZile(Number(props.days));
        const link = document.createElement('a');
        link.href = `/punct-termic/${props.slug}`;
        link.textContent = 'Vezi punctul termic';
        link.style.textDecoration = 'underline';
        el.append(strong, line, link);
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(ev.lngLat)
          .setDOMContent(el)
          .addTo(map);
      });
      map.on('mouseenter', LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
    });
    return () => {
      mapRef.current = null;
      loadedRef.current = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectYear(y: number) {
    setYear(y);
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(geojsonUrls[String(y)]);
  }

  return (
    <div>
      <div role="group" aria-label="Alege anul" className="mb-3 flex flex-wrap gap-x-4 text-sm">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => selectYear(y)}
            aria-pressed={y === year}
            className={
              y === year
                ? 'cursor-pointer border-b-2 border-ink font-bold'
                : 'cursor-pointer text-ink-soft hover:underline'
            }
          >
            {y}
          </button>
        ))}
      </div>
      <div ref={containerRef} data-testid="map-container" className="h-[70vh] w-full" />
    </div>
  );
}
