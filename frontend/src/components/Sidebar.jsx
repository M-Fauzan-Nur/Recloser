import AppLogo from './AppLogo.jsx';

const ALL_TOP_ITEMS = [
  { key: 'overview',      label: 'Overview' },
  { key: 'network-data',  label: 'Network Data' },
  { key: 'dataset',       label: 'Dataset' },
  { key: 'lstm',         label: 'LSTM' },
  { key: 'abc',          label: 'ABC Optimization', adminOnly: true },
  { key: 'results',      label: 'Results' },
  { key: 'manual-faults',label: 'File Dataset' },
];

export default function Sidebar({
  activeMenu = 'overview',
  onSelectMenu,
  user = null,
  onLogout,
  mobileOpen = false,
  pipelineStatus = {},
}) {
  const isAdmin = user?.role === 'admin';

  const visibleTopItems = ALL_TOP_ITEMS.filter(
    (it) => !it.adminOnly || isAdmin
  );

  const isDisabled = (key) => {
    switch (key) {
      case 'network-data': return false;
      case 'dataset':      return false;
      case 'lstm':
        return !pipelineStatus.hasNetwork || !pipelineStatus.hasDataset;
      case 'abc':
        return !pipelineStatus.lstmDone;
      case 'results':
        return !pipelineStatus.abcDone;
      case 'manual-faults': return false;
      default: return false;
    }
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
      {/* Brand header */}
      <div className="sidebar-brand">
        <AppLogo width={36} height={36} />
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">Recloser Placement</div>
          <div className="sidebar-brand-inst">Universitas Hasanuddin</div>
        </div>
      </div>

      <h3 className="sidebar-section">Menu</h3>
      <div className="sidebar-nav">
        <ul>
          {visibleTopItems.map((it) => {
            const disabled = isDisabled(it.key);
            return (
              <li
                key={it.key}
                className={`${it.key === activeMenu ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && onSelectMenu?.(it.key)}
                title={disabled ? 'Upload network & dataset first' : it.label}
              >
                {it.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--color-sidebar-border)',
            fontSize: 12,
            color: 'var(--color-sidebar-text-muted)',
          }}
        >
          <span style={{ color: '#f9fafb', fontWeight: 500 }}>
            {user?.fullName || user?.username || user?.email || 'Pengguna'}
          </span>
        </div>
        <button
          className="link-btn"
          style={{
            marginTop: 8,
            width: '100%',
            borderColor: 'rgba(255,255,255,0.4)',
            color: '#f9fafb',
            background: 'transparent',
          }}
          onClick={() => onLogout?.()}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
