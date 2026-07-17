"use client";
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./Map'), { ssr: false });

export default function MapWrapper({ onSelectKabupaten, onSelectPlot }: { onSelectKabupaten: (code: string) => void, onSelectPlot?: (plot: any) => void }) {
  return <MapComponent onSelectKabupaten={onSelectKabupaten} onSelectPlot={onSelectPlot} />;
}
