// Insights tab: charts, trends and records across the whole log.
import { state, getEx } from './store.js';
import { ui, on, onChange, registerView, render, catIcon, icons } from './core.js';
import { CATS, CAT_ORDER } from './lib.js';
import { totals, series, bestWeek, heat, mix, muscles, topWeighted, progress, cardio, records, prTimeline, mostTrained } from './stats.js';
import { barChart, lineChart, heatChart, donut } from './charts.js';
import { esc, num, abbr, mins, fmtDate, fmtShort, plural } from './util.js';

const RANGES = [['12w', '12W'], ['6m', '6M'], ['1y', '1Y'], ['all', 'All']];

registerView('insights', () => {
  if (!state.workouts.length) {
    return `<div class="empty-box"><div class="empty-ic">${icons.insights}</div><h2>Your numbers will appear here</h2><p>Volume trends, a consistency calendar, strength progress for every lift, and your personal records, as soon as you log a workout.</p>
      <button class="btn primary big" data-a="go" data-tab="home">Start a workout</button></div>`;
  }
  const t = totals();
  const s = series(ui.range);
  const bw = bestWeek();
  let h = `<div class="seg small" role="group" aria-label="Time range">${RANGES.map(([k, l]) => `<button class="${ui.range === k ? 'on' : ''}" data-a="range" data-v="${k}" aria-pressed="${ui.range === k}">${l}</button>`).join('')}</div>`;

  h += `<div class="stats">
    <div><b>${num(s.workouts, 0)}</b><span>Workouts</span></div>
    <div><b>${abbr(s.vol)}</b><span>Lb lifted</span></div>
    <div><b>${num(s.sets, 0)}</b><span>Sets</span></div>
    <div><b>${num(s.rate, 1)}</b><span>Per ${s.unit}</span></div>
  </div>`;

  h += `<section class="card"><div class="card-h"><h2>Training volume</h2><span class="muted">Best week ${abbr(bw.vol)} lb</span></div>
    ${barChart({ data: s.buckets.map((b) => ({ label: b.label, v: b.vol, l: b.count, tip: `${s.unit === 'week' ? 'Week of ' : ''}${b.label}: ${num(b.vol, 0)} lb · ${plural(b.count, 'workout')}` })), line: true })}
    <div class="legend"><span><i class="lg bar"></i>Pounds lifted per ${s.unit}</span><span><i class="lg blue"></i>Workouts</span></div>
    <p class="sr">Bar chart of total pounds lifted per ${s.unit} with a line for the number of workouts.</p>
  </section>`;

  const hm = heat();
  h += `<section class="card"><div class="card-h"><h2>Consistency</h2><span class="muted">${hm.active} active days</span></div>
    ${heatChart(hm, (d) => `${fmtDate(d.ts, { weekday: true })}: ${d.count ? `${num(d.vol, 0)} lb · ${plural(d.count, 'workout')}` : 'rest day'}`)}
    <div class="legend"><span>Last 6 months</span><span class="grow"></span><span>Less</span><span class="heat-key"><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i></span><span>More volume</span></div>
    <p class="sr">Calendar of the last six months; darker squares are days with more pounds lifted.</p>
  </section>`;

  const mx = mix();
  const cats = CAT_ORDER.filter((c) => mx[c] && mx[c].sets);
  const totalSets = cats.reduce((n, c) => n + mx[c].sets, 0);
  if (totalSets) {
    h += `<section class="card"><div class="card-h"><h2>Training mix</h2><span class="muted">Completed sets, all time</span></div>
      <div class="mix">${donut(cats.map((c) => ({ v: mx[c].sets, cls: 'seg-' + c })), abbr(totalSets), 'sets')}
      <div class="mix-list">${cats.map((c) => {
    const o = mx[c];
    const extra = [o.lbs ? `${abbr(o.lbs)} lb` : '', o.mi ? `${num(o.mi, 1)} mi` : '', o.sec && (c === 'c' || c === 'y' || !o.lbs) ? mins(o.sec * 1000) : '', o.reps && !o.lbs ? `${num(o.reps, 0)} reps` : ''].filter(Boolean).join(' · ');
    return `<div><span class="mix-n">${catIcon(c)}<b>${CATS[c].short}</b><em>${o.sets / totalSets < 0.005 ? '<1' : Math.round((o.sets / totalSets) * 100)}%</em></span><small>${num(o.sets, 0)} sets · ${plural(o.sessions, 'session')}${extra ? ' · ' + extra : ''}</small></div>`;
  }).join('')}</div></div>
    </section>`;
  }

  const ms = muscles().slice(0, 12);
  if (ms.length) {
    const max = ms[0].vol;
    h += `<section class="card"><div class="card-h"><h2>Muscle focus</h2><span class="muted">Pounds lifted, all time</span></div>
      <div class="hbars">${ms.map((m) => `<div class="hbar"><div class="hbar-t"><b>${esc(m.muscle)}</b><span>${abbr(m.vol)} lb · ${plural(m.sessions, 'session')}</span></div>
        <div class="hbar-b"><i style="width:${Math.max(2, (m.vol / max) * 100)}%"></i></div><small>Top lift: ${esc(m.top.name)} (${abbr(m.top.vol)} lb)</small></div>`).join('')}</div>
    </section>`;
  }

  const top = topWeighted();
  if (top.length) {
    if (!ui.progEx || !top.some((x) => x.exId === ui.progEx)) {
      // allow any exercise chosen from another card, even outside the top 20
      if (!ui.progEx || !progress(ui.progEx).length) ui.progEx = top[0].exId;
    }
    const exId = ui.progEx;
    const p = progress(exId);
    const ex = getEx(exId);
    const options = top.some((x) => x.exId === exId) ? top : [{ exId, name: ex ? ex.name : 'Exercise', sessions: p.length }, ...top];
    const best = p.reduce((b, x) => (x.top > b.top ? x : b), p[0]);
    const bestE = Math.max(...p.map((x) => x.e));
    h += `<section class="card" id="progress"><div class="card-h"><h2>Exercise progress</h2></div>
      <select class="sel" data-c="prog-ex" aria-label="Exercise">${options.map((x) => `<option value="${esc(x.exId)}"${x.exId === exId ? ' selected' : ''}>${esc(x.name)} (${x.sessions})</option>`).join('')}</select>
      <div class="figs four"><div><b>${num(best.top)} × ${best.topR}</b><span>Best set</span></div><div><b>${num(bestE)}</b><span>Est. 1RM</span></div><div><b>${p.length}</b><span>Sessions</span></div><div><b>${fmtDate(p[p.length - 1].at)}</b><span>Last done</span></div></div>
      ${p.length >= 2 ? `${lineChart({
    series: [{ cls: 'green', pts: p.map((x) => x.e) }, { cls: 'blue dash', pts: p.map((x) => x.top) }],
    bars: p.map((x) => x.vol), labels: p.map((x) => fmtShort(x.at)), yFmt: (v) => num(v, 0),
    tips: p.map((x) => `${fmtDate(x.at, { year: true })}: top ${num(x.top)}×${x.topR} · est. 1RM ${num(x.e)} · ${num(x.vol, 0)} lb`),
  })}
      <div class="legend"><span><i class="lg green"></i>Estimated 1RM</span><span><i class="lg blue dash"></i>Top set weight</span><span><i class="lg ghostbar"></i>Session volume</span></div>` : '<p class="empty">Log this exercise in a couple more sessions and the trend line will appear.</p>'}
      <p class="hint">Estimated one-rep max = weight × (1 + reps ÷ 30), from your best set each session. It tracks strength without ever testing a true max.</p>
    </section>`;
  }

  const c = cardio();
  if (c.mi || c.sec) {
    h += `<section class="card"><div class="card-h"><h2>Cardio</h2></div>
      <div class="figs"><div><b>${num(c.mi, 1)}</b><span>Miles</span></div><div><b>${mins(c.sec * 1000)}</b><span>Time moving</span></div><div><b>${c.sessions}</b><span>Sessions</span></div></div>
      ${c.mi ? `${barChart({ data: c.months.map((m) => ({ label: m.label, v: m.mi, tip: `${m.label}: ${num(m.mi, 1)} mi` })), h: 120, yFmt: (v) => num(v, 1) + ' mi' })}<div class="legend"><span><i class="lg bar"></i>Miles per month</span></div>` : ''}
    </section>`;
  }

  const r = records();
  const tile = (label, big, small) => `<div class="rec"><span>${label}</span><b>${big}</b><small>${small}</small></div>`;
  h += `<section class="card"><div class="card-h"><h2>Records &amp; milestones</h2></div><div class="recs">
    ${r.heaviest ? tile('Heaviest set ever', `${num(r.heaviest.best.w)} lb × ${r.heaviest.best.r}`, `${esc(r.heaviest.name)} · ${fmtDate(r.heaviest.best.at, { year: true })}`) : ''}
    ${r.strongest ? tile('Strongest est. 1RM', `${num(r.strongest.bestE.e)} lb`, `${esc(r.strongest.name)} · ${num(r.strongest.bestE.w)}×${r.strongest.bestE.r} · ${fmtDate(r.strongest.bestE.at, { year: true })}`) : ''}
    ${bw.vol ? tile('Best week', `${abbr(bw.vol)} lb`, `7 days from ${fmtDate(bw.start, { year: true })}`) : ''}
    ${tile('Consistency', `${num(t.perWeek12, 1)} / week`, `Last 12 weeks · best streak ${t.bestStreak}d · ${t.activeDays} active days`)}
    ${t.dur ? tile('Time in gym', mins(t.dur), `Average session ${mins(t.avgDur)}`) : ''}
    ${tile('Lifetime totals', `${num(t.workouts, 0)} workouts`, `${num(t.sets, 0)} sets · ${num(t.reps, 0)} reps · ${abbr(t.vol)} lb`)}
  </div></section>`;

  const tl = prTimeline();
  if (tl.length) {
    const shown = ui.prAll ? tl.slice(0, 200) : tl.slice(0, 8);
    h += `<section class="card"><div class="card-h"><h2>PR timeline</h2><span class="muted">${tl.length} records</span></div><div class="list">
      ${shown.map((p) => `<button class="lrow" data-a="prog-pick" data-id="${esc(p.exId)}"><span><b>${esc(p.name)}</b><small>${fmtDate(p.at, { year: true })} · ${num(p.w)} × ${p.r}</small></span><span class="pr-badge">${num(p.e)} <small>est. 1RM</small></span></button>`).join('')}
    </div>${tl.length > 8 && !ui.prAll ? `<button class="btn big" data-a="pr-all">Show all</button>` : ''}</section>`;
  }

  const mt = mostTrained();
  if (mt.length) {
    h += `<section class="card"><div class="card-h"><h2>Most-trained exercises</h2><span class="muted">By volume</span></div><div class="list">
      ${mt.map((x, i) => `<button class="lrow" data-a="prog-pick" data-id="${esc(x.exId)}"><span class="rank">${i + 1}</span><span class="grow"><b>${esc(x.name)}</b><small>${plural(x.sessions, 'session')} · ${num(x.sets, 0)} sets${x.best ? ` · best ${num(x.best.w)}×${x.best.r}` : ''}</small></span><span class="big-n">${abbr(x.vol)} <small>lb</small></span></button>`).join('')}
    </div></section>`;
  }
  return h;
});

on('range', (el) => { ui.range = el.dataset.v; render(); });
onChange('prog-ex', (el) => { ui.progEx = el.value; render(); });
on('prog-pick', (el) => {
  ui.progEx = el.dataset.id;
  render();
  const card = document.getElementById('progress');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
on('pr-all', () => { ui.prAll = true; render(); });
