import LineChart from './LineChart.jsx';
import TopologyVisualization from './NetworkTopology.jsx';

export default function ResultsPage({ authFetch, pipelineStatus, topologyMap, abcResults, lstmResults }) {
  const result = abcResults;
  const hasResults = result && result.status === 'ready';

  if (!hasResults) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Results</h1>
          <p>Hasil optimasi penempatan recloser.</p>
        </div>
        <div className="section-card">
          <div className="empty-state">
            <strong>Belum ada hasil optimasi.</strong>
            <br />
            Jalankan optimasi ABC terlebih dahulu di halaman{' '}
            <strong>ABC Optimization</strong>.
          </div>
        </div>
      </div>
    );
  }

  const poles = result.optimal?.positions || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Results</h1>
        <p>Hasil lengkap optimasi penempatan recloser.</p>
      </div>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Baseline SAIDI</div>
          <div className="stat-value">{result.baseline?.saidi?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Optimal SAIDI</div>
          <div className="stat-value" style={{ color: '#047857', fontSize: 22 }}>
            {result.optimal?.saidi?.toFixed(2) ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: '#047857' }}>
            ↓ {result.improvement?.saidi_pct?.toFixed(2) ?? '—'}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Baseline SAIFI</div>
          <div className="stat-value">{result.baseline?.saifi?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Optimal SAIFI</div>
          <div className="stat-value" style={{ color: '#047857', fontSize: 22 }}>
            {result.optimal?.saifi?.toFixed(2) ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: '#047857' }}>
            ↓ {result.improvement?.saifi_pct?.toFixed(2) ?? '—'}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jumlah Recloser</div>
          <div className="stat-value">{result.optimal?.positions?.length ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Fitness</div>
          <div className="stat-value">{result.optimal?.fitness?.toFixed(4) ?? '—'}</div>
        </div>
      </div>

      {/* Topology Visualization */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Topology &amp; Recloser Placement</h3>
        </div>
        <TopologyVisualization
          topologyMap={topologyMap || {}}
          abcResults={result}
        />
      </div>

      {/* Optimal Recloser Positions */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Optimal Recloser Locations</h3>
        </div>
        <div className="recloser-list">
          {poles.map(pos => (
            <span key={pos} className="recloser-badge">
              {pos}
            </span>
          ))}
        </div>
      </div>

      {/* Zone Details */}
      {result.zones?.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h3>Protection Zone Details</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recloser</th>
                  <th>Lines in Zone</th>
                  <th>Customers</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {result.zones.map(zone => (
                  <tr key={zone.recloser}>
                    <td><strong>{zone.recloser}</strong></td>
                    <td>{zone.num_lines_in_zone}</td>
                    <td>{zone.customers?.toFixed(0)}</td>
                    <td>{zone.risk?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LSTM Pola Gangguan Chart */}
      {lstmResults?.rows?.length > 0 && (
        <LineChart
          title="Pola Gangguan per Line (LSTM)"
          xLabel="Line ID"
          yLabel="Pola Gangguan"
          series={[{
            name: 'Pola Gangguan',
            color: '#047857',
            points: lstmResults.rows.map(r => ({ x: r.line_id, y: r.pola_gangguan })),
          }]}
          yFormatter={(v) => v.toFixed(3)}
          width={700}
          height={300}
        />
      )}
    </div>
  );
}
