// Small formatting helpers shared by every screen.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const p2 = (n) => String(n).padStart(2, '0');

// A number without a trailing ".0", with thousands separators.
export const num = (n, dp = 1) => {
  if (n == null || isNaN(n)) return '–';
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return r.toLocaleString('en-US', { maximumFractionDigits: dp });
};

// 45200 → "45.2k", 2700000 → "2.7M"
export const abbr = (n) => {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n).toLocaleString('en-US');
};

// Seconds → "1:30" or "1:02:05"
export const clock = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
};

// Minutes → "46 min" or "1h 12m"
export const mins = (ms) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${p2(m % 60)}m` : `${m} min`;
};

export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
// Monday of the week containing ts
export const startOfWeek = (ts) => { const d = new Date(startOfDay(ts)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
export const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };

const thisYear = () => new Date().getFullYear();
export const fmtDate = (ts, opts = {}) => {
  const d = new Date(ts);
  const o = { month: 'short', day: 'numeric' };
  if (opts.weekday) o.weekday = 'short';
  if (opts.year || d.getFullYear() !== thisYear()) o.year = 'numeric';
  return d.toLocaleDateString('en-US', o);
};
// Short axis label: "Mar 14" this year, "Mar ’25" for other years
export const fmtShort = (ts) => {
  const d = new Date(ts);
  return d.getFullYear() === thisYear() ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${d.toLocaleDateString('en-US', { month: 'short' })} ’${String(d.getFullYear()).slice(2)}`;
};
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const fmtMonth = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// One set in compact form: "135×10", "×12", "1:30", "2.5mi"
export const fmtSet = (s) => {
  const parts = [];
  if (s.w && s.r) parts.push(`${num(s.w)}×${s.r}`);
  else if (s.w) parts.push(`${num(s.w)}lb`);
  else if (s.r) parts.push(`×${s.r}`);
  if (s.d) parts.push(`${num(s.d, 2)}mi`);
  if (s.t) parts.push(clock(s.t));
  return parts.join(' ') || '–';
};
export const fmtSets = (sets) => (sets.length ? sets.map(fmtSet).join(' · ') : '–');

export const plural = (n, word, many) => `${num(n, 0)} ${n === 1 ? word : (many || word + 's')}`;

export const isAndroid = () => /Android/.test(navigator.userAgent);
export const isIOS = () => !isAndroid() && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
