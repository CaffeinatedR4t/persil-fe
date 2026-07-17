"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { DEMO_ZONE } from "@/lib/demo";
import MapWrapper from "@/components/MapWrapper";

// ── Types ──────────────────────────────────────────────────────────────────

type AlertColor = "green" | "yellow" | "red";
type TimeHorizon = "1w" | "1m" | "3m";

interface ForecastData {
  kabupaten_code: string;
  yield_deviation_pct: number;
  alert_color: AlertColor;
  ndvi_slope: number | null;
  ndvi_mean: number | null;
  rainfall_anomaly_mm: number | null;
  gemini_narration: string;
  insurance_trigger: boolean;
  is_proxy: boolean;
  cloud_fallback: boolean;
  ndvi_message: string | null;
}

export interface DriftCell {
  h3_index: string;
  color: "green" | "yellow" | "red";
  drift_score: number;
}

// ── Demo / fallback data (matches Figma values) ────────────────────────────

const DEMO_FORECAST: ForecastData = {
  kabupaten_code: "3204",
  yield_deviation_pct: -18,
  alert_color: "yellow",
  ndvi_slope: -0.08,
  ndvi_mean: 0.52,
  rainfall_anomaly_mm: -32,
  gemini_narration:
    "Model memprediksi kekurangan air akan berlanjut hingga masa panen. Disarankan menyiram dalam 3 hari ke depan untuk menjaga hasil panen.",
  insurance_trigger: false,
  is_proxy: false,
  cloud_fallback: false,
  ndvi_message: null,
};

const SEASON_DATA = [
  { season: "MH23", hist: 0.68, proj: null  },
  { season: "MK23", hist: 0.55, proj: null  },
  { season: "MH24", hist: 0.72, proj: null  },
  { season: "MK24", hist: 0.60, proj: null  },
  { season: "MH25", hist: 0.65, proj: null  },
  { season: "MK25", hist: 0.63, proj: 0.63  },
  { season: "MH26", hist: null,  proj: 0.52 },
];

const BASELINE_YIELD_TPHA = 4.85; // Kab. Bandung 5-yr avg
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ── Helpers ────────────────────────────────────────────────────────────────

function alertLabel(c: AlertColor) {
  return c === "red" ? "Bahaya" : c === "yellow" ? "Waspada" : "Normal";
}

function toAlertColor(pct: number): AlertColor {
  return pct <= -20 ? "red" : pct <= -10 ? "yellow" : "green";
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [forecast, setForecast] = useState<ForecastData>(DEMO_FORECAST);
  const [driftCells, setDriftCells] = useState<DriftCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<DriftCell | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("1w");
  const [activeNav, setActiveNav] = useState<"beranda" | "riwayat" | "laporan">("beranda");

  // Load forecast from API, fall back to Supabase, then demo data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/forecast/3204`);
        if (res.ok) { setForecast(await res.json()); return; }
      } catch { /* API not running, try Supabase */ }

      const { data } = await supabase
        .from("yield_forecasts")
        .select("*")
        .eq("kabupaten_code", "3204")
        .order("season_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setForecast({
          ...data,
          alert_color: data.alert_color ?? toAlertColor(data.yield_deviation_pct),
          gemini_narration: data.gemini_narration ?? DEMO_FORECAST.gemini_narration,
        });
      }
    })();
  }, []);

  // Load pre-computed drift cells
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("soil_drift")
        .select("h3_index, color, drift_score")
        .eq("year_a", 2023)
        .eq("year_b", 2024);

      if (data && data.length > 0) {
        setDriftCells(
          data.map((r: any) => ({
            ...r,
            color: r.color ?? (r.flagged ? "red" : "green"),
          }))
        );
      }
    })();
  }, []);

  const zoneSummary = driftCells.length === 0 ? DEMO_ZONE : (() => {
    const total = driftCells.length;
    return {
      good:      Math.round((driftCells.filter(c => c.color === "green").length  / total) * 100),
      attention: Math.round((driftCells.filter(c => c.color === "yellow").length / total) * 100),
      risk:      Math.round((driftCells.filter(c => c.color === "red").length    / total) * 100),
    };
  })();

  const deviation     = forecast.yield_deviation_pct;
  const predictedYield = (BASELINE_YIELD_TPHA * (1 + deviation / 100)).toFixed(1);
  const ndviDown       = (forecast.ndvi_slope ?? 0) < 0;

  return (
    <div className="root">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          {/* Leaf logo */}
          <svg width="37" height="31" viewBox="0 0 48 42" fill="none">
            <path d="M24 0C10.7 0 0 10.7 0 24c0 6.6 2.7 12.6 7 17 2-10.7 10.8-18.7 21.8-19.2C20.2 25.1 14 33.2 14 42h28C46.2 19.5 37 0 24 0z" fill="#F4F1EB" fillOpacity="0.9"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: 24, color: "#F4F1EB" }}>Persil</span>
        </div>

        <div className="navbar-nav">
          {(["beranda", "riwayat", "laporan"] as const).map(nav => (
            <button
              key={nav}
              className={`nav-item${activeNav === nav ? " nav-item-active" : ""}`}
              onClick={() => setActiveNav(nav)}
            >
              {nav.charAt(0).toUpperCase() + nav.slice(1)}
            </button>
          ))}
        </div>

        <div className="navbar-right">
          <button className="icon-btn" aria-label="Pengaturan">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="#F4F1EB">
              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.33.07-.67.07-1.08s-.03-.76-.07-1.08l2.32-1.82a.55.55 0 0 0 .13-.73l-2.2-3.81a.55.55 0 0 0-.67-.24l-2.73 1.1c-.57-.44-1.18-.8-1.86-1.08l-.41-2.91A.54.54 0 0 0 15.31 3H8.69a.54.54 0 0 0-.54.47L7.74 6.1c-.68.28-1.29.64-1.86 1.08L3.15 6.08a.53.53 0 0 0-.67.24L.27 10.13a.53.53 0 0 0 .13.73l2.32 1.82c-.04.32-.07.67-.07 1.08s.03.76.07 1.08L.4 16.86a.55.55 0 0 0-.13.73l2.2 3.81c.14.24.44.31.67.24l2.73-1.1c.57.44 1.18.8 1.86 1.08l.41 2.91c.04.28.27.47.54.47h4.41c.27 0 .5-.19.54-.47l.41-2.91c.68-.28 1.29-.64 1.86-1.08l2.73 1.1c.23.07.53 0 .67-.24l2.2-3.81c.14-.24.07-.54-.13-.73l-2.32-1.82z"/>
            </svg>
          </button>
          <div className="user-avatar">
            <span style={{ fontSize: 22 }}>👤</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 20, color: "#F4F1EB" }}>Budi Santoso</div>
            <div style={{ fontSize: 20, color: "rgba(244,241,235,0.5)" }}>Petani</div>
          </div>
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="content">

        {/* Riwayat / Laporan placeholder pages */}
        {activeNav !== "beranda" && (
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "rgba(244,241,235,0.5)" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
            </svg>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#F4F1EB" }}>
              {activeNav === "riwayat" ? "Riwayat Prediksi" : "Laporan Lahan"}
            </div>
            <div style={{ fontSize: 16, maxWidth: 380, textAlign: "center" }}>
              {activeNav === "riwayat"
                ? "Halaman ini akan menampilkan riwayat prediksi panen dari musim-musim sebelumnya."
                : "Halaman ini akan menampilkan laporan lengkap kondisi lahan dan rekomendasi tindakan."}
            </div>
            <button
              onClick={() => setActiveNav("beranda")}
              style={{ marginTop: 8, padding: "10px 24px", background: "rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 16, color: "#F4F1EB", cursor: "pointer" }}
            >
              Kembali ke Beranda
            </button>
          </div>
        )}

        {activeNav === "beranda" && <aside className="left-panel">

          {/* Greeting */}
          <h1 className="greeting">Selamat pagi, Pak Budi</h1>

          {/* AI Narration card */}
          <div className="glass-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <svg width="38" height="31" viewBox="0 0 48 42" fill="white" style={{ flexShrink: 0 }}>
                <path d="M24 0C10.7 0 0 10.7 0 24c0 6.6 2.7 12.6 7 17 2-10.7 10.8-18.7 21.8-19.2C20.2 25.1 14 33.2 14 42h28C46.2 19.5 37 0 24 0z" fillOpacity="0.9"/>
              </svg>
              <span style={{ fontWeight: 600, fontSize: 20, color: "#fff" }}>Prediksi lahanmu hari ini</span>
            </div>
            <p style={{ fontSize: 16, lineHeight: "21px", color: "#F4F1EB" }}>
              {forecast.gemini_narration || "Memuat analisis…"}
            </p>
            {forecast.is_proxy && (
              <p style={{ marginTop: 8, fontSize: 13, color: "rgba(244,241,235,0.5)" }}>
                ⚠ {forecast.ndvi_message}
              </p>
            )}
          </div>

          {/* Detail Lahan card */}
          <div className="glass-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
              <div style={{ fontWeight: 600, fontSize: 20, color: "#fff" }}>Detail Lahan</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "rgba(244,241,235,0.7)" }}>
                  <span style={{ width: 20, height: 2, background: "#56FF4D", display: "inline-block" }} />
                  Sejarah NDVI
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "rgba(244,241,235,0.7)" }}>
                  <span style={{ width: 20, height: 2, background: "#FE3737", display: "inline-block" }} />
                  Proyeksi
                </span>
              </div>
            </div>
            <div style={{ fontSize: 14, color: "rgba(244,241,235,0.6)", marginBottom: 10 }}>
              Indeks NDVI — 6 musim terakhir + proyeksi musim depan
            </div>

            {/* Season history chart */}
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={SEASON_DATA} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={true} horizontal={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="season"
                  tick={{ fill: "#F4F1EB", fontSize: 12, fontFamily: "Switzer" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0.38, 0.82]} />
                {/* Historical line — green */}
                <Line
                  dataKey="hist"
                  stroke="#56FF4D"
                  strokeWidth={2}
                  dot={{ fill: "#56FF4D", r: 5, strokeWidth: 0 }}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* Projection line — red */}
                <Line
                  dataKey="proj"
                  stroke="#FE3737"
                  strokeWidth={2}
                  dot={{ fill: "#FE3737", r: 5, strokeWidth: 0 }}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Metric chips */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
              <div className="metric-chip">
                <span style={{ fontSize: 14, color: "#F4F1EB", display: "block", marginBottom: 6 }}>Tren NDVI</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="29" height="15" viewBox="0 0 29 15" fill="none">
                    <path d="M0 0 L20 14 L28 6" stroke="#FF1717" strokeWidth="3" fill="none"/>
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: 20, color: "#fff" }}>
                    {forecast.ndvi_slope != null
                      ? (forecast.ndvi_slope > 0 ? "+" : "") + forecast.ndvi_slope.toFixed(2)
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="metric-chip">
                <span style={{ fontSize: 14, color: "#F4F1EB", display: "block", marginBottom: 6 }}>Anomali curah hujan</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="20" viewBox="0 0 16 22" fill="#FF1B1B">
                    <path d="M8 0 C8 0 0 10 0 15 a8 8 0 0 0 16 0 C16 10 8 0 8 0z"/>
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: 20, color: "#fff" }}>
                    {forecast.rainfall_anomaly_mm != null
                      ? `${forecast.rainfall_anomaly_mm > 0 ? "+" : ""}${forecast.rainfall_anomaly_mm}mm`
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="metric-chip">
                <span style={{ fontSize: 14, color: "#F4F1EB", display: "block", marginBottom: 6 }}>NDVI rata-rata</span>
                <span style={{ fontWeight: 600, fontSize: 20, color: "#fff" }}>
                  {forecast.ndvi_mean != null ? forecast.ndvi_mean.toFixed(2) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Yield Prediction card */}
          <div className="yield-card">
            <div className="yield-card-top">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 400, color: "#984215" }}>Prediksi Hasil Panen</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {forecast.is_proxy && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#984215", background: "rgba(152,66,21,0.15)", padding: "4px 10px", borderRadius: 12, border: "1px solid rgba(152,66,21,0.4)" }}>
                      heuristik demo
                    </span>
                  )}
                  {forecast.alert_color !== "green" && (
                    <span className="alert-badge">⚠ {alertLabel(forecast.alert_color)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <span style={{ fontWeight: 500, fontSize: 64, lineHeight: 1, color: "#984215" }}>
                  {deviation > 0 ? "+" : ""}{deviation}%
                </span>
                <span style={{ fontWeight: 700, fontSize: 18, lineHeight: "24px", color: "#984215", marginBottom: 4, maxWidth: 220 }}>
                  Diprediksi dibanding rata-rata 5 tahun terakhir, 3 minggu sebelum panen
                </span>
              </div>
            </div>

            <div className="yield-card-bottom">
              <div className="yield-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="26" height="29" viewBox="0 0 26 29" fill="white">
                    <rect x="0" y="5" width="26" height="24" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
                    <line x1="8" y1="0" x2="8" y2="10" stroke="white" strokeWidth="2"/>
                    <line x1="18" y1="0" x2="18" y2="10" stroke="white" strokeWidth="2"/>
                    <line x1="0" y1="13" x2="26" y2="13" stroke="white" strokeWidth="1.5"/>
                  </svg>
                  <span style={{ fontSize: 18, color: "#fff" }}>Perkiraan waktu panen</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 18, color: "#fff" }}>12 - 18 Agustus 2026</span>
              </div>
              <div className="yield-divider" />
              <div className="yield-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="26" height="29" viewBox="0 0 26 29" fill="white">
                    <path d="M13 0 C6 8 2 16 2 22 a11 11 0 0 0 22 0 C24 16 20 8 13 0z" fill="white" fillOpacity="0.9"/>
                  </svg>
                  <span style={{ fontSize: 18, color: "#fff" }}>Perkiraan hasil</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 18, color: "#fff" }}>
                  {predictedYield} ton/ha ({deviation > 0 ? "+" : ""}{deviation}%)
                </span>
              </div>
              {forecast.insurance_trigger && (
                <>
                  <div className="yield-divider" />
                  <div className="yield-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                      </svg>
                      <span style={{ fontSize: 16, color: "#fff" }}>Asuransi panen</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 16, color: "#fff" }}>Pembayaran terpicu</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontStyle: "italic" }}>SIMULASI — bukan produk keuangan nyata</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </aside>}

        {activeNav === "beranda" && (
          <div className="map-area">
            <MapWrapper
              driftCells={driftCells}
              zoneSummary={zoneSummary}
              timeHorizon={timeHorizon}
              onTimeChange={setTimeHorizon}
              onCellSelect={setSelectedCell}
              selectedCell={selectedCell}
            />
          </div>
        )}

      </div>
    </div>
  );
}
