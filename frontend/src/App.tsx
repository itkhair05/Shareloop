import { useState } from 'react';
import './App.css';

interface HealthStatus {
  status: string;
  service?: string;
  timestamp?: string;
  checkedAt?: string;
  error?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkBackendHealth = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setHealth({
        status: data.status || 'UP',
        service: data.service || 'shareloop-backend',
        timestamp: data.timestamp,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setHealth({
        status: 'UNREACHABLE',
        error: err instanceof Error ? err.message : 'Connection failed',
        checkedAt: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="shareloop-layout">
      {/* Navigation Header */}
      <header className="navbar">
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" className="logo-svg">
              <circle cx="24" cy="24" r="18" stroke="url(#navGrad)" strokeWidth="3.5" strokeDasharray="6 4" />
              <path d="M18 24C18 20.6863 20.6863 18 24 18C27.3137 18 30 20.6863 30 24C30 27.3137 27.3137 30 24 30C20.6863 30 18 27.3137 18 24Z" fill="url(#navGrad)" fillOpacity="0.25" stroke="url(#navGrad)" strokeWidth="2.5" />
              <defs>
                <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="50%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-title">ShareLoop</span>
        </div>

        <div className="nav-actions">
          <span className="badge badge-pulse">v0.1.0 Foundation</span>
          <button
            id="check-health-btn"
            className="btn btn-secondary"
            onClick={checkBackendHealth}
            disabled={isChecking}
          >
            {isChecking ? 'Checking API...' : 'Ping Backend'}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="content">
        <section className="hero-section">
          <div className="hero-pill">
            <span className="pill-dot"></span>
            <span>Sustainable Neighborhood Exchange</span>
          </div>
          <h1 className="hero-headline">
            ShareLoop
          </h1>
          <p className="hero-tagline">
            A portfolio-quality full-stack community platform connecting neighbors for free item sharing, second-hand trading, and wanted-item requests.
          </p>

          <div className="cta-group">
            <button id="cta-explore" className="btn btn-primary">
              Explore Community Loop
            </button>
            <button id="cta-post" className="btn btn-outline">
              Request an Item
            </button>
          </div>
        </section>

        {/* Health Status Bar (if triggered) */}
        {health && (
          <section className="health-card" aria-live="polite">
            <div className="health-card-header">
              <span className={`status-indicator status-${health.status.toLowerCase()}`}></span>
              <strong>Backend Status: {health.status}</strong>
              <span className="timestamp">Checked at {health.checkedAt}</span>
            </div>
            {health.service && <p className="health-meta">Service: {health.service}</p>}
            {health.timestamp && <p className="health-meta">Server Time: {health.timestamp}</p>}
            {health.error && <p className="health-error">Notice: {health.error} (Ensure backend service is running on port 8080)</p>}
          </section>
        )}

        {/* Feature Pillars */}
        <section className="pillars-grid">
          <article className="pillar-card">
            <div className="pillar-icon free-icon">🎁</div>
            <h2>Free Item Sharing</h2>
            <p>
              Declutter sustainably by giving away tools, furniture, books, and appliances to neighbors who need them most.
            </p>
            <div className="pillar-tag">Zero Waste</div>
          </article>

          <article className="pillar-card">
            <div className="pillar-icon trade-icon">🤝</div>
            <h2>Second-Hand Trading</h2>
            <p>
              Buy, sell, or trade pre-loved goods locally with transparent item histories and community accountability.
            </p>
            <div className="pillar-tag">Fair Exchange</div>
          </article>

          <article className="pillar-card">
            <div className="pillar-icon wanted-icon">🔍</div>
            <h2>Wanted Item Requests</h2>
            <p>
              Looking for a specific spare part, textbook, or camping gear? Post a request and let your local circle help.
            </p>
            <div className="pillar-tag">Community Driven</div>
          </article>
        </section>

        {/* Architecture Foundation Spec */}
        <section className="tech-stack-card">
          <h3 className="section-title">Initial Architecture Foundation</h3>
          <div className="tech-pills">
            <div className="tech-badge">
              <span className="tech-name">Backend</span>
              <span className="tech-version">Spring Boot 3.5.16 • Java 17</span>
            </div>
            <div className="tech-badge">
              <span className="tech-name">Frontend</span>
              <span className="tech-version">React 19 • TypeScript • Vite 8</span>
            </div>
            <div className="tech-badge">
              <span className="tech-name">Database</span>
              <span className="tech-version">PostgreSQL 16 Alpine</span>
            </div>
            <div className="tech-badge">
              <span className="tech-name">DevOps</span>
              <span className="tech-version">Docker Compose • Maven Wrapper</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© {CURRENT_YEAR} ShareLoop Platform. Initial foundation initialized.</p>
      </footer>
    </div>
  );
}

export default App;
