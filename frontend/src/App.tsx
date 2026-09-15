import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  Clipboard,
  ExternalLink,
  Link2,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';

type LinkRecord = {
  code: string;
  url: string;
  clicks: number;
  createdAt: string;
  shortUrl: string;
};

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const STORAGE_KEY = 'shortly-links';
const THEME_KEY = 'shortly-theme';

function App() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<LinkRecord | null>(null);
  const [history, setHistory] = useState<LinkRecord[]>(() => loadLinks());
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<LinkRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return history;
    return history.filter(
      (item) => item.url.toLowerCase().includes(query) || item.code.toLowerCase().includes(query),
    );
  }, [history, search]);

  async function shorten(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCopied(false);
    setResult(null);

    if (!url.trim()) {
      setError('Paste a URL to get started.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to shorten this URL.');

      setResult(data);
      setHistory((current) => [data, ...current.filter((item) => item.code !== data.code)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Check your API URL.');
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access was blocked by your browser.');
    }
  }

  async function showStats(item: LinkRecord) {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/links/${encodeURIComponent(item.code)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load statistics.');
      setStats(data);
      setHistory((current) => current.map((link) => (link.code === data.code ? data : link)));
      if (result?.code === data.code) setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load statistics.');
    }
  }

  function removeHistory(code: string) {
    setHistory((current) => current.filter((item) => item.code !== code));
    if (result?.code === code) setResult(null);
    if (stats?.code === code) setStats(null);
  }

  return (
    <div className="app-shell">
      <header className="nav container">
        <a className="brand" href="#top" aria-label="Shortly home">
          <span className="brand-mark"><Link2 size={19} strokeWidth={2.5} /></span>
          <span>Shortly</span>
        </a>
        <div className="nav-actions">
          <span className="api-status"><i /> API connected</span>
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main id="top" className="container main-content">
        <section className="hero">
          <div className="eyebrow"><Sparkles size={14} /> Simple links. Less clutter.</div>
          <h1>Make your links<br /><span>short & shareable.</span></h1>
          <p>Turn long, messy URLs into clean links you can share anywhere.</p>

          <form className="shorten-form" onSubmit={shorten}>
            <div className="input-wrap">
              <Link2 size={20} />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste your long URL here..."
                type="url"
                autoComplete="url"
                spellCheck={false}
                aria-label="Long URL"
              />
              {url && <button type="button" className="clear-input" onClick={() => setUrl('')} aria-label="Clear URL"><X size={17} /></button>}
            </div>
            <button className="shorten-button" disabled={loading} type="submit">
              {loading ? <Loader2 className="spin" size={18} /> : <ArrowUpRight size={18} />}
              {loading ? 'Shortening...' : 'Shorten URL'}
            </button>
          </form>

          {error && <div className="error-banner">{error}</div>}

          {result && (
            <section className="result-card reveal">
              <div className="result-label"><span className="success-dot"><Check size={13} /></span> Your short link is ready</div>
              <div className="result-row">
                <div className="result-url">
                  <a href={result.shortUrl} target="_blank" rel="noreferrer">{result.shortUrl}</a>
                  <span>{result.url}</span>
                </div>
                <div className="result-actions">
                  <button className="secondary-button" onClick={() => copy(result.shortUrl)}>
                    {copied ? <Check size={17} /> : <Clipboard size={17} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <a className="primary-icon-button" href={result.shortUrl} target="_blank" rel="noreferrer" aria-label="Open short link"><ExternalLink size={17} /></a>
                </div>
              </div>
            </section>
          )}
        </section>

        <section className="history-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">YOUR LINKS</p>
              <h2>Recent links</h2>
            </div>
            {history.length > 0 && (
              <div className="search-box">
                <Search size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search links" />
              </div>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Link2 size={23} /></div>
              <h3>{history.length ? 'No links found' : 'Your links will appear here'}</h3>
              <p>{history.length ? 'Try a different search.' : 'Shorten your first URL above and keep track of it here.'}</p>
            </div>
          ) : (
            <div className="link-list">
              {filteredHistory.map((item) => (
                <article className="history-card" key={item.code}>
                  <div className="history-icon"><Link2 size={18} /></div>
                  <div className="history-main">
                    <a className="history-short" href={item.shortUrl} target="_blank" rel="noreferrer">{item.shortUrl}</a>
                    <span className="history-original">{item.url}</span>
                  </div>
                  <div className="click-count"><BarChart3 size={15} /><strong>{item.clicks}</strong><span>clicks</span></div>
                  <div className="history-actions">
                    <button onClick={() => copy(item.shortUrl)} aria-label="Copy short URL"><Clipboard size={17} /></button>
                    <button onClick={() => showStats(item)} aria-label="View statistics"><BarChart3 size={17} /></button>
                    <button onClick={() => removeHistory(item.code)} aria-label="Remove from history"><Trash2 size={17} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer container">
        <span>Shortly</span><span>Fast, minimal URL shortening.</span>
      </footer>

      {stats && (
        <div className="modal-backdrop" onMouseDown={() => setStats(null)}>
          <div className="stats-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="section-kicker">LINK ANALYTICS</p><h2>Link statistics</h2></div><button className="close-button" onClick={() => setStats(null)}><X size={18} /></button></div>
            <div className="stat-url">{stats.shortUrl}</div>
            <div className="big-stat"><span>Total clicks</span><strong>{stats.clicks}</strong></div>
            <div className="modal-meta"><span>Created</span><strong>{formatDate(stats.createdAt)}</strong></div>
            <div className="modal-meta"><span>Destination</span><strong>{stats.url}</strong></div>
            <a className="modal-open" href={stats.shortUrl} target="_blank" rel="noreferrer">Open link <ExternalLink size={16} /></a>
          </div>
        </div>
      )}
    </div>
  );
}

function loadLinks(): LinkRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default App;
