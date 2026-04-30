/**
 * Inline static assets for the bot tracker UI.
 *
 * Kept inline (rather than `public/`) to avoid introducing a new
 * filesystem-served directory in this single-binary scaffold. The HTML
 * embeds the JS + CSS via <script> / <style> blocks for a single
 * round-trip page load.
 *
 * No external CDN. No new runtime dependency. Pure DOM + Canvas2D.
 */

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Builder Guild · Bot Tracker</title>
<style>
:root {
  color-scheme: dark;
  --bg: #050505;
  --surface: #0d1117;
  --primary: #00d9ff;
  --healthy: #00ff88;
  --warning: #ffb800;
  --critical: #ff3366;
  --muted: #8b949e;
  --text: #e6edf3;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--text); }
body { display: grid; grid-template-rows: auto 1fr; grid-template-columns: 1fr 360px; grid-template-areas: "header header" "stage feed"; overflow: hidden; }
header { grid-area: header; border-bottom: 1px solid #1f242c; padding: 14px 22px; display: flex; align-items: center; gap: 18px; }
header h1 { margin: 0; font-size: 14px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--primary); }
header .meta { color: var(--muted); font-size: 12px; }
header .pill { background: var(--surface); border: 1px solid #1f242c; border-radius: 999px; padding: 4px 10px; font-size: 11px; }
header .pill.live { color: var(--healthy); border-color: rgba(0,255,136,0.3); }
header .pill.stale { color: var(--warning); border-color: rgba(255,184,0,0.3); }
main { grid-area: stage; position: relative; }
canvas { width: 100%; height: 100%; display: block; }
aside { grid-area: feed; background: var(--surface); border-left: 1px solid #1f242c; display: flex; flex-direction: column; min-height: 0; }
aside h2 { margin: 0; padding: 12px 16px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid #1f242c; }
.bots { padding: 8px 0; border-bottom: 1px solid #1f242c; max-height: 40%; overflow-y: auto; }
.bot { display: flex; align-items: center; gap: 10px; padding: 6px 16px; font-size: 12px; }
.bot .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.bot.active .dot { background: var(--healthy); box-shadow: 0 0 8px var(--healthy); }
.bot.idle   .dot { background: var(--muted); }
.bot.error  .dot { background: var(--critical); box-shadow: 0 0 8px var(--critical); }
.bot.offline .dot { background: #2a2f37; }
.bot .name { flex: 1; }
.bot .count { color: var(--muted); font-size: 10px; }
.events { flex: 1; overflow-y: auto; padding: 4px 0; min-height: 0; }
.event { padding: 6px 16px; border-bottom: 1px solid #11161d; font-size: 11px; line-height: 1.45; }
.event .ts { color: var(--muted); font-size: 10px; }
.event .row { display: flex; gap: 8px; align-items: baseline; }
.event .bot-name { color: var(--primary); font-weight: 600; }
.event .action { color: var(--text); }
.event .subject { color: var(--muted); font-size: 10px; word-break: break-all; }
.event.error .action { color: var(--critical); }
.legend { position: absolute; bottom: 14px; left: 14px; font-size: 10px; color: var(--muted); display: flex; gap: 14px; pointer-events: none; }
.legend .swatch { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.empty { padding: 14px 16px; color: var(--muted); font-size: 11px; }
</style>
</head>
<body>
<header>
  <h1>Builder Guild · Bot Tracker</h1>
  <span class="meta">subjects: <span id="subjects">…</span></span>
  <span class="pill" id="conn">connecting…</span>
  <span class="meta" style="margin-left:auto" id="counts">0 bots · 0 events</span>
</header>
<main>
  <canvas id="globe"></canvas>
  <div class="legend">
    <span><span class="swatch" style="background:var(--healthy)"></span>active</span>
    <span><span class="swatch" style="background:var(--warning)"></span>idle</span>
    <span><span class="swatch" style="background:var(--critical)"></span>error</span>
    <span><span class="swatch" style="background:#2a2f37"></span>offline</span>
  </div>
</main>
<aside>
  <h2>Bots</h2>
  <div class="bots" id="bots"><div class="empty">no bots yet</div></div>
  <h2>Live events</h2>
  <div class="events" id="events"><div class="empty">waiting for events…</div></div>
</aside>
<script>
%SCRIPT%
</script>
</body>
</html>`;

const SCRIPT = String.raw`(() => {
  const canvas = document.getElementById('globe');
  const ctx = canvas.getContext('2d');
  const botsEl = document.getElementById('bots');
  const eventsEl = document.getElementById('events');
  const connEl = document.getElementById('conn');
  const subjectsEl = document.getElementById('subjects');
  const countsEl = document.getElementById('counts');

  const state = {
    bots: new Map(),       // bot_id -> bot identity + status
    events: [],            // most recent first
    pulses: new Map(),     // bot_id -> { until_ms }
    rotation: 0,
  };
  const MAX_EVENTS_RENDERED = 80;

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function project(lat, lon, rotation, radius, cx, cy) {
    const phi = (lat * Math.PI) / 180;
    const lambda = ((lon + rotation) * Math.PI) / 180;
    const x = Math.cos(phi) * Math.sin(lambda);
    const y = -Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(lambda);
    return {
      x: cx + x * radius,
      y: cy + y * radius,
      visible: z >= 0,
      depth: z,
    };
  }

  function statusColor(status) {
    if (status === 'active') return '#00ff88';
    if (status === 'error') return '#ff3366';
    if (status === 'idle') return '#ffb800';
    return '#2a2f37';
  }

  function drawGlobe() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.40;

    // Outer glow
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.25);
    gradient.addColorStop(0, 'rgba(0,217,255,0.10)');
    gradient.addColorStop(1, 'rgba(0,217,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Sphere outline
    ctx.strokeStyle = 'rgba(0,217,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Latitude lines
    ctx.strokeStyle = 'rgba(0,217,255,0.15)';
    for (let lat = -60; lat <= 60; lat += 30) {
      const r = Math.cos((lat * Math.PI) / 180) * radius;
      const yOffset = -Math.sin((lat * Math.PI) / 180) * radius;
      ctx.beginPath();
      ctx.ellipse(cx, cy + yOffset, r, r * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Longitude lines
    for (let lon = 0; lon < 360; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -90; lat <= 90; lat += 4) {
        const p = project(lat, lon, state.rotation, radius, cx, cy);
        if (!p.visible) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else { ctx.lineTo(p.x, p.y); }
      }
      ctx.stroke();
    }

    // Bot dots
    const now = Date.now();
    const points = [];
    state.bots.forEach((bot) => {
      if (!bot.geo) return;
      const p = project(bot.geo.lat, bot.geo.lon, state.rotation, radius, cx, cy);
      if (!p.visible) return;
      points.push({ p, bot });
    });
    points.sort((a, b) => a.p.depth - b.p.depth);

    for (const { p, bot } of points) {
      const pulse = state.pulses.get(bot.id);
      if (pulse && pulse.until > now) {
        const t = 1 - (pulse.until - now) / pulse.duration;
        const r = 6 + t * 22;
        ctx.strokeStyle = 'rgba(0,217,255,' + (1 - t).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      const color = statusColor(bot.status);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = bot.status === 'active' ? 10 : 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(230,237,243,0.85)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(bot.name, p.x + 7, p.y + 3);
    }
  }

  function tick() {
    state.rotation = (state.rotation + 0.08) % 360;
    drawGlobe();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function renderBots() {
    const list = Array.from(state.bots.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (list.length === 0) {
      botsEl.innerHTML = '<div class="empty">no bots yet</div>';
    } else {
      botsEl.innerHTML = list
        .map((bot) =>
          '<div class="bot ' + bot.status + '">' +
            '<span class="dot"></span>' +
            '<span class="name">' + escapeHtml(bot.name) + '</span>' +
            '<span class="count">' + bot.event_count + '</span>' +
          '</div>',
        )
        .join('');
    }
    countsEl.textContent = list.length + ' bots · ' + state.events.length + ' events';
  }

  function renderEvents() {
    if (state.events.length === 0) {
      eventsEl.innerHTML = '<div class="empty">waiting for events…</div>';
      return;
    }
    eventsEl.innerHTML = state.events
      .slice(0, MAX_EVENTS_RENDERED)
      .map((event) => {
        const ts = new Date(event.timestamp).toLocaleTimeString();
        return (
          '<div class="event ' + event.status + '">' +
            '<div class="row">' +
              '<span class="bot-name">' + escapeHtml(event.bot_name) + '</span>' +
              '<span class="action">' + escapeHtml(event.action) + '</span>' +
              '<span class="ts" style="margin-left:auto">' + ts + '</span>' +
            '</div>' +
            '<div class="subject">' + escapeHtml(event.subject) + '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function applySnapshot(snapshot) {
    state.bots.clear();
    for (const bot of snapshot.bots) {
      state.bots.set(bot.id, bot);
    }
    state.events = snapshot.recent_events.slice().reverse();
    renderBots();
    renderEvents();
  }

  function applyEvent(event) {
    let bot = state.bots.get(event.bot_id);
    const next = {
      id: event.bot_id,
      name: event.bot_name,
      kind: event.bot_kind,
      geo: event.geo,
      status: event.status,
      last_seen: event.timestamp,
      event_count: bot ? bot.event_count + 1 : 1,
    };
    state.bots.set(event.bot_id, next);
    state.events.unshift(event);
    if (state.events.length > MAX_EVENTS_RENDERED) {
      state.events.length = MAX_EVENTS_RENDERED;
    }
    state.pulses.set(event.bot_id, { until: Date.now() + 1200, duration: 1200 });
    renderBots();
    renderEvents();
  }

  function connect() {
    const source = new EventSource('/bots/stream');
    connEl.textContent = 'connecting…';
    connEl.className = 'pill';

    source.addEventListener('open', () => {
      connEl.textContent = 'live';
      connEl.className = 'pill live';
    });
    source.addEventListener('snapshot', (msg) => {
      try { applySnapshot(JSON.parse(msg.data)); } catch (e) { console.error(e); }
    });
    source.addEventListener('event', (msg) => {
      try { applyEvent(JSON.parse(msg.data)); } catch (e) { console.error(e); }
    });
    source.addEventListener('error', () => {
      connEl.textContent = 'reconnecting…';
      connEl.className = 'pill stale';
    });
  }

  fetch('/bots/snapshot').then((r) => r.json()).then((snapshot) => {
    applySnapshot(snapshot);
    if (snapshot.subjects) subjectsEl.textContent = snapshot.subjects;
  }).catch(() => { subjectsEl.textContent = '(unknown)'; });

  connect();
})();`;

export function renderBotTrackerHtml(): string {
  return HTML.replace('%SCRIPT%', SCRIPT);
}
