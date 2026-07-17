import LaporanMapWrapper from "./LaporanMapWrapper";
import type { DriftCell } from "@/app/page";

interface LaporanViewProps {
  driftCells: DriftCell[];
  zoneSummary: { good: number; attention: number; risk: number };
}

export default function LaporanView({ driftCells, zoneSummary }: LaporanViewProps) {
  return (
    <div style={{ gridColumn: "1 / -1", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      
      {/* Header Area */}
      <div style={{ padding: "16px 28px", flexShrink: 0 }}>
        <h1 className="greeting" style={{ marginBottom: "8px" }}>
          Laporan Kesehatan Lahan
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(244,241,235,0.7)", paddingLeft: "4px" }}>
          Peta kondisi lahan berbasis data satelit — perubahan tutupan lahan 2023 vs 2024
        </p>
      </div>

      {/* Map Area */}
      <div style={{ flex: 1, position: "relative", borderRadius: "12px 12px 0 0", overflow: "hidden", margin: "0 28px 20px" }}>
        <LaporanMapWrapper driftCells={driftCells} zoneSummary={zoneSummary} />
      </div>

    </div>
  );
}
