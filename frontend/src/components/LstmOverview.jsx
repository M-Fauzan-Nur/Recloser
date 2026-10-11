import { useEffect, useState } from 'react';

const SCENARIO_IDS = ['a', 'b', 'c', 'd', 'e'];
const SCENARIO_NAMES = {
  a: 'Scenario A',
  b: 'Scenario B',
  c: 'Scenario C',
  d: 'Scenario D',
  e: 'Scenario E',
};
const KAT_COLOR = {
  RENDAH: 'var(--color-primary)',
  SEDANG: 'var(--color-warning)',
  TINGGI: 'var(--color-orange)',
  KRITIS: 'var(--color-danger)',
};

function BadgeKategori({ k }) {
  const cls = `kat-${k.toLowerCase()}`;
  return <span className={`kategori-badge ${cls}`}>{k}</span>;
}

function RiskDistribution({ kd }) {
  const total = Object.values(kd || {}).reduce((s, v) => s + v, 0) || 1;
  const cats = ['RENDAH', 'SEDANG', 'TINGGI', 'KRITIS'];
  return (
    <div className="risk-distribution">
      {cats.map((c) => {
        const v = (kd || {})[c] || 0;
        const pct = Math.round((v / total) * 100);
        return (
          <div key={c} className="risk-cell">
            <div className="risk-cell-label">{c}</div>
            <div className="risk-cell-value">{v}</div>
            <div className="risk-cell-bar">
              <div
                className="risk-cell-bar-fill"
                style={{ width: `${pct}%`, background: KAT_COLOR[c] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LstmOverview({ onSelectScenario, authFetch }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SCENARIO_IDS.map((id) =>
        (authFetch
          ? authFetch(`${API}/api/scenarios/${id}/lstm/predict`, { method: 'POST' })
          : fetch(`${API}/api/scenarios/${id}/lstm/predict`, { method: 'POST' })
        )
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
          .then((d) => ({ id, ...d }))
      )
    )
      .then((data) => { if (!cancelled) { setRows(data); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="loading">Memuat prediksi LSTM…</p>;
  if (error) return <p className="error">Backend error: {error}</p>;

  return (
    <>
      <h1>LSTM Overview</h1>
      <p className="subtitle">
        Hasil fault-risk prediction (cached LSTM outputs) untuk 5 skenario.
        Output LSTM tidak melatih ulang; jalur <code>cached_csv</code> dipakai.
      </p>

      {rows.map((r) => {
        const kd = r.kategori_distribution || {};
        return (
          <div key={r.id} className="section-card">
            <div className="section-card-header">
              <h3>{SCENARIO_NAMES[r.id] || r.scenario_name}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`status-pill ${r.source === 'live' ? 'success' : 'warning'}`}>
                  {r.source === 'live' ? 'Live' : 'Cached'}
                </span>
                <button className="link-btn" onClick={() => onSelectScenario?.(r.id)}>
                  Buka detail
                </button>
              </div>
            </div>

            <h3 className="section-title">Dataset Information</h3>
            <div className="metric-row">
              <span className="metric-pill">File: <strong>{r.file_name}</strong></span>
              <span className="metric-pill">Total rows: <strong>{r.total_rows}</strong></span>
              <span className="metric-pill">Data rows used: <strong>{r.data_rows_used}</strong></span>
              <span className="metric-pill">Columns: <strong>{r.columns?.length}</strong></span>
            </div>

            <h3 className="section-title">Prediction Summary</h3>
            <div className="metric-row">
              <span className="metric-pill">Status: <strong>{r.status}</strong></span>
              <span className="metric-pill">scenario_id: <strong>{r.scenario_id}</strong></span>
              <span className="metric-pill">prediction rows: <strong>{r.preview_rows?.length || 0}</strong></span>
            </div>

            <h3 className="section-title">Risk Category</h3>
            <RiskDistribution kd={kd} />
            <div className="metric-row" style={{ marginTop: 8 }}>
              {Object.entries(kd).map(([k, v]) => (
                <span key={k} className="metric-pill">
                  <BadgeKategori k={k} /> {v} line
                </span>
              ))}
            </div>

            <h3 className="section-title">Prediction Table</h3>
            <div className="table-wrap">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    {r.columns?.map((c) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {r.preview_rows?.map((row, i) => (
                    <tr key={i}>
                      {r.columns?.map((c) => (
                        <td key={c} style={{ fontFamily: 'var(--font-mono)' }}>
                          {row[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}