import { useState } from 'react';
import LineChart from './LineChart.jsx';

export default function LstmRun({ authFetch, pipelineStatus, onRun, lstmResults, onResults }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const canRun = pipelineStatus.hasNetwork && pipelineStatus.hasDataset;
  const hasResults = lstmResults && lstmResults.rows?.length > 0;

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      await onRun();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const rows = lstmResults?.rows || [];
  const range = lstmResults ? {
    min: rows.length ? Math.min(...rows.map(r => r.pola_gangguan)) : 0,
    max: rows.length ? Math.max(...rows.map(r => r.pola_gangguan)) : 0,
    mean: rows.length ? rows.reduce((s, r) => s + r.pola_gangguan, 0) / rows.length : 0,
  } : null;

  const chartSeries = hasResults
    ? [{
        name: 'Pola Gangguan',
        color: '#047857',
        points: rows.map(r => ({ x: r.line_id, y: r.pola_gangguan })),
      }]
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>LSTM Prediction</h1>
        <p>Jalankan LSTM untuk memprediksi pola gangguan pada setiap line.</p>
      </div>

      {/* Pre-flight status */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Status Pipeline</h3>
        </div>
        <div className="pipeline-status-grid">
          <div className="pipeline-status-item">
            <span className="pipeline-status-dot" style={{ background: pipelineStatus.hasNetwork ? '#047857' : '#9ca3af' }} />
            Network Data
          </div>
          <div className="pipeline-status-item">
            <span className="pipeline-status-dot" style={{ background: pipelineStatus.hasDataset ? '#047857' : '#9ca3af' }} />
            Dataset
          </div>
        </div>
        {!canRun && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            {!pipelineStatus.hasNetwork && 'Upload network terlebih dahulu. '}
            {!pipelineStatus.hasDataset && 'Upload dataset terlebih dahulu.'}
          </div>
        )}
      </div>

      {/* Run Button */}
      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleRun}
            disabled={running || !canRun}
          >
            {running ? '🧠 Menjalankan LSTM...' : '🧠 RUN LSTM'}
          </button>
          {running && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              Memproses prediksi pola gangguan...
            </span>
          )}
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {hasResults && (
        <>
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Jumlah Line</div>
              <div className="stat-value">{rows.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Min Pola Gangguan</div>
              <div className="stat-value">{range.min.toFixed(4)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Max Pola Gangguan</div>
              <div className="stat-value">{range.max.toFixed(4)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rata-rata</div>
              <div className="stat-value">{range.mean.toFixed(4)}</div>
            </div>
            {lstmResults.source && (
              <div className="stat-card">
                <div className="stat-label">Model Source</div>
                <div className="stat-value">{lstmResults.source}</div>
              </div>
            )}
          </div>

          {/* Chart */}
          <LineChart
            title="Pola Gangguan Hasil Prediksi LSTM"
            xLabel="Line ID"
            yLabel="Pola Gangguan"
            series={chartSeries}
            yFormatter={(v) => v.toFixed(3)}
            width={700}
            height={320}
          />

          {/* Table */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>Detail Prediksi per Line</h3>
              <span className="badge">{rows.length} baris</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>line_id</th>
                    <th>from_bus</th>
                    <th>to_bus</th>
                    <th>pola_gangguan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line_id}>
                      <td>{row.line_id}</td>
                      <td>{row.from_bus}</td>
                      <td>{row.to_bus}</td>
                      <td>{typeof row.pola_gangguan === 'number' ? row.pola_gangguan.toFixed(6) : row.pola_gangguan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!hasResults && !running && canRun && (
        <div className="section-card">
          <div className="empty-state">
            Tekan <strong>RUN LSTM</strong> untuk menjalankan prediksi pola gangguan.
          </div>
        </div>
      )}
    </div>
  );
}
