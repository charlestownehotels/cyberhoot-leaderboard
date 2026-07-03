// CyberHoot Leaderboard — renders public/data/leaderboard.json.
// No dependencies, no build step. Shows only name, property, HootScore, level.

// CyberHoot HootRank levels, lowest → highest (official names, descriptions and
// thresholds from CyberHoot). Earned by completing training over time — NOT the
// HootScore. `crit` = completed-assignment band; `full` = CyberHoot's blurb.
const LEVELS = [
  {
    key: 'hatchling',
    label: 'Fluffy Hatchling',
    short: 'Taking their very first peeks into cybersecurity.',
    crit: '0',
    dot: '#94a3b8',
    full: "This user is just starting in the world of cybersecurity! As a Fluffy Hatchling, they're taking their very first peeks into the vast digital landscape. Every journey starts with curiosity. Ranked here with no assignments completed yet.",
  },
  {
    key: 'novice',
    label: 'Owlet Novice',
    short: 'Just spread their wings — full of potential.',
    crit: '1–7',
    dot: '#0e7490',
    full: 'This user just spread their wings in the vast cybersecurity forest. Though young and inexperienced, every Owlet has the potential to soar high. Ranked here with 1–7 completed assignments (or a score ≤ 20).',
  },
  {
    key: 'explorer',
    label: 'Feathered Explorer',
    short: 'Diving deeper into the digital realm.',
    crit: '8–17',
    dot: '#1d4ed8',
    full: 'This user is on an adventure, diving deeper into the complexities of the digital realm. With every assignment, their feathers grow stronger. Ranked here with 8–17 completed assignments (or a score ≤ 40).',
  },
  {
    key: 'protector',
    label: 'Perch Protector',
    short: 'Vigilant, watching over your domain from a high perch.',
    crit: '18–28',
    dot: '#6d28d9',
    full: 'Vigilant and poised, this user watches over your digital domain from a high perch. Their awareness makes it harder for threats to go unnoticed. Ranked here with 18–28 completed assignments (or a score ≤ 60).',
  },
  {
    key: 'guardian',
    label: 'Talon Guardian',
    short: 'Sharp talons, sharper mind — a formidable guardian.',
    crit: '29–41',
    dot: '#047857',
    full: 'With sharp talons and an even sharper mind, this user is a formidable guardian of cyberspace. Few can match their dedication and skill. Ranked here with 29–41 completed assignments (or a score ≤ 80).',
  },
  {
    key: 'sage',
    label: 'Wise Owl Sage',
    short: 'Wisdom that lights the darkest corners of the internet.',
    crit: '42+',
    dot: '#b45309',
    full: "This user's wisdom illuminates the darkest corners of the internet. As a sage, their knowledge and experience serve as a beacon for others. Ranked here with more than 41 completed assignments.",
  },
];
const RANK_ORDER = LEVELS.map((l) => l.key);

const COLUMNS = [
  { key: 'rank', label: '#', num: true, cls: 'rankcell' },
  { key: 'name', label: 'Employee', num: false },
  { key: 'property', label: 'Property', num: false, cls: 'hotel' },
  { key: 'hootScore', label: 'HootScore', num: true, cls: 'score-cell' },
  { key: 'hootRank', label: 'Level', num: false },
];

const state = {
  data: null,
  search: '',
  property: 'all',
  sortKey: 'rank',
  sortDir: 'asc', // rank asc == HootScore desc (tie-broken server-side)
};

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function relTime(iso) {
  const then = new Date(iso);
  const s = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (s < 90) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hr${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function scoreColor(v) {
  if (v >= 90) return '#10b981';
  if (v >= 80) return '#3b82f6';
  if (v >= 70) return '#f59e0b';
  return '#ef4444';
}

function badge(rank) {
  const key = RANK_ORDER.includes((rank || '').toLowerCase()) ? rank.toLowerCase() : 'unknown';
  return `<span class="badge ${key}">${esc(rank || '—')}</span>`;
}

async function load() {
  try {
    const res = await fetch('data/leaderboard.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    document.querySelector('main').innerHTML =
      `<p style="padding:24px">Could not load leaderboard data (${esc(err.message)}).</p>`;
    return;
  }
  initControls();
  renderStats();
  renderPodium();
  renderLegend();
  renderProperties();
  renderFooter();
  renderTable();
}

function initControls() {
  const props = [...new Set(state.data.users.map((u) => u.property))].sort((a, b) => a.localeCompare(b));
  $('hotelFilter').innerHTML =
    `<option value="all">All properties (${props.length})</option>` +
    props.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join('');

  $('search').addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderTable();
  });
  $('hotelFilter').addEventListener('change', (e) => {
    state.property = e.target.value;
    renderTable();
  });
}

function renderStats() {
  const d = state.data;
  const propCount = new Set(d.users.map((u) => u.property)).size;
  const avg = d.users.length
    ? Math.round((d.users.reduce((a, u) => a + u.hootScore, 0) / d.users.length) * 10) / 10
    : 0;
  $('stats').innerHTML = `
    <div><dt>Employees</dt><dd>${d.userCount}</dd></div>
    <div><dt>Properties</dt><dd>${propCount}</dd></div>
    <div><dt>Avg HootScore</dt><dd>${avg}</dd></div>`;
}

function renderPodium() {
  const places = ['1st place', '2nd place', '3rd place'];
  $('podium').innerHTML = state.data.users
    .slice(0, 3)
    .map(
      (u, i) => `
      <div class="pod p${i + 1}">
        <div class="pod-top">
          <span class="medal">${MEDALS[i + 1]}</span>
          <span class="place">${places[i]}</span>
        </div>
        <div class="name">${esc(u.name)}</div>
        <div class="hotel">${esc(u.property)}</div>
        <div class="pod-score"><b>${esc(u.hootScore)}</b><span class="unit">HootScore</span></div>
        ${badge(u.hootRank)}
      </div>`
    )
    .join('');
}

function renderLegend() {
  const scaleSegs = [
    { label: '90–100', color: '#10b981' },
    { label: '80–89', color: '#3b82f6' },
    { label: '70–79', color: '#f59e0b' },
    { label: 'below 70', color: '#ef4444' },
  ]
    .map((s) => `<span class="seg"><span class="sw" style="background:${s.color}"></span>${s.label}</span>`)
    .join('');

  const rows = LEVELS.map(
    (l) => `<div class="lrow" title="${esc(l.full)}">
      <span class="lname"><span class="dot" style="background:${l.dot}"></span>${esc(l.label)}</span>
      <span class="lcrit">${esc(l.crit)}</span>
      <span class="ldesc">${esc(l.short)}</span>
    </div>`
  ).join('');

  $('legendBody').innerHTML = `
    <p class="legend-lead">Each person shows two separate things:</p>
    <div class="concept-grid">
      <div class="concept">
        <div class="concept-h"><span class="ci">📊</span> HootScore <span class="tag tag-perf">Performance</span></div>
        <p>CyberHoot's 0–100 measure of how well someone engages with training — weighted across
           phishing (40%), videos (40%), policies (15%) and optional (5%), reduced for real
           phishing failures. <b>The board ranks by this.</b></p>
        <div class="scale">${scaleSegs}</div>
      </div>
      <div class="concept">
        <div class="concept-h"><span class="ci">🏅</span> Level <span class="tag tag-exp">Experience</span></div>
        <p>Six owl ranks a user climbs by completing more training over time — independent of the
           score. The more assignments completed, the higher the rank:</p>
      </div>
    </div>
    <div class="level-list">
      <div class="lhead"><span>Level</span><span>Assignments completed</span><span>What it means</span></div>
      ${rows}
    </div>
    <div class="legend-note">
      <p class="rank-how"><b>How the board ranks:</b> everyone is placed in one single list. The six
        rules below are applied in order, and each one <b>only</b> breaks ties left by the rule above
        it. So when a group of people share the same HootScore (say, everyone at 100), they're all
        sorted against one another by the next rule — top to bottom, as one group, not compared in
        isolated pairs. The person who ends up highest genuinely beat everyone else tied with them.</p>
      <ol class="rank-steps">
        <li><b>HootScore</b> — highest first. This is the primary ranking; everything below only
          matters when scores are equal.</li>
        <li><b>Level</b> — higher owl rank wins, from <b>Wise Owl Sage</b> down to <b>Fluffy
          Hatchling</b> (more training completed over time).</li>
        <li><b>Most assignments completed</b> — still tied? Whoever has finished more training.</li>
        <li><b>Fewest late submissions</b> — then whoever turned their training in on time more often.</li>
        <li><b>Fewest quiz attempts</b> — then whoever needed fewer tries to pass.</li>
        <li><b>Name (A&ndash;Z)</b> — a final alphabetical tiebreaker, so the order is always stable
          and predictable when everything else is identical.</li>
      </ol>
      <p class="rank-fyi">Score and level are independent — a Wise Owl Sage can score 85 while an
        Owlet Novice scores 100. Only users in compliance appear, since CyberHoot assigns a HootScore
        once all assignments are complete.</p>
    </div>`;
}

function renderProperties() {
  const groups = new Map();
  for (const u of state.data.users) {
    const g = groups.get(u.property) || { sum: 0, n: 0 };
    g.sum += u.hootScore;
    g.n += 1;
    groups.set(u.property, g);
  }
  const cards = [...groups.entries()]
    .map(([name, g]) => ({ name, avg: Math.round((g.sum / g.n) * 10) / 10, n: g.n }))
    .sort((a, b) => b.avg - a.avg)
    .map(
      (p) => `<div class="hotel-card">
        <div class="hc-top">
          <span class="hn">${esc(p.name)}</span>
          <span><span class="ha">${p.avg}</span> <span class="hu">· ${p.n}</span></span>
        </div>
        <div class="hbar"><i style="width:${p.avg}%;background:${scoreColor(p.avg)}"></i></div>
      </div>`
    )
    .join('');
  $('hotels').innerHTML = `<h2>Average HootScore by property</h2><div class="hotel-grid">${cards}</div>`;
}

function renderFooter() {
  const d = state.data;
  const when = new Date(d.generatedAt);
  $('updated').textContent = `Updated ${when.toLocaleString()}`;
  const lt = $('liveTime');
  if (lt) {
    lt.textContent = relTime(d.generatedAt);
    lt.title = when.toLocaleString();
  }
  const failed = (d.hotels || []).filter((h) => h.status !== 'ok');
  $('errors').textContent = failed.length
    ? `${failed.length} property(ies) failed to load: ${failed.map((h) => h.code).join(', ')}`
    : '';
}

function renderHead() {
  $('headRow').innerHTML = COLUMNS.map((c) => {
    const active = state.sortKey === c.key;
    const arrow = active ? (state.sortDir === 'asc' ? '▲' : '▼') : '';
    const sortAttr = active ? ` aria-sort="${state.sortDir === 'asc' ? 'ascending' : 'descending'}"` : '';
    return `<th class="${c.num ? 'num' : ''}" data-key="${c.key}"${sortAttr}>${esc(c.label)} <span class="arrow">${arrow}</span></th>`;
  }).join('');
  $('headRow').querySelectorAll('th').forEach((th) =>
    th.addEventListener('click', () => onSort(th.dataset.key))
  );
}

function onSort(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDir = key === 'rank' || key === 'name' || key === 'property' ? 'asc' : 'desc';
  }
  renderTable();
}

function compare(a, b) {
  const k = state.sortKey;
  let av = a[k];
  let bv = b[k];
  if (typeof av === 'string' || typeof bv === 'string') {
    av = (av ?? '').toString().toLowerCase();
    bv = (bv ?? '').toString().toLowerCase();
    return state.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  }
  av = av ?? -Infinity;
  bv = bv ?? -Infinity;
  return state.sortDir === 'asc' ? av - bv : bv - av;
}

function rankCell(u) {
  const medal = MEDALS[u.rank];
  return `<span class="rankwrap">${medal ? `<span class="medal">${medal}</span>` : `<span class="rk">${u.rank}</span>`}</span>`;
}

function scoreCell(v) {
  const color = scoreColor(v);
  return `<span class="scorebox"><b>${esc(v)}</b><span class="scorebar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span></span>`;
}

function renderTable() {
  renderHead();
  const rows = state.data.users
    .filter((u) => state.property === 'all' || u.property === state.property)
    .filter((u) => {
      if (!state.search) return true;
      return (
        u.name.toLowerCase().includes(state.search) ||
        u.property.toLowerCase().includes(state.search)
      );
    })
    .sort(compare);

  $('resultCount').textContent = `${rows.length} of ${state.data.userCount}`;

  $('rows').innerHTML = rows
    .map((u) => {
      const topCls = u.rank <= 3 ? ` class="top${u.rank}"` : '';
      return `<tr${topCls}>
        <td class="num rankcell">${rankCell(u)}</td>
        <td class="name">${esc(u.name)}</td>
        <td class="hotel">${esc(u.property)}</td>
        <td class="num score-cell">${scoreCell(u.hootScore)}</td>
        <td class="levelcell">${badge(u.hootRank)}</td>
      </tr>`;
    })
    .join('');
}

load();
