"use client";
import dynamic from "next/dynamic";
import type { DriftCell } from "@/app/page";

export interface LaporanMapProps {
  driftCells: DriftCell[];
  zoneSummary: { good: number; attention: number; risk: number };
}

const LaporanMapComponent = dynamic(() => import("./LaporanMap"), { ssr: false });

export default function LaporanMapWrapper(props: LaporanMapProps) {
  return <LaporanMapComponent {...props} />;
}
