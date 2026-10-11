import { useState } from 'react';
import TopologyVisualization from './NetworkTopology.jsx';

const RECLOSER_OPTIONS = [1, 2, 3, 4];

export default function AbcRun({ authFetch, pipelineStatus, topologyMap, onRun, abcResults, onResults, abcLoading, setAbcLoading, user }) {
  const [numReclosers, setNumReclosers] = useState(4);
  const [error, setError] = useState(null);

  const canRun = pipelineStatus.lstmDone && user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const handleRun = async () => {
    setAbcLoading(true);
    setError(null);
    try {
      await onRun(numReclosers);
    } catch (e) {
      setError(String(e));
    } finally {
      setAbcLoading(false);
    }
  };

  const result = abcResults;

  return (
    <div className="page">
      <div className="page-header">
        <h1>ABC Optimization</h1>
        <p>Optimasi penempatan recloser menggunakan Artificial Bee Colony.</p>
      </div>

      {!isAdmin && (
        <div className="alert alert-warning">
          Hanya admin yang dapat menjalankan optimasi ABC.
        </div>
      )}

      {/* Status */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Status Pipeline</h3>
        </div>
        <div className="pipeline-status-grid">
          <div className="pipeline-status-item">
            <span className="pipeline-status-dot" style={{ background: pipelineStatus.lstmDone ? '#047857' : '#9ca3af' }} />
            LSTM Selesai
          </div>
        </div>
        {!pipelineStatus.lstmDone && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            Jalankan LSTM terlebih dahulu sebelum menjalankan optimasi ABC.
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="section-card">
        <div className="form-group">
          <label className="form-label">Jumlah Recloser</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {RECLOSER_OPTIONS.map(n => (
              <button
                key={n}
                className={`btn ${numReclosers === n ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setNumReclosers(n)}
                disabled={!canRun}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleRun}
            disabled={!canRun || abcLoading}
          >
            {abcLoading ? '🐝 Menjalankan ABC...' : '🐝 RUN ABC'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Improvement Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Baseline SAIDI</div>
              <div className="stat-value">{result.baseline?.saidi?.toFixed(2) ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Optimal SAIDI</div>
              <div className="stat-value" style={{ color: '#047857' }}>
                {result.optimal?.saidi?.toFixed(2) ?? '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Baseline SAIFI</div>
              <div className="stat-value">{result.baseline?.saifi?.toFixed(2) ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Optimal SAIFI</div>
              <div className="stat-value" style={{ color: '#047857' }}>
                {result.optimal?.saifi?.toFixed(2) ?? '—'}
              </div>
            </div>
          </div>

          {/* Improvement Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">SAIDI Improvement</div>
              <div className="stat-value" style={{ color: '#047857' }}>
                {result.improvement?.saidi_pct?.toFixed(2) ?? '—'}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">SAIFI Improvement</div>
              <div className="stat-value" style={{ color: '#047857' }}>
                {result.improvement?.saifi_pct?.toFixed(2) ?? '—'}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Fitness</div>
              <div className="stat-value">{result.optimal?.fitness?.toFixed(4) ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Runtime</div>
              <div className="stat-value">{result.runtime_seconds?.toFixed(2) ?? '—'}s</div>
            </div>
          </div>

          {/* Optimal Recloser Positions */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>Posisi Recloser Optimal</h3>
              <span className="badge">{result.optimal?.positions?.length ?? 0} recloser</span>
            </div>
            <div className="recloser-list">
              {result.optimal?.positions?.map((pos, i) => (
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
                <h3>Detail Zona Proteksi</h3>
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
                    {result.zones.map((zone) => (
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

          {/* Parameters */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>Parameter Optimasi</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
              <div><strong>Colony Size:</strong> {result.parameters?.colony_size}</div>
              <div><strong>Max Iterations:</strong> {result.parameters?.max_iterations}</div>
              <div><strong>W_SAIDI:</strong> {result.parameters?.weights?.W_SAIDI}</div>
              <div><strong>W_SAIFI:</strong> {result.parameters?.weights?.W_SAIFI}</div>
              <div><strong>W_RISK:</strong> {result.parameters?.weights?.W_RISK}</div>
              <div><strong>Total Lines:</strong> {result.totals?.total_lines}</div>
            </div>
          </div>

          {/* Topology Visualization */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>Topologi Jaringan dan Posisi Recloser</h3>
            </div>
            <TopologyVisualization
              topologyMap={topologyMap || {}}
              abcResults={result}
            />
          </div>
        </>
      )}

      {!result && !abcLoading && pipelineStatus.lstmDone && isAdmin && (
        <div className="section-card">
          <div className="empty-state">
            Pilih jumlah recloser dan tekan <strong>RUN ABC</strong> untuk
            menjalankan optimasi.
          </div>
        </div>
      )}
    </div>
  );
}
