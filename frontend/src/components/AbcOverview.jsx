import { useEffect, useMemo, useState } from 'react';

const SCENARIO_IDS = ['a', 'b', 'c', 'd', 'e'];
const SCENARIO_NAMES = {
  a: 'Scenario A',
  b: 'Scenario B',
  c: 'Scenario C',
  d: 'Scenario D',
  e: 'Scenario E',
};
const RECLOSER_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function AbcOverview({ abcCache, abcInFlight, onRunScenario, onSelectScenario, user }) {
  const isAdmin = user?.role === 'admin';
  const [numReclosers, setNumReclosers] = useState(4);

  const cachedKeys = useMemo(() => Object.keys(abcCache || {}), [abcCache]);
  const pendingKeys = useMemo(
    () => Object.keys(abcInFlight || {}).filter((k) => !abcCache[k]),
    [abcCache, abcInFlight]
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      for (const id of SCENARIO_IDS) {
        if (cancelled) return;
        const key = `${id}|${numReclosers}`;
        if (abcCache[key] || abcInFlight[key]) continue;
        try {
          await onRunScenario(id, numReclosers);
        } catch (e) {
          if (cancelled) return;
          console.error('ABC run failed for', id, e);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numReclosers, isAdmin]);

  const handleRun = (id) => onRunScenario?.(id, numReclosers);

  return (
    <>
      <h1>ABC Optimization Overview</h1>
      <p className="subtitle">
        Recloser placement optimization untuk 5 skenario dengan parameter riset
        (num_reclosers, colony_size, max_iterations, weights, seed).
      </p>

      {!isAdmin ? (
        <div className="empty-state">
          <p>
            <strong>Hanya Admin yang dapat menjalankan ABC Optimization.</strong>
          </p>
          <p>Anda login sebagai <strong>User</strong>. Hasil ABC yang sudah di-cache sebelumnya tetap dapat dilihat di halaman Results.</p>
          <button className="link-btn" onClick={() => onSelectScenario?.('results')}>
            Buka Results
          </button>
        </div>
      ) : (
        <>
          <div className="section-card">
            <div className="section-card-header">
              <h3>Konfigurasi</h3>
              <span className="status-pill neutral">default: 4</span>
            </div>

            <div className="metric-row">
              <label className="inline-control">
                Jumlah Recloser:&nbsp;
                <select
                  value={numReclosers}
                  onChange={(e) => setNumReclosers(Number(e.target.value))}
                >
                  {RECLOSER_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <span className="metric-pill">cached: <strong>{cachedKeys.length}</strong></span>
              <span className="metric-pill">in-flight: <strong>{pendingKeys.length}</strong></span>
            </div>

            {pendingKeys.length > 0 && (
              <p className="loading" style={{ marginTop: 12 }}>
                Menjalankan optimasi untuk {pendingKeys.length} pasangan (skenario, num_reclosers)…
              </p>
            )}
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <h3>Hasil per Skenario</h3>
              <span className="status-pill neutral">num_reclosers: {numReclosers}</span>
            </div>

            <div className="table-wrap">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th className="numeric">Jumlah Recloser</th>
                    <th>Status</th>
                    <th className="numeric">Fitness</th>
                    <th className="numeric">Baseline SAIDI</th>
                    <th className="numeric">Optimal SAIDI</th>
                    <th className="numeric">Baseline SAIFI</th>
                    <th className="numeric">Optimal SAIFI</th>
                    <th className="numeric">Runtime (s)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIO_IDS.map((id) => {
                    const key = `${id}|${numReclosers}`;
                    const r = abcCache[key];
                    const running = abcInFlight[key] && !r;
                    if (!r) {
                      return (
                        <tr key={id}>
                          <td><strong>{SCENARIO_NAMES[id]}</strong></td>
                          <td className="numeric">{numReclosers}</td>
                          <td colSpan={7}>{running ? 'Running…' : 'Not yet computed'}</td>
                          <td>
                            <button className="link-btn" onClick={() => handleRun(id)} disabled={running}>
                              Run
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={id}>
                        <td><strong>{SCENARIO_NAMES[id]}</strong></td>
                        <td className="numeric">{r.parameters.num_reclosers}</td>
                        <td><span className="status-pill success">{r.status}</span></td>
                        <td className="numeric">{r.optimal.fitness.toFixed(6)}</td>
                        <td className="numeric">{r.baseline.saidi.toFixed(4)}</td>
                        <td className="numeric">{r.optimal.saidi.toFixed(4)}</td>
                        <td className="numeric">{r.baseline.saifi.toFixed(4)}</td>
                        <td className="numeric">{r.optimal.saifi.toFixed(4)}</td>
                        <td className="numeric">{r.runtime_seconds.toFixed(2)}</td>
                        <td>
                          <button className="link-btn" onClick={() => onSelectScenario?.(id)}>
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
      )}
    </>
  );
}