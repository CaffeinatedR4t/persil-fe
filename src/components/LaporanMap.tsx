"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import * as h3 from "h3-js";
import type { LaporanMapProps } from "./LaporanMapWrapper";
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
  return { fillColor: fill, fillOpacity: 1, weight: 1, color: "rgba(255,255,255,0.4)" };
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="map-zoom-btns" style={{ bottom: "auto", top: "120px" }}>
      <button className="zoom-btn" onClick={() => map.zoomIn()}>+</button>
      <button className="zoom-btn" onClick={() => map.zoomOut()}>−</button>
    </div>
  );
}

export default function LaporanMap({ driftCells, zoneSummary }: LaporanMapProps) {
  const [geoData, setGeoData] = useState<ReturnType<typeof cellsToGeoJSON> | null>(null);
  const activeCells = driftCells.length > 0 ? driftCells : getDemoCells();

  useEffect(() => {
    setGeoData(cellsToGeoJSON(activeCells));
  }, [driftCells]);

  const numRed = activeCells.filter(c => c.color === "red").length;

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
          />
        )}
        <ZoomControls />
      </MapContainer>

      {/* Top Left: Legend */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 1000, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", padding: "12px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", marginBottom: 6 }}>
          <span style={{ width: 12, height: 12, background: "#56FF4D", borderRadius: 4 }} /> Sehat
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", marginBottom: 6 }}>
          <span style={{ width: 12, height: 12, background: "#FFC400", borderRadius: 4 }} /> Stres ringan
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
          <span style={{ width: 12, height: 12, background: "#FE3737", borderRadius: 4 }} /> Kritis (&#60;-10%)
        </div>
      </div>

      {/* Top Right: Location */}
      <div className="map-location-pin" style={{ top: 20, right: 20 }}>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="#F4F1EB" style={{ overflow: "visible" }}>
          <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5C5.62 9.5 4.5 8.38 4.5 7S5.62 4.5 7 4.5 9.5 5.62 9.5 7 8.38 9.5 7 9.5z"/>
        </svg>
        Kec. Ciparay, Kab. Bandung
      </div>

      {/* Bottom Overlays Grid */}
      <div style={{ position: "absolute", bottom: 20, left: 20, right: 20, zIndex: 1000, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        
        {/* Ringkasan Desa */}
        <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(16px)", padding: "20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ringkasan Desa</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 16, lineHeight: "20px" }}>
            Ringkasan hasil, prediksi, dan riwayat musim — siap diserahkan ke koperasi atau pembeli.
          </p>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{zoneSummary.good}%</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Sehat</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{zoneSummary.attention}%</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Stres ringan</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{zoneSummary.risk}%</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Kritis</div>
            </div>
          </div>
        </div>

        {/* Prioritas Intervensi */}
        <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(16px)", padding: "20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Prioritas Intervensi</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: "22px" }}>
            {numRed} petak berstatus kritis teridentifikasi di sisi timur laut desa. Rekomendasi: distribusi pompa air dalam 5 hari ke depan.
          </p>
        </div>

        {/* Kelayakan Asuransi */}
        <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(16px)", padding: "20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Kelayakan Asuransi Parametrik</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: "22px" }}>
            {numRed > 0 ? numRed : 8} petak memenuhi ambang deviasi NDVI &#60;-20% dan layak diajukan klaim otomatis tanpa inspeksi lapangan.
          </p>
        </div>

      </div>
    </div>
  );
}
