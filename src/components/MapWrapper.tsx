"use client";
import dynamic from "next/dynamic";
import type { DriftCell } from "@/app/page";

export interface MapProps {
  driftCells: DriftCell[];
  zoneSummary: { good: number; attention: number; risk: number };
  timeHorizon: "2w" | "1m" | "season";
  onTimeChange: (h: "2w" | "1m" | "season") => void;
  onCellSelect: (cell: DriftCell | null) => void;
  selectedCell: DriftCell | null;
}

const MapComponent = dynamic(() => import("./Map"), { ssr: false });

export default function MapWrapper(props: MapProps) {
  return <MapComponent {...props} />;
}
