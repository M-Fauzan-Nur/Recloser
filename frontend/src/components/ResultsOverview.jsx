import { useEffect, useState } from 'react';
import LineChart from './LineChart.jsx';

const SCENARIO_IDS = ['a', 'b', 'c', 'd', 'e'];
const SCENARIO_COLORS = {
  a: '#047857',
  b: '#b45309',
  c: '#c2410c',
  d: '#b91c1c',
  e: '#1e3a8a',
};
const SCENARIO_NAMES = {
  a: 'Scenario A',
  b: 'Scenario B',
  c: 'Scenario C',
  d: 'Scenario D',
  e: 'Scenario E',
};
const AUTO_NUM_RECLOSERS = [1, 2, 3, 4];
const TOTAL_AUTO = SCENARIO_IDS.length * AUTO_NUM_RECLOSERS.length;

function fmtPct(v) {
  const arrow = v >= 0 ? '▼' : '▲';
  return `${arrow} ${Math.abs(v).toFixed(1)}%`;
}

function parseKey(key) {
  const lastPipe = key.lastIndexOf('|');
  if (lastPipe < 0) return { scenarioId: key, numReclosers: null };
  return {
    scenarioId: key.slice(0, lastPipe),
    numReclosers: Number(key.slice(lastPipe + 1)),
  };
}

function buildSeries(entries, valueFn) {
  return SCENARIO_IDS.map((sid) => {
    const points = entries
      .filter((e) => e.scenarioId === sid)
      .map((e) => ({ x: e.numReclosers, y: valueFn(e.result) }))
      .filter((p) => p.y != null && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    return { name: SCENARIO_NAMES[sid], color: SCENARIO_COLORS[sid], points };
  });
}

export default function ResultsOverview({ abcCache, abcInFlight, runAbc, onSelectMenu, onSelectScenario }) {
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoProgress, setAutoProgress] = useState({ done: 0, total: TOTAL_AUTO });

  // Auto-load: ensure cache has 5 scenarios × numReclosers 1-4 = 20 results
  // before showing charts. Uses runAbc which itself reads/writes abcCache.
  useEffect(() => {
    if (!runAbc) return;
    let cancelled = false;
    const missing = [];
    for (const sid of SCENARIO_IDS) {
      for (const n of AUTO_NUM_RECLOSERS) {
        const key = `${sid}|${n}`;
        if (!abcCache[key]) missing.push({ sid, n, key });
      }
    }
    if (missing.length === 0) {
      setAutoProgress({ done: TOTAL_AUTO, total: TOTAL_AUTO });
      return;
    }
    setAutoLoading(true);
    setAutoProgress({ done: TOTAL_AUTO - missing.length, total: TOTAL_AUTO });
    (async () => {
      let done = TOTAL_AUTO - missing.length;
      for (const { sid, n } of missing) {
        if (cancelled) return;
        try {
          await runAbc(sid, n);
        } catch (e) {
          // Continue with other pairs; don't block UI
          if (typeof console !== 'undefined') console.error('ABC auto-load failed', sid, n, e);
        }
        done += 1;
        if (!cancelled) setAutoProgress({ done, total: TOTAL_AUTO });
      }
      if (!cancelled) setAutoLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAbc]);

  const entries = Object.entries(abcCache || {})
    .filter(([, r]) => r && r.parameters)
    .map(([key, r]) => ({ key, ...parseKey(key), result: r }))
    .filter((e) => SCENARIO_IDS.includes(e.scenarioId) && AUTO_NUM_RECLOSERS.includes(e.numReclosers))
    .sort((a, b) => {
      if (a.scenarioId !== b.scenarioId) return a.scenarioId.localeCompare(b.scenarioId);
      return (a.numReclosers || 0) - (b.numReclosers || 0);
    });

  if (entries.length === 0 && !autoLoading) {
    return (
      <>
        <h1>Results</h1>
        <p className="subtitle">Rekap hasil optimasi ABC untuk semua skenario.</p>
        <div className="empty-state">
          <p>Belum ada hasil optimasi.</p>
          <p>Login sebagai Admin untuk menjalankan ABC Optimization.</p>
        </div>
      </>
    );
  }

  const saidiSeries = buildSeries(entries, (r) => r.improvement?.saidi_pct);
  const saifiSeries = buildSeries(entries, (r) => r.improvement?.saifi_pct);
  const riskSeries = buildSeries(entries, (r) => r.improvement?.risk_remaining_pct);
  const fitnessSeries = buildSeries(entries, (r) => r.optimal?.fitness);
  const totalCached = entries.length;

  return (
    <>
      <h1>Results</h1>
      <p className="subtitle">
        Rekap akhir optimasi ABC per skenario per jumlah recloser (cached, tanpa re-komputasi).
        Grafik menggunakan nilai hasil ABC yang sebenarnya.
      </p>

      <div className="section-card">
        <div className="section-card-header">
          <h3>Progress Auto-Load</h3>
          <span className="status-pill neutral">{autoProgress.done}/{autoProgress.total} selesai</span>
        </div>
        <div className="metric-row">
          {SCENARIO_IDS.map((sid) => {
            const totalForSid = AUTO_NUM_RECLOSERS.length;
            const doneForSid = AUTO_NUM_RECLOSERS.filter((n) =>
              entries.some((e) => e.scenarioId === sid && e.numReclosers === n)
            ).length;
            return (
              <span key={sid} className="metric-pill">
                <strong>{SCENARIO_NAMES[sid]}</strong>: {doneForSid}/{totalForSid} recloser
              </span>
            );
          })}
        </div>
        {autoLoading && (
          <p className="loading" style={{ marginTop: 12 }}>
            Menyiapkan hasil optimasi... ({autoProgress.done}/{autoProgress.total})
          </p>
        )}
        {!autoLoading && totalCached < TOTAL_AUTO && (
          <p className="loading" style={{ marginTop: 12 }}>
            Menunggu hasil ({totalCached}/{TOTAL_AUTO})…
          </p>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Hasil</div>
          <div className="stat-card-value">{totalCached}</div>
          <div className="stat-card-sub">dari {TOTAL_AUTO} target (1–4 recloser)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Skenario Tercakup</div>
          <div className="stat-card-value">
            {new Set(entries.map((e) => e.scenarioId)).size}
          </div>
          <div className="stat-card-sub">dari 5 skenario</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Variasi Jumlah Recloser</div>
          <div className="stat-card-value">
            {new Set(entries.map((e) => e.numReclosers)).size}
          </div>
          <div className="stat-card-sub">dari 4 variasi (1–4)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Best Fitness</div>
          <div className="stat-card-value" style={{ fontSize: 22 }}>
            {totalCached > 0 ? Math.min(...entries.map((e) => e.result.optimal.fitness)).toFixed(4) : '—'}
          </div>
          <div className="stat-card-sub">terkecil di cache</div>
        </div>
      </div>

      <LineChart
        title="Perbandingan Penurunan SAIDI"
        xLabel="Jumlah Recloser"
        yLabel="Penurunan SAIDI (%)"
        series={saidiSeries}
        yFormatter={(v) => v.toFixed(0) + '%'}
      />
      <LineChart
        title="Perbandingan Penurunan SAIFI"
        xLabel="Jumlah Recloser"
        yLabel="Penurunan SAIFI (%)"
        series={saifiSeries}
        yFormatter={(v) => v.toFixed(0) + '%'}
      />
      <LineChart
        title="Perbandingan Risk"
        xLabel="Jumlah Recloser"
        yLabel="Risk Remaining (%)"
        series={riskSeries}
        yFormatter={(v) => v.toFixed(0) + '%'}
      />
      <LineChart
        title="Perbandingan Fitness"
        xLabel="Jumlah Recloser"
        yLabel="Fitness"
        series={fitnessSeries}
        yFormatter={(v) => v.toFixed(4)}
      />

      <div className="section-card">
        <div className="section-card-header">
          <h3>Tabel Hasil Optimasi (1–4 recloser)</h3>
          <span className="status-pill neutral">{entries.length} baris</span>
        </div>

        <div className="table-wrap">
          <table className="data-table data-table-compact">
            <thead>
              <tr>
                <th>Scenario</th>
                <th className="numeric">Jumlah Recloser</th>
                <th className="numeric">Fitness</th>
                <th className="numeric">SAIDI baseline</th>
                <th className="numeric">SAIDI optimal</th>
                <th>SAIDI improve</th>
                <th className="numeric">SAIFI baseline</th>
                <th className="numeric">SAIFI optimal</th>
                <th>SAIFI improve</th>
                <th className="numeric">Total risk</th>
                <th className="numeric">Risk unprotected</th>
                <th className="numeric">Risk remaining</th>
                <th>Posisi recloser optimal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ key, scenarioId, numReclosers, result: r }) => {
                const fitnessClass = r.improvement.saidi_pct >= 0 ? 'delta-up' : 'delta-down';
                return (
                  <tr key={key}>
                    <td><strong>{SCENARIO_NAMES[scenarioId]}</strong></td>
                    <td className="numeric">{numReclosers}</td>
                    <td className="numeric"><strong>{r.optimal.fitness.toFixed(6)}</strong></td>
                    <td className="numeric">{r.baseline.saidi.toFixed(4)}</td>
                    <td className="numeric">{r.optimal.saidi.toFixed(4)}</td>
                    <td className={fitnessClass}>{fmtPct(r.improvement.saidi_pct)}</td>
                    <td className="numeric">{r.baseline.saifi.toFixed(4)}</td>
                    <td className="numeric">{r.optimal.saifi.toFixed(4)}</td>
                    <td className={fitnessClass}>{fmtPct(r.improvement.saifi_pct)}</td>
                    <td className="numeric">{r.totals.total_system_risk.toFixed(4)}</td>
                    <td className="numeric">{r.optimal.risk_unprotected.toFixed(4)}</td>
                    <td className="numeric">{r.improvement.risk_remaining_pct.toFixed(1)}%</td>
                    <td className="col-list" title={(r.optimal.positions || []).join(', ')}>
                      {(r.optimal.positions || []).join(', ')}
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => onSelectScenario?.(scenarioId)}>
                        Buka
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}