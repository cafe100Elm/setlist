// Sharing: a workout as text or a picture, the app itself as a link, and
// handing files (backups, spreadsheets) to the phone's share sheet or Downloads.
import { exOf } from './store.js';
import { wVol, wSets, doneSets } from './stats.js';
import { num, mins, fmtDate, fmtSets, isIOS, isAndroid, plural } from './util.js';
import { toast } from './core.js';

export const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');

const stat = (w) => {
  const parts = [];
  if (w.end) parts.push(mins(w.end - w.start));
  parts.push(plural(wSets(w), 'set'));
  const v = wVol(w);
  if (v) parts.push(`${num(v, 0)} lb`);
  return parts;
};

export function workoutText(w) {
  const lines = [`${w.title} — ${fmtDate(w.start, { weekday: true, year: true })}`, stat(w).join(' · '), ''];
  for (const we of w.exercises) {
    const sets = doneSets(we);
    if (sets.length) lines.push(`${exOf(we).name}: ${fmtSets(sets)}`);
  }
  if (w.notes) lines.push('', w.notes);
  lines.push('', 'Logged with Setlist');
  return lines.join('\n');
}

// A picture of the workout, sized for a phone story
export function workoutImage(w) {
  const W = 1080, H = 1350, P = 84;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const font = (px, wt = 700) => { x.font = `${wt} ${px}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`; };
  x.fillStyle = '#0e0f11'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W, 0, 0, W, 0, 900);
  g.addColorStop(0, 'rgba(255,107,61,.34)'); g.addColorStop(1, 'rgba(255,107,61,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  x.fillStyle = '#ff6b3d'; font(30, 800);
  x.fillText(fmtDate(w.start, { weekday: true, year: true }).toUpperCase(), P, 150);
  x.fillStyle = '#f4f1ea'; font(84, 800);
  let title = w.title;
  while (x.measureText(title).width > W - P * 2 && title.length > 4) title = title.slice(0, -2).trimEnd() + '…';
  x.fillText(title, P, 250);

  const figs = [];
  if (w.end) figs.push([mins(w.end - w.start).replace(' min', ''), w.end - w.start >= 36e5 ? 'TIME' : 'MINUTES']);
  figs.push([String(wSets(w)), 'SETS']);
  const v = wVol(w);
  if (v) figs.push([num(v, 0), 'POUNDS LIFTED']);
  const colW = (W - P * 2) / figs.length;
  figs.forEach(([n, l], i) => {
    x.fillStyle = '#f4f1ea'; font(92, 800); x.fillText(n, P + colW * i, 430);
    x.fillStyle = '#9a968c'; font(26, 700); x.fillText(l, P + colW * i, 474);
  });
  x.fillStyle = '#2c3037'; x.fillRect(P, 530, W - P * 2, 2);

  const rows = w.exercises.map((we) => [exOf(we).name, doneSets(we)]).filter((r) => r[1].length);
  const max = 9, lh = 74;
  let y = 610;
  rows.slice(0, max).forEach(([name, sets]) => {
    x.fillStyle = '#f4f1ea'; font(38, 700);
    let n = name;
    while (x.measureText(n).width > 560 && n.length > 4) n = n.slice(0, -2).trimEnd() + '…';
    x.fillText(n, P, y);
    x.fillStyle = '#9a968c'; font(32, 500);
    let s = fmtSets(sets);
    while (x.measureText(s).width > W - P * 2 - 600 && s.includes(' · ')) s = s.slice(0, s.lastIndexOf(' · ')) + ' …';
    x.textAlign = 'right'; x.fillText(s, W - P, y); x.textAlign = 'left';
    y += lh;
  });
  if (rows.length > max) { x.fillStyle = '#9a968c'; font(30, 600); x.fillText(`+ ${rows.length - max} more`, P, y); }

  x.fillStyle = '#ff6b3d'; font(34, 800); x.fillText('SETLIST', P, H - 80);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

const canShareFiles = (file) => { try { return !!navigator.canShare && navigator.canShare({ files: [file] }); } catch (e) { return false; } };

export async function copyText(text, msg = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast("Couldn't copy on this device"); }
}

export async function shareText(text, title) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); } catch (e) { if (e.name !== 'AbortError') copyText(text, 'Copied to clipboard'); }
  } else copyText(text, 'Copied to clipboard');
}

export async function shareImage(w) {
  const blob = await workoutImage(w);
  const file = new File([blob], 'workout.png', { type: 'image/png' });
  if (canShareFiles(file)) {
    try { await navigator.share({ files: [file], title: w.title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(file);
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// On phones, hand the file to the share sheet (Save to Files, Drive, AirDrop…);
// on a computer, download it. Returns true if it went somewhere.
export async function saveFile(name, type, text) {
  const file = new File([text], name, { type });
  if (isIOS() || isAndroid()) {
    // Some phones only accept plain-text files in the share sheet
    for (const f of [file, new File([text], name, { type: 'text/plain' })]) {
      if (!canShareFiles(f)) continue;
      try { await navigator.share({ files: [f], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
    }
  }
  download(file);
  return true;
}

export async function shareApp() {
  const url = appUrl();
  const text = 'Setlist — a free workout log. Open the link, then add it to your home screen to install it.';
  if (navigator.share) {
    try { await navigator.share({ title: 'Setlist', text, url }); } catch (e) { if (e.name !== 'AbortError') copyText(url, 'Link copied'); }
  } else copyText(url, 'Link copied');
}
