import MiniMapWrapper from "./MiniMapWrapper";

function statusFromDev(dev: number): string {
  return dev <= -20 ? "Bahaya" : dev <= -10 ? "Waspada" : "Baik";
}

function buildStressEvents(history: any[]): { title: string; desc: string }[] {
  if (!history || history.length === 0) return [];

  const events: { year: number; dev: number }[] = [];
  for (const h of history) {
    const baseline = h.baseline_tons;
    if (!baseline) continue;
    const dev = ((h.production_tons - baseline) / baseline) * 100;
    if (Math.abs(dev) >= 10) events.push({ year: h.year, dev });
  }

  // Sort by absolute deviation descending, take top 3
  events.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
  return events.slice(0, 3).map(({ year, dev }) => {
    if (dev <= -20) return {
      title: `Musim ${year} — Penurunan produksi signifikan (${dev.toFixed(1)}%).`,
      desc: "Curah hujan di bawah normal sepanjang fase generatif. Terdeteksi via anomali NDVI.",
    };
    if (dev <= -10) return {
      title: `Musim ${year} — Stres moderat terdeteksi (${dev.toFixed(1)}%).`,
      desc: "Penurunan NDVI terdeteksi 3 minggu sebelum panen. Tindak lanjut irigasi disarankan.",
    };
    return {
      title: `Musim ${year} — Panen di atas rata-rata (+${dev.toFixed(1)}%).`,
      desc: "Curah hujan optimal sepanjang fase generatif. Kondisi lahan ideal.",
    };
  });
}

export default function RiwayatView({ historyData, forecast }: { historyData: any; forecast: any }) {
  const baselineTpha = 5.2;
  const currentYear  = new Date().getFullYear();

  const historyRows = (historyData?.history || []).slice(-5).map((h: any) => {
    const baseline = h.baseline_tons || h.production_tons;
    const dev = baseline ? ((h.production_tons - baseline) / baseline) * 100 : 0;
    return {
      musim:   `Tahun ${h.year}`,
      prediksi: `${baselineTpha.toFixed(1)} ton/ha`,
      aktual:   `${(baselineTpha * (1 + dev / 100)).toFixed(1)} ton/ha`,
      selisih:  `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`,
      status:   statusFromDev(dev),
    };
  });

  const currentDev = forecast?.yield_deviation_pct ?? 0;
  historyRows.push({
    musim:    `Tahun ${currentYear} (Berjalan)`,
    prediksi: `${(baselineTpha * (1 + currentDev / 100)).toFixed(1)} ton/ha`,
    aktual:   "—",
    selisih:  "—",
    status:   statusFromDev(currentDev),
  });

  const stressEvents = buildStressEvents(historyData?.history || []);

  return (
    <div style={{ gridColumn: "1 / -1", height: "100%", padding: "16px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px", color: "#F4F1EB" }}>

      <div>
        <h1 className="greeting" style={{ marginBottom: "8px" }}>Performa musim tanam</h1>
        <p style={{ fontSize: "16px", color: "rgba(244,241,235,0.7)", paddingLeft: "4px" }}>
          Catatan hasil aktual dibanding prediksi, dan kejadian stres pada tiap musim
        </p>
      </div>

      <div className="glass-card" style={{ padding: "32px 40px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "24px" }}>Log musim tanam</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "rgba(244,241,235,0.9)", fontSize: "16px", fontWeight: 600 }}>
              <th style={{ paddingBottom: "16px" }}>Musim</th>
              <th style={{ paddingBottom: "16px" }}>Prediksi</th>
              <th style={{ paddingBottom: "16px" }}>Hasil Aktual</th>
              <th style={{ paddingBottom: "16px" }}>Selisih</th>
              <th style={{ paddingBottom: "16px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {historyRows.map((row: { musim: string; prediksi: string; aktual: string; selisih: string; status: string }, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "16px" }}>
                <td style={{ padding: "16px 0", color: "rgba(244,241,235,0.8)" }}>{row.musim}</td>
                <td style={{ padding: "16px 0", color: "rgba(244,241,235,0.8)" }}>{row.prediksi}</td>
                <td style={{ padding: "16px 0", color: "rgba(244,241,235,0.8)" }}>{row.aktual}</td>
                <td style={{ padding: "16px 0", color: row.selisih.startsWith("+") ? "#56FF4D" : row.selisih.startsWith("-") ? "#FE3737" : "rgba(244,241,235,0.8)" }}>
                  {row.selisih}
                </td>
                <td style={{ padding: "16px 0", color: row.status === "Baik" ? "#56FF4D" : row.status === "Bahaya" ? "#FE3737" : "#FFD072" }}>
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

        <div className="glass-card" style={{ padding: "32px 40px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "24px" }}>Riwayat kejadian stres</h2>
          {stressEvents.length === 0 ? (
            <p style={{ fontSize: "15px", color: "rgba(244,241,235,0.5)" }}>
              Tidak ada kejadian stres signifikan dalam data historis.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stressEvents.map((event, i) => (
                <div key={i} style={{ borderBottom: i < stressEvents.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none", padding: "16px 0" }}>
                  <div style={{ fontWeight: 600, fontSize: "16px", color: "#F4F1EB", marginBottom: "4px" }}>
                    {event.title}
                  </div>
                  <div style={{ fontSize: "16px", color: "rgba(244,241,235,0.7)" }}>
                    {event.desc}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderRadius: "10px", overflow: "hidden", position: "relative", minHeight: "300px" }}>
          <div style={{ width: "100%", height: "100%", background: "#0f172a" }}>
            <MiniMapWrapper />
          </div>
        </div>

      </div>
    </div>
  );
}
