"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import * as h3 from "h3-js";
import type { MapProps } from "./MapWrapper";
import type { DriftCell } from "@/app/page";
import { DEMO_COLORS } from "@/lib/demo";

function getDemoCells(): DriftCell[] {
  const center = h3.latLngToCell(-7.05, 107.56, 9);
  const ring = h3.gridDisk(center, 2);
  return ring.slice(0, DEMO_COLORS.length).map((idx, i) => ({
    h3_index: idx,
    color: DEMO_COLORS[i],
    drift_score: DEMO_COLORS[i] === "red" ? 0.08 : DEMO_COLORS[i] === "yellow" ? 0.04 : 0.02,
  }));
}

// ── H3 → Leaflet GeoJSON ───────────────────────────────────────────────────

function cellsToGeoJSON(cells: DriftCell[]) {
  return {
    type: "FeatureCollection" as const,
    features: cells.map(cell => {
      const boundary = h3.cellToBoundary(cell.h3_index);
      const coords = boundary.map(([lat, lon]) => [lon, lat]);
      coords.push(coords[0]);
      return {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [coords] },
        properties: { ...cell },
      };
    }),
  };
}

function hexStyle(feature: any) {
  const c = feature.properties.color as DriftCell["color"];
  const fill =
    c === "green"  ? "rgba(102, 255, 82, 0.5)"  :
    c === "yellow" ? "rgba(255, 196, 0, 0.5)"   :
                     "rgba(254, 55, 55, 0.5)";
  return { fillColor: fill, fillOpacity: 1, weight: 0, color: "transparent" };
}

// ── Map controls component (needs map context) ─────────────────────────────

function ZoomControls() {
  const map = useMap();
  return (
    <div className="map-zoom-btns">
      <button className="zoom-btn" onClick={() => map.zoomIn()}>+</button>
      <button className="zoom-btn" onClick={() => map.zoomOut()}>−</button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MapComponent({
  driftCells,
  zoneSummary,
  timeHorizon,
  onTimeChange,
  onCellSelect,
  selectedCell,
}: MapProps) {
  const [geoData, setGeoData] = useState<ReturnType<typeof cellsToGeoJSON> | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  const activeCells = driftCells.length > 0 ? driftCells : getDemoCells();

  useEffect(() => {
    setGeoData(cellsToGeoJSON(activeCells));
  }, [driftCells]);

  const timeLabels: Record<string, string> = {
    "2w":     "2 Minggu",
    "1m":     "1 Bulan",
    "season": "Sisa Musim",
  };

  const overallStatus =
    zoneSummary.good >= 50 ? "Panen besar diperkirakan" :
    zoneSummary.risk >= 30  ? "Risiko tinggi terdeteksi"  :
                              "Perlu perhatian";

  const statusColor =
    zoneSummary.good >= 50 ? "#56FF4D" :
    zoneSummary.risk >= 30  ? "#FE3737" : "#FFC400";

  function onEachHex(feature: any, layer: any) {
    layer.on("click", (e: any) => {
      const rect = e.originalEvent.target.closest(".map-area")?.getBoundingClientRect()
        ?? { left: 0, top: 0, width: 600 };
      const POPUP_W = 310;
      const rawLeft = e.originalEvent.clientX - rect.left + 14;
      setPopupPos({
        top:  e.originalEvent.clientY - rect.top - 20,
        left: Math.min(rawLeft, rect.width - POPUP_W - 12),
      });
      onCellSelect(feature.properties as DriftCell);
    });
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={[-7.05, 107.56]}
        zoom={14}
        scrollWheelZoom
        className="leaflet-container"
        zoomControl={false}
      >
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {geoData && (
          <GeoJSON
            key={JSON.stringify(activeCells.map(c => c.h3_index))}
            data={geoData}
            style={hexStyle}
            onEachFeature={onEachHex}
          />
        )}
        <ZoomControls />
      </MapContainer>

      {/* Summary card — top left */}
      <div className="map-summary-card">
        <div style={{ fontSize: 14, color: "rgba(244,241,235,0.8)", marginBottom: 6 }}>
          Prediksi keseluruhan lahan -{" "}
          <strong style={{ color: "#fff" }}>{timeLabels[timeHorizon]}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: statusColor, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 18, color: "#fff" }}>{overallStatus}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { pct: zoneSummary.good,      label: "Zona pertumbuhan baik", color: "#56FF4D" },
            { pct: zoneSummary.attention, label: "Perlu perhatian",        color: "#FFC400" },
            { pct: zoneSummary.risk,      label: "Berisiko tinggi",        color: "#FE3737" },
          ].map(({ pct, label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "#F4F1EB" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              {pct}% {label}
            </div>
          ))}
        </div>
      </div>

      {/* Location pin — top right */}
      <div className="map-location-pin">
        <MapPin size={14} color="#F4F1EB" fill="#F4F1EB" strokeWidth={1} />
        Kec. Ciparay, Kab. Bandung
      </div>

      {/* Hex stress popup */}
      {selectedCell && popupPos && (
        <div
          className="map-hex-popup"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          <div style={{ fontWeight: 600, fontSize: 18, color: "#fff", marginBottom: 6 }}>
            {selectedCell.color === "red" ? "Stres terdeteksi" :
             selectedCell.color === "yellow" ? "Perlu perhatian" : "Zona sehat"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Dianalisis: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
            NDVI: {(0.45 + selectedCell.drift_score).toFixed(2)}
            &nbsp;&nbsp;Drift: {selectedCell.drift_score.toFixed(3)}
          </div>
          <p style={{ fontSize: 14, lineHeight: "20px", color: "rgba(255,255,255,0.5)" }}>
            {selectedCell.color === "red"
              ? "Kondisi tanah menunjukkan tanda kekeringan ringan sedang. Vegetasi mengalami penurunan kesehatan yang ditunjukkan oleh nilai NDVI rendah."
              : selectedCell.color === "yellow"
              ? "Terdeteksi perubahan lahan sedang. Pantau kondisi tanaman dalam 2 minggu ke depan."
              : "Kondisi lahan stabil. Tidak ada perubahan signifikan terdeteksi tahun ini."}
          </p>
          <button
            onClick={() => { onCellSelect(null); setPopupPos(null); }}
            style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
          >
            Tutup ×
          </button>
        </div>
      )}

      {/* Time filter buttons — bottom right */}
      <div className="map-time-buttons">
        {(["2w", "1m", "season"] as const).map(h => (
          <button
            key={h}
            className="time-btn"
            onClick={() => onTimeChange(h)}
            style={{ position: "relative" }}
          >
            {timeHorizon === h && (
              <motion.span
                layoutId="time-pill"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.45)",
                  zIndex: 0,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>
              {timeLabels[h]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
