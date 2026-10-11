import TopologyVisualization from './NetworkTopology.jsx';

const STEPS = [
  { key: 'network-data', label: 'Network Data', icon: '⚡' },
  { key: 'dataset',      label: 'Dataset',      icon: '📊' },
  { key: 'lstm',         label: 'LSTM',          icon: '🧠' },
  { key: 'abc',          label: 'ABC Opt.',       icon: '🐝' },
  { key: 'results',      label: 'Results',       icon: '📋' },
];

const STEP_STATUS = {
  pending: { color: '#94A3B8', bg: '#F1F5F9', label: 'Pending' },
  ready:   { color: '#B45309', bg: '#FEF3C7', label: 'Ready' },
  done:    { color: '#047857', bg: '#D1FAE5', label: 'Done' },
};

function stepState(key, pipelineStatus) {
  switch (key) {
    case 'network-data':
      return pipelineStatus.hasNetwork ? 'done' : 'pending';
    case 'dataset':
      return pipelineStatus.hasDataset ? 'done' : 'pending';
    case 'lstm':
      if (pipelineStatus.lstmDone) return 'done';
      if (pipelineStatus.hasNetwork && pipelineStatus.hasDataset) return 'ready';
      return 'pending';
    case 'abc':
      if (pipelineStatus.abcDone) return 'done';
      if (pipelineStatus.lstmDone) return 'ready';
      return 'pending';
    case 'results':
      return pipelineStatus.abcDone ? 'done' : 'pending';
    default:
      return 'pending';
  }
}

export default function OverviewPage({ pipelineStatus, abcResults, onSelectMenu }) {
  const { hasNetwork, hasDataset, lstmDone, abcDone } = pipelineStatus;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Platform pengujian penempatan recloser berbasis upload data.</p>
      </div>

      {/* Pipeline Steps */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Pipeline Status</h3>
        </div>
        <div className="pipeline-steps">
          {STEPS.map((step, i) => {
            const state = stepState(step.key, pipelineStatus);
            const status = STEP_STATUS[state];
            const isClickable = state !== 'pending';
            return (
              <div key={step.key} className="pipeline-step-wrapper">
                {i > 0 && <div className="pipeline-connector" />}
                <div
                  className={`pipeline-step ${state} ${isClickable ? 'clickable' : ''}`}
                  style={{ '--step-color': status.color, '--step-bg': status.bg }}
                  onClick={() => isClickable && onSelectMenu(step.key)}
                  title={isClickable ? `Go to ${step.label}` : step.label}
                >
                  <span className="pipeline-step-icon">{step.icon}</span>
                  <span className="pipeline-step-label">{step.label}</span>
                  <span
                    className="pipeline-step-badge"
                    style={{ color: status.color, background: status.bg }}
                  >
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topologi Jaringan */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Topologi Jaringan</h3>
        </div>
        {hasNetwork ? (
          <TopologyVisualization
            topologyMap={pipelineStatus.topologyMap || {}}
            abcResults={abcResults || null}
          />
        ) : (
          <div className="empty-state">
            <strong>Belum ada data jaringan.</strong>
            <br />
            Upload Network Data untuk menampilkan topology.
          </div>
        )}
      </div>

      {/* Next Action Hint */}
      {!hasNetwork && (
        <div className="section-card">
          <div className="empty-state">
            <strong>Belum ada network aktif.</strong> Mulai dengan mengupload data network
            (topologi jaringan) di halaman <strong>Network Data</strong>.
            <br />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => onSelectMenu('network-data')}
            >
              Upload Network Data
            </button>
          </div>
        </div>
      )}
      {hasNetwork && !hasDataset && (
        <div className="section-card">
          <div className="empty-state">
            <strong>Network tersedia.</strong> Langkah berikutnya adalah mengupload
            dataset gangguan (data time-series bulanan) di halaman <strong>Dataset</strong>.
            <br />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => onSelectMenu('dataset')}
            >
              Upload Dataset
            </button>
          </div>
        </div>
      )}
      {hasNetwork && hasDataset && !lstmDone && (
        <div className="section-card">
          <div className="empty-state">
            <strong>Network dan Dataset tersedia.</strong> Jalankan LSTM untuk
            memprediksi pola gangguan di halaman <strong>LSTM</strong>.
            <br />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => onSelectMenu('lstm')}
            >
              Jalankan LSTM
            </button>
          </div>
        </div>
      )}
      {lstmDone && !abcDone && (
        <div className="section-card">
          <div className="empty-state">
            <strong>LSTM selesai.</strong> Jalankan optimasi ABC untuk
            menentukan penempatan recloser optimal di halaman <strong>ABC Optimization</strong>.
            <br />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => onSelectMenu('abc')}
            >
              Jalankan ABC
            </button>
          </div>
        </div>
      )}
      {abcDone && (
        <div className="section-card">
          <div className="empty-state">
            <strong>Optimasi ABC selesai.</strong> Lihat hasil lengkap di halaman
            <strong> Results</strong>.
            <br />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => onSelectMenu('results')}
            >
              Lihat Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
