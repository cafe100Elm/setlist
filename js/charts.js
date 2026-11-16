// Small hand-drawn SVG charts. Every mark carries a data-tip so tapping it
// shows the exact figures.
import { esc, abbr } from './util.js';

const W = 340;
const tipAttr = (t) => (t ? ` data-tip="${esc(t)}" tabindex="0"` : '');

// Bars, with an optional line over them (second scale).
// data: [{ label, v, l, tip }]
export function barChart({ data, h = 160, line = false, hiLast = false, yFmt = abbr }) {
  if (!data.length) return '';
  const padT = 14, padB = 20, padL = 4, padR = 4;
  const ih = h - padT - padB, iw = W - padL - padR;
  const max = Math.max(1, ...data.map((d) => d.v));
  const lmax = line ? Math.max(1, ...data.map((d) => d.l || 0)) : 1;
  const step = iw / data.length;
  const bw = Math.max(2, Math.min(26, step * 0.68));
  const every = Math.ceil(data.length / 6);
  let out = `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" preserveAspectRatio="xMidYMid meet">`;
  out += `<line x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}" class="axis"/>`;
  out += `<line x1="${padL}" x2="${W - padR}" y1="${padT}" y2="${padT}" class="grid"/>`;
  out += `<text x="${padL}" y="${padT - 4}" class="tick">${esc(yFmt(max))}</text>`;
  const pts = [];
  data.forEach((d, i) => {
    const cx = padL + step * i + step / 2;
    const bh = d.v > 0 ? Math.max(2, (d.v / max) * ih) : 0;
    const cls = hiLast && i === data.length - 1 ? 'bar hi' : 'bar';
    if (bh) out += `<rect class="${cls}" x="${(cx - bw / 2).toFixed(1)}" y="${(padT + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(4, bw / 2)}"/>`;
    if (i % every === 0 || data.length <= 6) out += `<text x="${cx.toFixed(1)}" y="${h - 5}" class="tick mid">${esc(d.label)}</text>`;
    if (line) pts.push([cx, padT + ih - ((d.l || 0) / lmax) * ih]);
    out += `<rect class="hit" x="${(cx - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}"${tipAttr(d.tip)}/>`;
  });
  if (line && pts.length) {
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const dots = pts.map((p) => `<circle class="dot blue" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.2"/>`).join('');
    // lines go under the hit areas visually but must not block taps
    out = out.replace('</svg>', '') + `<path class="ln blue" d="${path}" pointer-events="none"/><g pointer-events="none">${dots}</g>`;
  }
  return out + '</svg>';
}

// Lines over optional grey background bars.
// series: [{ cls, pts:[number|null] }], bars: [number], tips: [string], labels: [string]
export function lineChart({ series, bars, tips = [], labels = [], h = 170, yFmt = abbr }) {
  const n = Math.max(...series.map((s) => s.pts.length), bars ? bars.length : 0);
  if (!n) return '';
  const padT = 14, padB = 20, padL = 6, padR = 6;
  const ih = h - padT - padB, iw = W - padL - padR;
  const vals = series.flatMap((s) => s.pts).filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad); hi += pad;
  const x = (i) => (n === 1 ? padL + iw / 2 : padL + (iw * i) / (n - 1));
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" preserveAspectRatio="xMidYMid meet">`;
  out += `<line x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}" class="axis"/>`;
  out += `<line x1="${padL}" x2="${W - padR}" y1="${padT}" y2="${padT}" class="grid"/>`;
  out += `<text x="${padL}" y="${padT - 4}" class="tick">${esc(yFmt(hi))}</text>`;
  out += `<text x="${padL}" y="${padT + ih - 4}" class="tick">${esc(yFmt(lo))}</text>`;
  if (bars) {
    const bmax = Math.max(1, ...bars);
    const bw = Math.max(2, Math.min(14, (iw / n) * 0.6));
    bars.forEach((b, i) => {
      const bh = (b / bmax) * ih * 0.55;
      if (bh > 0) out += `<rect class="bar ghost" x="${(x(i) - bw / 2).toFixed(1)}" y="${(padT + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"/>`;
    });
  }
  for (const s of series) {
    let d = '', pen = false;
    s.pts.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; pen = true; });
    out += `<path class="ln ${s.cls}" d="${d}"/>`;
    if (n <= 40) s.pts.forEach((v, i) => { if (v != null) out += `<circle class="dot ${s.cls}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4"/>`; });
  }
  const every = Math.ceil(n / 4);
  const step = n === 1 ? iw : iw / (n - 1);
  for (let i = 0; i < n; i++) {
    if (labels[i] && (i % every === 0 || i === n - 1) && !(i !== n - 1 && n - 1 - i < every / 2)) {
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      out += `<text x="${x(i).toFixed(1)}" y="${h - 5}" class="tick" text-anchor="${anchor}">${esc(labels[i])}</text>`;
    }
    out += `<rect class="hit" x="${(x(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}"${tipAttr(tips[i])}/>`;
  }
  return out + '</svg>';
}

// Calendar heatmap: weeks as columns, Monday at the top.
export function heatChart({ weeks, max }, tipFor) {
  const c = 11, g = 2;
  const w = weeks.length * (c + g) - g, h = 7 * (c + g) - g;
  let out = `<svg class="chart heat" viewBox="0 0 ${w} ${h}" role="img" preserveAspectRatio="xMidYMid meet">`;
  weeks.forEach((col, i) => col.forEach((d, j) => {
    if (d.future) return;
    const lvl = !d.count ? 0 : !max || !d.vol ? 1 : 1 + Math.min(3, Math.floor((d.vol / max) * 3.999));
    out += `<rect class="hc l${lvl}" x="${i * (c + g)}" y="${j * (c + g)}" width="${c}" height="${c}" rx="2.5"${tipAttr(tipFor(d))}/>`;
  }));
  return out + '</svg>';
}

// parts: [{ v, cls }]
export function donut(parts, centerTop, centerBottom) {
  const r = 40, C = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  let off = 0;
  let out = `<svg class="donut" viewBox="0 0 110 110" role="img"><g transform="rotate(-90 55 55)">`;
  out += `<circle cx="55" cy="55" r="${r}" class="donut-bg"/>`;
  for (const p of parts) {
    const len = (p.v / total) * C;
    if (len <= 0) continue;
    out += `<circle cx="55" cy="55" r="${r}" class="donut-seg ${p.cls}" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${(C - Math.max(0, len - 1.5)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len;
  }
  out += `</g><text x="55" y="54" class="donut-n">${esc(centerTop)}</text><text x="55" y="68" class="donut-l">${esc(centerBottom)}</text></svg>`;
  return out;
}

// A row of tiny bars (recent top weights), last one highlighted
export function spark(values) {
  const max = Math.max(...values, 1);
  return `<span class="spark" aria-hidden="true">${values.map((v, i) => `<i style="height:${Math.max(12, Math.round((v / max) * 100))}%"${i === values.length - 1 ? ' class="hi"' : ''}></i>`).join('')}</span>`;
}
