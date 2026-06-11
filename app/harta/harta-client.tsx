'use client';

// Thin client wrapper so MapView (maplibre-gl) loads in its own chunk and only
// in the browser. The harta page itself stays a static server component.

import dynamic from 'next/dynamic';
import type { MapViewProps } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <p className="py-8 text-sm text-ink-soft">Se încarcă harta…</p>
  ),
});

export default function HartaClient(props: MapViewProps) {
  return <MapView {...props} />;
}
