import { useState } from 'react';
import Login from './Login.jsx';
import Register from './Register.jsx';
import AppLogo from './AppLogo.jsx';

function scrollToFeatures() {
  document.getElementById('fitur')?.scrollIntoView({ behavior: 'smooth' });
}

const FEATURES = [
  {
    icon: '🧠',
    title: 'Prediksi Pola Gangguan LSTM',
    desc: 'Jalankan Long Short-Term Memory (LSTM) untuk memprediksi pola gangguan bulanan pada setiap line jaringan. Model dilatih secara langsung dari dataset yang diunggah.',
  },
  {
    icon: '🐝',
    title: 'Optimasi ABC',
    desc: 'Optimalkan penempatan recloser 1–4 unit menggunakan Artificial Bee Colony (ABC). Algoritma meminimalkan SAIDI dan SAIFI dengan mempertimbangkan overlap zona dan batasan perlindungan.',
  },
  {
    icon: '📡',
    title: 'Visualisasi Topologi Jaringan',
    desc: 'Visualisasi SVG interaktif dari jaringan distribusi dengan penanda posisi recloser optimal, batas zona perlindungan, dan informasi downstream bus per line.',
  },
  {
    icon: '📈',
    title: 'Evaluasi SAIDI & SAIFI',
    desc: 'Evaluasi kuantitatif hasil optimasi melalui SAIDI (System Average Interruption Duration Index) dan SAIFI (System Average Interruption Frequency Index).',
  },
];

const FLOW_STEPS = [
  { icon: '⚡', title: 'Network Data', desc: 'Upload topologi jaringan distribusi' },
  { icon: '📊', title: 'Dataset', desc: 'Upload data gangguan time-series' },
  { icon: '🧠', title: 'LSTM', desc: 'Prediksi pola gangguan' },
  { icon: '🐝', title: 'ABC Optimization', desc: 'Optimasi penempatan recloser' },
  { icon: '📋', title: 'Results', desc: 'Evaluasi dan visualisasi hasil' },
];

export default function LandingPage({ onLogin }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (showRegister) {
    return (
      <div className="landing">
        <div className="landing-login-wrap">
          <div className="landing-login-inner">
            <button
              className="btn btn-secondary"
              onClick={() => { setShowRegister(false); setShowLogin(false); }}
              style={{ marginBottom: 'var(--space-4)' }}
            >
              ← Kembali
            </button>
            <div className="landing-login-card">
              <h2>Daftar Akun Baru</h2>
              <p className="subtitle">Buat akun untuk mengakses platform penelitian</p>
              <Register onLogin={onLogin} onCancel={() => setShowRegister(false)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="landing">
        <div className="landing-login-wrap">
          <div className="landing-login-inner">
            <button
              className="btn btn-secondary"
              onClick={() => setShowLogin(false)}
              style={{ marginBottom: 'var(--space-4)' }}
            >
              ← Kembali
            </button>
            <div className="landing-login-card">
              <h2>Login</h2>
              <p className="subtitle">Masuk untuk mengakses platform penelitian</p>
              <Login onLogin={onLogin} embedded onShowRegister={() => setShowRegister(true)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="landing-brand" href="/" aria-label="Recloser Placement Optimization">
            <AppLogo width={36} height={36} />
            <div className="landing-brand-text">
              <span className="landing-brand-name">Recloser Placement Optimization</span>
              <span className="landing-brand-inst">Pusat Penelitian dan Pengembangan Energi dan Ketenagalistrikan</span>
            </div>
          </a>
          <nav className="landing-nav">
            <a href="#alur" onClick={(e) => { e.preventDefault(); document.getElementById('alur')?.scrollIntoView({ behavior: 'smooth' }); }}>Alur Penelitian</a>
            <a href="#fitur" onClick={(e) => { e.preventDefault(); scrollToFeatures(); }}>Fitur</a>
          </nav>
          <div className="landing-header-cta">
            <button className="btn btn-primary" onClick={() => setShowLogin(true)}>
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">🔬 Penelitian Akademik</div>
          <h1>Optimasi Penempatan Recloser pada Jaringan Distribusi Listrik</h1>
          <p className="landing-hero-sub">
            Platform penelitian untuk memprediksi pola gangguan dan mengoptimalkan
            penempatan recloser pada jaringan distribusi listrik menggunakan
            Long Short-Term Memory (LSTM) dan Artificial Bee Colony (ABC).
          </p>
          <div className="landing-hero-ctas">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setShowLogin(true)}
            >
              Login
            </button>
            <button
              className="btn btn-outline-white btn-lg"
              onClick={() => scrollToFeatures()}
            >
              Jelajahi Fitur
            </button>
          </div>

          {/* Topology illustration SVG */}
          <div className="landing-hero-visual">
            <svg viewBox="0 0 560 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',maxWidth:560}}>
              {/* Substation */}
              <rect x="0" y="64" width="16" height="32" rx="3" fill="#3B82F6"/>
              <text x="8" y="82" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">SS</text>
              {/* Bus 1 */}
              <rect x="30" y="72" width="12" height="16" rx="2" fill="#93C5FD"/>
              <circle cx="36" cy="80" r="4" fill="#3B82F6"/>
              {/* Line 1 */}
              <line x1="16" y1="80" x2="30" y2="80" stroke="#3B82F6" strokeWidth="2"/>
              {/* Bus 2 */}
              <rect x="56" y="72" width="12" height="16" rx="2" fill="#93C5FD"/>
              <circle cx="62" cy="80" r="4" fill="#3B82F6"/>
              {/* Line 2 */}
              <line x1="42" y1="80" x2="56" y2="80" stroke="#3B82F6" strokeWidth="2"/>
              {/* Recloser markers */}
              <rect x="50" y="75" width="10" height="10" rx="2" fill="#047857" opacity="0.9"/>
              <line x1="52" y1="78" x2="58" y2="84" stroke="white" strokeWidth="1.5"/>
              {/* Bus 3 */}
              <rect x="82" y="72" width="12" height="16" rx="2" fill="#93C5FD"/>
              <circle cx="88" cy="80" r="4" fill="#3B82F6"/>
              {/* Line 3 */}
              <line x1="68" y1="80" x2="82" y2="80" stroke="#3B82F6" strokeWidth="2"/>
              {/* Branch to downstream */}
              <line x1="88" y1="84" x2="88" y2="100" stroke="#3B82F6" strokeWidth="2"/>
              {/* Bus 4 */}
              <rect x="82" y="108" width="12" height="16" rx="2" fill="#BFDBFE"/>
              <circle cx="88" cy="116" r="4" fill="#60A5FA"/>
              {/* Bus 5 */}
              <rect x="108" y="108" width="12" height="16" rx="2" fill="#BFDBFE"/>
              <circle cx="114" cy="116" r="4" fill="#60A5FA"/>
              <line x1="94" y1="116" x2="108" y2="116" stroke="#60A5FA" strokeWidth="1.5"/>
              {/* Bus 6 */}
              <rect x="134" y="108" width="12" height="16" rx="2" fill="#BFDBFE"/>
              <circle cx="140" cy="116" r="4" fill="#60A5FA"/>
              <line x1="120" y1="116" x2="134" y2="116" stroke="#60A5FA" strokeWidth="1.5"/>
              {/* Recloser at bus 5 */}
              <rect x="131" y="103" width="10" height="10" rx="2" fill="#047857" opacity="0.9"/>
              <line x1="133" y1="106" x2="139" y2="112" stroke="white" strokeWidth="1.5"/>

              {/* Second branch */}
              <line x1="88" y1="76" x2="88" y2="44" stroke="#3B82F6" strokeWidth="2"/>
              <rect x="82" y="32" width="12" height="16" rx="2" fill="#BFDBFE"/>
              <circle cx="88" cy="40" r="4" fill="#60A5FA"/>
              <rect x="108" y="32" width="12" height="16" rx="2" fill="#BFDBFE"/>
              <circle cx="114" cy="40" r="4" fill="#60A5FA"/>
              <line x1="94" y1="40" x2="108" y2="40" stroke="#60A5FA" strokeWidth="1.5"/>
              <rect x="134" y="32" width="12" height="16" rx="2" fill="#BFDBFE"/>
              <circle cx="140" cy="40" r="4" fill="#60A5FA"/>
              <line x1="120" y1="40" x2="134" y2="40" stroke="#60A5FA" strokeWidth="1.5"/>

              {/* Downstream buses row 3 */}
              <line x1="140" y1="44" x2="180" y2="20" stroke="#60A5FA" strokeWidth="1"/>
              <line x1="140" y1="44" x2="180" y2="44" stroke="#60A5FA" strokeWidth="1"/>
              <line x1="140" y1="44" x2="180" y2="68" stroke="#60A5FA" strokeWidth="1"/>
              <rect x="184" y="12" width="10" height="14" rx="2" fill="#DBEAFE"/>
              <rect x="184" y="36" width="10" height="14" rx="2" fill="#DBEAFE"/>
              <rect x="184" y="60" width="10" height="14" rx="2" fill="#DBEAFE"/>
              <rect x="208" y="12" width="10" height="14" rx="2" fill="#DBEAFE"/>
              <rect x="208" y="36" width="10" height="14" rx="2" fill="#DBEAFE"/>
              <rect x="208" y="60" width="10" height="14" rx="2" fill="#DBEAFE"/>
              <line x1="194" y1="19" x2="208" y2="19" stroke="#93C5FD" strokeWidth="1"/>
              <line x1="194" y1="43" x2="208" y2="43" stroke="#93C5FD" strokeWidth="1"/>
              <line x1="194" y1="67" x2="208" y2="67" stroke="#93C5FD" strokeWidth="1"/>

              {/* Zone circles */}
              <ellipse cx="128" cy="116" rx="52" ry="24" fill="#047857" fillOpacity="0.06" stroke="#047857" strokeOpacity="0.2" strokeDasharray="4 2"/>
              <ellipse cx="400" cy="80" rx="72" ry="48" fill="#3B82F6" fillOpacity="0.04" stroke="#3B82F6" strokeOpacity="0.15" strokeDasharray="4 2"/>

              {/* Recloser legend */}
              <rect x="320" y="28" width="10" height="10" rx="2" fill="#047857"/>
              <line x1="322" y1="31" x2="328" y2="37" stroke="white" strokeWidth="1.5"/>
              <text x="335" y="36" fill="#94A3B8" fontSize="10" fontWeight="600">Recloser</text>

              {/* Bus legend */}
              <circle cx="322" cy="64" r="5" fill="#3B82F6"/>
              <text x="332" y="67" fill="#94A3B8" fontSize="10" fontWeight="600">Bus</text>

              {/* Zone legend */}
              <ellipse cx="330" cy="90" rx="14" ry="8" fill="#047857" fillOpacity="0.1" stroke="#047857" strokeOpacity="0.3" strokeDasharray="3 1"/>
              <text x="350" y="94" fill="#94A3B8" fontSize="10" fontWeight="600">Zona Lindungan</text>

              {/* Load nodes */}
              <rect x="260" y="20" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="260" y="44" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="260" y="68" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="280" y="20" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="280" y="44" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="280" y="68" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="300" y="20" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="300" y="44" width="8" height="8" rx="1" fill="#94A3B8"/>
              <rect x="300" y="68" width="8" height="8" rx="1" fill="#94A3B8"/>
              <line x1="232" y1="24" x2="260" y2="24" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="232" y1="48" x2="260" y2="48" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="232" y1="72" x2="260" y2="72" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="268" y1="24" x2="268" y2="76" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="288" y1="24" x2="288" y2="76" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="308" y1="24" x2="308" y2="76" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="180" y1="116" x2="260" y2="48" stroke="#60A5FA" strokeWidth="1"/>
              <line x1="218" y1="116" x2="260" y2="72" stroke="#60A5FA" strokeWidth="1"/>
              <line x1="268" y1="48" x2="280" y2="24" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="268" y1="72" x2="280" y2="68" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="288" y1="24" x2="300" y2="24" stroke="#94A3B8" strokeWidth="1"/>
              <line x1="288" y1="68" x2="300" y2="68" stroke="#94A3B8" strokeWidth="1"/>

              {/* Labels */}
              <text x="4" y="108" fill="#60A5FA" fontSize="9" fontWeight="600">Substation</text>
              <text x="50" y="104" fill="#047857" fontSize="8" fontWeight="700">R</text>
              <text x="134" y="128" fill="#047857" fontSize="8" fontWeight="600">Zona A</text>
              <text x="378" y="104" fill="#3B82F6" fontSize="8" fontWeight="600">Zona B</text>
              <text x="322" y="120" fill="#94A3B8" fontSize="8" fontWeight="600">Beban</text>
            </svg>
          </div>
        </div>
      </section>

      {/* Research Flow */}
      <section className="landing-flow" id="alur">
        <p className="landing-section-label">Alur Penelitian</p>
        <h2 className="landing-section-title">Pipeline Penelitian End-to-End</h2>
        <div className="landing-flow-grid">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.title} className="landing-flow-step">
              <div className="landing-flow-step-icon">{step.icon}</div>
              <div className="landing-flow-step-num">{i + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="landing-features" id="fitur">
        <p className="landing-section-label">Fitur</p>
        <h2 className="landing-section-title">Kemampuan Platform</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AppLogo width={32} height={32} />
                <div>
                  <div className="landing-footer-brand-name">Recloser Placement Optimization</div>
                </div>
              </div>
              <p className="landing-footer-brand-inst">
                Pusat Penelitian dan Pengembangan Energi dan Ketenagalistrikan<br />
                Universitas Hasanuddin
              </p>
              <p className="landing-footer-brand-desc">
                Platform penelitian untuk memprediksi pola gangguan dan mengoptimalkan penempatan recloser
                pada jaringan distribusi listrik menggunakan LSTM dan ABC.
              </p>
            </div>
            <div className="landing-footer-links">
              <a href="#alur" onClick={(e) => { e.preventDefault(); document.getElementById('alur')?.scrollIntoView({ behavior: 'smooth' }); }}>Alur Penelitian</a>
              <a href="#fitur" onClick={(e) => { e.preventDefault(); scrollToFeatures(); }}>Fitur</a>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowLogin(true)}
                style={{ marginTop: 8 }}
              >
                Login
              </button>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span className="landing-footer-copy">
              © 2025–{new Date().getFullYear()} Pusat Penelitian dan Pengembangan Energi dan Ketenagalistrikan, Universitas Hasanuddin
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
