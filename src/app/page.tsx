"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { TrendingUp, TrendingDown, Droplet, CalendarDays, Wheat, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { DEMO_ZONE } from "@/lib/demo";
import MapWrapper from "@/components/MapWrapper";
import RiwayatView from "@/components/RiwayatView";
import LaporanView from "@/components/LaporanView";

// ── Types ──────────────────────────────────────────────────────────────────

type AlertColor = "green" | "yellow" | "red";
type TimeHorizon = "2w" | "1m" | "season";

interface HistoryRow { year: number; ndvi_proxy: number; production_tons: number; }
interface HistoryData { baseline_tpha: number; history: HistoryRow[]; }

interface ForecastData {
  kabupaten_code: string;
  kabupaten_name?: string;
  season_end?: string;
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
  kabupaten_code: "3212",
  kabupaten_name: "Kabupaten Subang",
  season_end: "2024-09-30",
  yield_deviation_pct: -3.43,
  alert_color: "green",
  ndvi_slope: -0.02,
  ndvi_mean: 0.61,
  rainfall_anomaly_mm: -12,
  gemini_narration:
    "Kondisi lahan di Kabupaten Subang relatif stabil. Pantau ketersediaan air irigasi menjelang akhir musim.",
  insurance_trigger: false,
  is_proxy: false,
  cloud_fallback: false,
  ndvi_message: null,
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// Fallback chart data (shown while API loads or if offline)
const FALLBACK_SEASON_DATA = [
  { season: "2016", hist: 0.62, proj: null },
  { season: "2017", hist: 0.65, proj: null },
  { season: "2018", hist: 0.60, proj: null },
  { season: "2019", hist: 0.58, proj: null },
  { season: "2020", hist: 0.63, proj: null },
  { season: "2021", hist: 0.61, proj: null },
  { season: "Proyeksi", hist: null as any, proj: 0.56 },
];

// Helpers to build chart data from history API
function buildSeasonData(history: HistoryRow[], ndviMean?: number, deviationPct?: number) {
  const rows = history.slice(-6).map((h) => ({
    season: `${h.year}`,
    hist: h.ndvi_proxy,
    proj: null as number | null,
  }));
  // Project NDVI by scaling current mean by yield deviation ratio
  if (ndviMean != null && deviationPct != null) {
    const projected = parseFloat((ndviMean * (1 + deviationPct / 100)).toFixed(3));
    rows.push({ season: "Proyeksi", hist: null as any, proj: projected });
  }
  return rows;
}

// WIB greeting based on current time
function getGreeting(): string {
  const hour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

// Compute estimated harvest date from season_end + deviation
function computeHarvestWindow(seasonEnd?: string, deviationPct?: number): string {
  if (!seasonEnd) return "12 - 18 Agustus 2026";
  const end = new Date(seasonEnd);
  // Good crop: harvest near season end. Bad crop: earlier or delayed ~2 weeks
  const shift = deviationPct != null && deviationPct < -10 ? -14 : 0;
  const start = new Date(end);
  start.setDate(end.getDate() - 6 + shift);
  const endD = new Date(end);
  endD.setDate(end.getDate() + shift);
  const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `${start.getDate()} - ${fmt(endD)}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function alertLabel(c: AlertColor) {
  return c === "red" ? "Bahaya" : c === "yellow" ? "Waspada" : "Normal";
}

function toAlertColor(pct: number): AlertColor {
  return pct <= -20 ? "red" : pct <= -10 ? "yellow" : "green";
}

// Per-horizon zone distributions (demo fallback when no Supabase soil_drift data)
// Shorter horizons show less accumulated risk; "season" is the full model prediction
const HORIZON_ZONES: Record<TimeHorizon, { good: number; attention: number; risk: number }> = {
  "2w":     { good: 54, attention: 23, risk: 23 },
  "1m":     { good: 38, attention: 23, risk: 39 },
  "season": DEMO_ZONE,
};

// Scale the season deviation down for shorter horizons
// 2w = current NDVI signal only (30% of full deviation); 1m = 60%; season = 100%
const HORIZON_SCALE: Record<TimeHorizon, number> = { "2w": 0.3, "1m": 0.6, "season": 1.0 };

const HORIZON_NARRATION_PREFIX: Record<TimeHorizon, string> = {
  "2w":    "Kondisi 2 minggu ke depan — berbasis NDVI terkini: ",
  "1m":    "Proyeksi 1 bulan ke depan — berbasis NDVI dan curah hujan: ",
  "season": "",
};

// ── Framer Motion Variants ───────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { 
      duration: 0.6,
      delay: 2.2, 
      staggerChildren: 0.15, 
      delayChildren: 2.5 
    }
  }
};

const leftItemVariants = {
  hidden: { opacity: 0, x: -50 },
  show: { opacity: 1, x: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }
};

const mapVariants = {
  hidden: { opacity: 0, scale: 0.96, x: 30 },
  show: { opacity: 1, scale: 1, x: 0, transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] } }
};

const navVariants = {
  hidden: { opacity: 0, y: -20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [forecast, setForecast] = useState<ForecastData>(DEMO_FORECAST);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [driftCells, setDriftCells] = useState<DriftCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<DriftCell | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("season");
  const [activeNav, setActiveNav] = useState<"beranda" | "riwayat" | "laporan">("beranda");
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => setIsAppLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  // Load forecast + history from API, fall back to Supabase, then demo data
  useEffect(() => {
    (async () => {
      const code = "3212"; // Kabupaten Subang (Sukamandi)
      try {
        const [fRes, hRes] = await Promise.all([
          fetch(`${API_BASE}/forecast/${code}`),
          fetch(`${API_BASE}/history/${code}`),
        ]);
        if (fRes.ok) setForecast(await fRes.json());
        if (hRes.ok) setHistoryData(await hRes.json());
        if (fRes.ok) return;
      } catch { /* API not running, try Supabase */ }

      const { data } = await supabase
        .from("yield_forecasts")
        .select("*")
        .eq("kabupaten_code", code)
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

  // Load pre-computed drift cells from Feature B
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("soil_drift")
        .select("h3_index, drift_score, flagged, threshold")
        .eq("year_a", 2023)
        .eq("year_b", 2024);

      if (data && data.length > 0) {
        setDriftCells(
          data.map((r: any) => ({
            h3_index:    r.h3_index,
            drift_score: r.drift_score ?? 0,
            color: r.flagged
              ? "red"
              : (r.drift_score ?? 0) > (r.threshold ?? 0.05) * 0.6
              ? "yellow"
              : "green",
          }))
        );
      }
    })();
  }, []);

  const zoneSummary = driftCells.length > 0
    ? (() => {
        const total = driftCells.length;
        return {
          good:      Math.round((driftCells.filter(c => c.color === "green").length  / total) * 100),
          attention: Math.round((driftCells.filter(c => c.color === "yellow").length / total) * 100),
          risk:      Math.round((driftCells.filter(c => c.color === "red").length    / total) * 100),
        };
      })()
    : HORIZON_ZONES[timeHorizon];

  const baseDeviation  = forecast.yield_deviation_pct;
  const deviation      = parseFloat((baseDeviation * HORIZON_SCALE[timeHorizon]).toFixed(2));
  const displayAlertColor: AlertColor = toAlertColor(deviation);
  const baselineTpha   = historyData?.baseline_tpha ?? 5.2;
  const predictedYield = (baselineTpha * (1 + deviation / 100)).toFixed(1);
  const ndviDown       = (forecast.ndvi_slope ?? 0) < 0;
  const harvestWindow  = computeHarvestWindow(forecast.season_end, baseDeviation);
  const narration      = HORIZON_NARRATION_PREFIX[timeHorizon] + forecast.gemini_narration;
  const seasonData     = historyData
    ? buildSeasonData(historyData.history, forecast.ndvi_mean ?? undefined, deviation)
    : FALLBACK_SEASON_DATA;

  return (
    <>
      <AnimatePresence>
        {isAppLoading && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(182.14deg, #000000 1.8%, #223A3F 65%, #2C4121 100%)"
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <Image
                src="/persil logo vector w font.svg"
                alt="Persil Loading..."
                width={200}
                height={56}
                style={{ filter: "brightness(0) invert(1)" }}
                priority
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="root"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <motion.nav className="navbar" variants={navVariants}>
        <div className="navbar-brand">
          <Image
            src="/persil logo vector w font.svg"
            alt="Persil"
            width={120}
            height={34}
            style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
            priority
          />
        </div>

        <div className="navbar-nav">
          {(["beranda", "riwayat", "laporan"] as const).map(nav => (
            <button
              key={nav}
              className="nav-item"
              style={{ position: "relative" }}
              onClick={() => setActiveNav(nav)}
            >
              {activeNav === nav && (
                <motion.span
                  layoutId="nav-pill"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    zIndex: 0,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span style={{
                position: "relative",
                zIndex: 1,
                fontWeight: activeNav === nav ? 600 : 400,
                color: activeNav === nav ? "#F4F1EB" : "rgba(244,241,235,0.65)",
                transition: "color 0.2s",
              }}>
                {nav.charAt(0).toUpperCase() + nav.slice(1)}
              </span>
            </button>
          ))}
        </div>

        <div className="navbar-right" />
      </motion.nav>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="content">

        {/* Riwayat View */}
        {activeNav === "riwayat" && <RiwayatView historyData={historyData} forecast={forecast} />}

        {/* Laporan View */}
        {activeNav === "laporan" && <LaporanView driftCells={driftCells} zoneSummary={zoneSummary} />}

        <aside className="left-panel" style={{ display: activeNav === "beranda" ? undefined : "none" }}>

          {/* Greeting */}
          <motion.h1 className="greeting" variants={leftItemVariants}>
            {getGreeting()}, User
          </motion.h1>

          {/* AI Narration card */}
          <motion.div className="glass-card" variants={leftItemVariants}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Image
                src="/Persil logo vector.svg"
                alt="Persil"
                width={32}
                height={32}
                style={{ filter: "brightness(0) invert(1)", flexShrink: 0 }}
              />
              <span style={{ fontWeight: 600, fontSize: 20, color: "#fff" }}>Prediksi lahanmu hari ini</span>
            </div>
            <p style={{ fontSize: 16, lineHeight: "21px", color: "#F4F1EB" }}>
              {narration || "Memuat analisis…"}
            </p>
            {forecast.is_proxy && (
              <p style={{ marginTop: 8, fontSize: 13, color: "rgba(244,241,235,0.5)" }}>
                ⚠ {forecast.ndvi_message}
              </p>
            )}
          </motion.div>

          {/* Detail Lahan card */}
          <motion.div className="glass-card" variants={leftItemVariants}>
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
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={seasonData ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
                  {(forecast.ndvi_slope ?? 0) >= 0
                    ? <TrendingUp  size={22} color="#56FF4D" />
                    : <TrendingDown size={22} color="#FF1717" />
                  }
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
                  <Droplet size={18} color="#FF1B1B" fill="#FF1B1B" />
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
          </motion.div>

          {/* Yield Prediction card */}
          <motion.div className="yield-card" variants={leftItemVariants}>
            <div className="yield-card-top">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 400, color: "#984215" }}>Prediksi Hasil Panen</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {forecast.is_proxy && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#984215", background: "rgba(152,66,21,0.15)", padding: "4px 10px", borderRadius: 12, border: "1px solid rgba(152,66,21,0.4)" }}>
                      heuristik demo
                    </span>
                  )}
                  {displayAlertColor !== "green" && (
                    <span className="alert-badge">⚠ {alertLabel(displayAlertColor)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <span style={{ fontWeight: 500, fontSize: 64, lineHeight: 1, color: "#984215" }}>
                  {deviation > 0 ? "+" : ""}{deviation}%
                </span>
                <span style={{ fontWeight: 700, fontSize: 18, lineHeight: "24px", color: "#984215", marginBottom: 4, maxWidth: 220 }}>
                  {timeHorizon === "2w"
                    ? "Proyeksi 2 minggu ke depan berbasis NDVI terkini"
                    : timeHorizon === "1m"
                    ? "Proyeksi 1 bulan ke depan berbasis NDVI dan curah hujan"
                    : "Diprediksi dibanding rata-rata 5 tahun terakhir, sisa musim ini"}
                </span>
              </div>
            </div>

            <div className="yield-card-bottom">
              <div className="yield-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CalendarDays size={18} color="white" />
                  <span style={{ fontSize: 18, color: "#fff" }}>Perkiraan waktu panen</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 18, color: "#fff" }}>{harvestWindow}</span>
              </div>
              <div className="yield-divider" />
              <div className="yield-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Wheat size={18} color="white" />
                  <span style={{ fontSize: 18, color: "#fff" }}>Perkiraan hasil</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 18, color: "#fff" }}>
                  {predictedYield} ton/ha ({deviation > 0 ? "+" : ""}{deviation}%)
                </span>
              </div>
              {deviation <= -20 && (
                <>
                  <div className="yield-divider" />
                  <div className="yield-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ShieldCheck size={16} color="white" />
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
          </motion.div>

        </aside>

        <div className="map-area" style={{ display: activeNav === "beranda" ? undefined : "none" }}>
          <MapWrapper
            driftCells={driftCells}
            zoneSummary={zoneSummary}
            timeHorizon={timeHorizon}
            onTimeChange={setTimeHorizon}
            onCellSelect={setSelectedCell}
            selectedCell={selectedCell}
          />
        </div>

      </div>
      </motion.div>
    </>
  );
}
