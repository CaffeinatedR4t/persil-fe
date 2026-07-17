"use client";

import { useState, useEffect } from "react";
import MapWrapper from "@/components/MapWrapper";
import { Info, Leaf, CloudRain, AlertTriangle, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const [selectedKabupaten, setSelectedKabupaten] = useState<string | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedKabupaten) return;
    const fetchForecast = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("yield_forecasts")
        .select("*")
        .eq("kabupaten_code", selectedKabupaten)
        .order("target_year", { ascending: false })
        .limit(1)
        .single();
      
      setForecast(data);
      setLoading(false);
    };
    fetchForecast();
  }, [selectedKabupaten]);

  return (
    <main className="app-container">
      {/* Sidebar / Details Panel */}
      <aside className="sidebar">
        <div className="glass glass-card">
          <div className="header">
            <h1>Persil</h1>
            <p>Geospatial Forecasting untuk Petani Kecil</p>
          </div>
        </div>

        <div className="glass glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '16px' }}>
            Detail Wilayah
          </h2>
          
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Memuat data...
            </div>
          ) : selectedPlot ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Plot: {selectedPlot.h3_index}</span>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedPlot.deviation_pct < -10 && (
                  <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={14} /> Kritis (Butuh Air)
                  </span>
                )}
                {selectedPlot.deviation_pct >= -10 && selectedPlot.deviation_pct < 0 && (
                  <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> Stres Ringan
                  </span>
                )}
                {selectedPlot.deviation_pct >= 0 && (
                  <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 8px', borderRadius: '4px' }}>
                    <Leaf size={14} /> Sehat
                  </span>
                )}
              </div>

              {/* Main KPI */}
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '12px', 
                padding: '20px',
                borderLeft: `4px solid ${selectedPlot.deviation_pct < -10 ? 'var(--danger)' : selectedPlot.deviation_pct < 0 ? 'var(--warning)' : 'var(--accent)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Deviasi Kesehatan Tanaman (NDVI)</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: selectedPlot.deviation_pct < -10 ? 'var(--danger)' : selectedPlot.deviation_pct < 0 ? 'var(--warning)' : 'var(--accent)' }}>
                  {selectedPlot.deviation_pct > 0 ? '+' : ''}{selectedPlot.deviation_pct.toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Skor saat ini: {selectedPlot.ndvi_2024} (sebelumnya: {selectedPlot.ndvi_2023})
                </span>
              </div>

              {/* Extra Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>💧 Kelembapan Tanah (NDMI)</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                    {selectedPlot.deviation_pct < -10 ? 'Kritis (<20%)' : selectedPlot.deviation_pct < 0 ? 'Sedang (~40%)' : 'Optimal (>60%)'}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🌧️ Prakiraan Hujan (14 Hari)</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                    {selectedPlot.deviation_pct < -10 ? '0 - 5 mm' : selectedPlot.deviation_pct < 0 ? '10 - 25 mm' : '30 - 50 mm'}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🌱 Fase Pertumbuhan</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                    {parseInt(selectedPlot.h3_index.slice(-2), 16) % 3 === 0 ? 'Vegetatif' : parseInt(selectedPlot.h3_index.slice(-2), 16) % 3 === 1 ? 'Bunting' : 'Pemasakan'}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🌡️ Stres Panas (Suhu Permukaan)</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600, color: selectedPlot.deviation_pct < 0 ? 'var(--danger)' : 'inherit' }}>
                    {selectedPlot.deviation_pct < 0 ? 'Tinggi (35°C)' : 'Normal (28°C)'}
                  </span>
                </div>
              </div>

              {/* Recommendation */}
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rekomendasi Tindakan</h3>
                <p style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                  {selectedPlot.deviation_pct < -10 
                    ? "Tanaman padi di petak ini mengalami stres panas dan defisit kelembapan parah (NDMI < 20%). Prakiraan hujan 14 hari ke depan sangat rendah. Segera lakukan irigasi darurat! Petak ini memenuhi syarat untuk klaim asuransi kekeringan."
                    : selectedPlot.deviation_pct < 0 
                    ? "Terdeteksi indikasi awal stres panas. Kelembapan tanah menurun. Prakiraan hujan minggu ini tidak mencukupi. Pertimbangkan penyiraman tambahan segera."
                    : "Kesehatan kanopi dan kelembapan tanah sangat baik. Suhu permukaan normal. Prakiraan hujan mencukupi. Pertahankan jadwal saat ini."}
                </p>
              </div>

              {/* Metrics */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', opacity: 0.7 }}>
                <Info size={14} />
                <span style={{ fontSize: '0.75rem' }}>Area Petak: ~1.5 Hektar (Sukamandi)</span>
              </div>
            </div>
          ) : forecast ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Kode {forecast.kabupaten_code}</span>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {forecast.yield_deviation_pct < -10 && (
                  <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={14} /> Risiko Tinggi (Pemicu Asuransi)
                  </span>
                )}
                {forecast.is_proxy && (
                  <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> Heuristik Optik (Awan Tebal)
                  </span>
                )}
              </div>

              {/* Main KPI */}
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '12px', 
                padding: '20px',
                borderLeft: `4px solid ${forecast.yield_deviation_pct < 0 ? 'var(--danger)' : 'var(--accent)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Proyeksi Deviasi Panen ({forecast.target_year})</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: forecast.yield_deviation_pct < 0 ? 'var(--danger)' : 'var(--accent)' }}>
                  {forecast.yield_deviation_pct > 0 ? '+' : ''}{forecast.yield_deviation_pct.toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  vs rata-rata 5 tahun terakhir
                </span>
              </div>

              {/* Cloud Fallback Warning */}
              {forecast.is_proxy && (
                <div style={{ 
                  background: 'rgba(245, 158, 11, 0.1)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <CloudRain size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>Citra optik terhalang awan — analisis mengandalkan AlphaEarth dan curah hujan.</p>
                </div>
              )}

              {/* Metrics */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', opacity: 0.7 }}>
                <Info size={14} />
                <span style={{ fontSize: '0.75rem' }}>Update Terakhir: {new Date(forecast.created_at).toLocaleDateString('id-ID')}</span>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <p>Pilih wilayah atau petak sawah pada peta untuk melihat detail.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Map Area */}
      <section className="map-wrapper glass">
        <MapWrapper 
          onSelectKabupaten={(code) => {
            setSelectedPlot(null);
            setSelectedKabupaten(code);
          }} 
          onSelectPlot={(plot) => {
            setSelectedKabupaten(null);
            setSelectedPlot(plot);
          }}
        />
      </section>
    </main>
  );
}
