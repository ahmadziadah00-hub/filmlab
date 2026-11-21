/* app.js — Film Lab v3.4 UI: batch import (remove with undo), film simulations with an Adaptive switch (per-photo
   exposure, white balance and shadows), themes of your own (Tokyo: each photo analysed and corrected toward a
   reference set), Basic corrections kept apart from the Fujifilm film settings, radial masks, per-photo tweaks,
   Instagram crops / frame / date stamp, split before-after, presets, Fujifilm + Kodak films, simulation icons, export. */
{
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- icons ---------- */
  const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    film: svg('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18M15 3v18M5 7.5h4M5 12h4M5 16.5h4M15 7.5h4M15 12h4M15 16.5h4"/>'),
    grain: svg('<circle cx="6" cy="7" r="1"/><circle cx="11.5" cy="5" r="1"/><circle cx="17.5" cy="8" r="1"/><circle cx="8.5" cy="12" r="1"/><circle cx="14.5" cy="13" r="1"/><circle cx="19" cy="16" r="1"/><circle cx="5.5" cy="17.5" r="1"/><circle cx="11.5" cy="19" r="1"/><circle cx="17" cy="20.5" r="1"/>'),
    frame: svg('<rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="7" y="7" width="10" height="8" rx=".5"/>'),
    reset: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4 4v4.5h4.5"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>'),
    paste: svg('<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>'),
    sun: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
    eraser: svg('<path d="M4 16l9-9 6 6-6 6H9z"/><path d="M13 19h7"/>'),
    roll: svg('<rect x="3" y="8" width="12" height="11" rx="1.6"/><path d="M15 10.5h4.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H15M6 8V5h6v3M7 12v3M11 12v3"/>'),
    stack: svg('<rect x="7" y="3" width="14" height="14" rx="2"/><path d="M3 7v11a3 3 0 0 0 3 3h11"/>'),
    one: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/>'),
    down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    up: svg('<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>'),
    x: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    eye: svg('<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.3-1"/>'),
    mask: svg('<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 2.2"/><circle cx="12" cy="12" r="4"/>'),
    chev: svg('<path d="M9 6l6 6-6 6"/>'),
  };

  /* ---------- settings spec, in four tabs ---------- */
  const OFFON = [[0, 'Off'], [1, 'On']];
  const MIX = [['Red', '#E5534B'], ['Orange', '#F08A3C'], ['Yellow', '#E3C344'], ['Green', '#5DBB63'], ['Aqua', '#4FC1C9'], ['Blue', '#4F7FE0'], ['Purple', '#8E6BD8'], ['Magenta', '#D35DB4']];
  const mixItems = [];
  MIX.forEach((m, i) => mixItems.push(
    { k: 'h' + i, t: 'sl', label: 'Hue', min: -100, max: 100, step: 1, def: 0, mix: i },
    { k: 's' + i, t: 'sl', label: 'Saturation', min: -100, max: 100, step: 1, def: 0, mix: i },
    { k: 'l' + i, t: 'sl', label: 'Luminance', min: -100, max: 100, step: 1, def: 0, mix: i }));
  const pm = (k, label, extra) => Object.assign({ k, t: 'sl', label, min: -100, max: 100, step: 1, def: 0 }, extra || {});
  const TABS = [
    { id: 'basic', label: 'Basic', icon: 'sliders', tip: 'Your own corrections — presets leave these alone',
      note: 'Your own corrections, applied on top of the film. Presets don\'t change them.', secs: [
      { sec: 'Light', items: [
        { k: 'ev', t: 'sl', label: 'Exposure', min: -3, max: 3, step: 0.05, def: 0, f: 'evd' },
        pm('contrast', 'Contrast'), pm('hl', 'Highlights'), pm('sh', 'Shadows'), pm('whites', 'Whites'), pm('blacks', 'Blacks')] },
      { sec: 'White balance', items: [pm('temp', 'Temp'), pm('tint', 'Tint')] },
      { sec: 'Presence', items: [pm('vib', 'Vibrance'), pm('sat', 'Saturation')] },
      { sec: 'Color mixer', mixer: true, items: mixItems },
    ] },
    { id: 'film', label: 'Film', icon: 'film', tip: 'Fujifilm camera settings for the film simulation', secs: [
      { sec: 'Dynamic range', items: [
        { k: 'dr', t: 'seg', label: 'Dynamic range', opts: [[0, 'Auto', 'DR100 or DR200 per photo, like the camera'], [100, 'DR100'], [200, 'DR200'], [400, 'DR400']], def: 0 },
        { k: 'hdr', t: 'sl', label: 'HDR highlights', min: 0, max: 100, step: 5, def: 100, f: 'pct', tip: 'Uses the HDR data the S24 stores in each photo to bring back highlight range that Samsung compressed' }] },
      { sec: 'Tone', items: [
        { k: 'highlight', t: 'sl', label: 'Highlight tone', min: -2, max: 4, step: 0.5, def: 0, f: 'half' },
        { k: 'shadow', t: 'sl', label: 'Shadow tone', min: -2, max: 4, step: 0.5, def: 0, f: 'half' }] },
      { sec: 'Color', items: [
        { k: 'color', t: 'sl', label: 'Color', min: -4, max: 4, step: 1, def: 0, c: 'color' },
        { k: 'cc', t: 'seg', label: 'Color Chrome Effect', opts: [[0, 'Off'], [1, 'Weak'], [2, 'Strong']], def: 0, c: 'color' },
        { k: 'ccb', t: 'seg', label: 'Color Chrome FX Blue', opts: [[0, 'Off'], [1, 'Weak'], [2, 'Strong']], def: 0, c: 'color' },
        { sub: 'White balance shift' },
        { k: 'wbR', t: 'sl', label: 'Red', min: -9, max: 9, step: 1, def: 0 },
        { k: 'wbB', t: 'sl', label: 'Blue', min: -9, max: 9, step: 1, def: 0 },
        { sub: 'Monochromatic color', c: 'mono' },
        { k: 'wc', t: 'sl', label: 'Warm · Cool', min: -18, max: 18, step: 1, def: 0, c: 'mono' },
        { k: 'mg', t: 'sl', label: 'Magenta · Green', min: -18, max: 18, step: 1, def: 0, c: 'mono' }] },
      { sec: 'Exposure & detail', items: [
        { k: 'ec', t: 'sl', label: 'Exposure comp.', min: -2, max: 2, step: 1 / 3, def: 0, f: 'ev', tip: 'The camera\'s exposure compensation — part of a film recipe' },
        { k: 'clarity', t: 'sl', label: 'Clarity', min: -5, max: 5, step: 1, def: 0 },
        { k: 'sharp', t: 'sl', label: 'Sharpness', min: -4, max: 4, step: 1, def: 0 }] },
    ] },
    { id: 'fx', label: 'Grain & FX', icon: 'grain', tip: 'Grain and film effects', secs: [
      { sec: 'Grain', items: [
        { k: 'grainP', t: 'preset', label: 'Fujifilm grain', opts: [['off', 'Off'], ['weak', 'Weak'], ['strong', 'Strong']] },
        { k: 'grainZ', t: 'preset', label: '', opts: [['small', 'Small'], ['large', 'Large']] },
        { k: 'grain', t: 'sl', label: 'Amount', min: 0, max: 100, step: 1, def: 0, f: 'n' },
        { k: 'grainSize', t: 'sl', label: 'Size', min: 0.5, max: 3, step: 0.1, def: 1, f: 'x' },
        { k: 'grainRough', t: 'sl', label: 'Roughness', min: 0, max: 100, step: 1, def: 50, f: 'n' },
        { k: 'grainColor', t: 'sl', label: 'Color grain', min: 0, max: 100, step: 1, def: 0, f: 'n' },
        { sub: 'Amount by tone' },
        { k: 'grainS', t: 'sl', label: 'Shadows', min: 0, max: 200, step: 5, def: 90, f: 'pct' },
        { k: 'grainM', t: 'sl', label: 'Midtones', min: 0, max: 200, step: 5, def: 100, f: 'pct' },
        { k: 'grainH', t: 'sl', label: 'Highlights', min: 0, max: 200, step: 5, def: 45, f: 'pct' }] },
      { sec: 'Film effects', items: [
        { k: 'hal', t: 'sl', label: 'Halation', min: 0, max: 100, step: 1, def: 0, f: 'n', tip: 'Red glow around bright highlights' },
        { k: 'bloom', t: 'sl', label: 'Glow', min: 0, max: 100, step: 1, def: 0, f: 'n', tip: 'Soft warm glow around lamps and bright lights, like a diffusion filter' },
        { k: 'leak', t: 'sl', label: 'Light leak', min: 0, max: 100, step: 1, def: 0, f: 'n' },
        { k: 'leakStyle', t: 'seg', label: '', opts: [[0, 'Left'], [1, 'Right'], [2, 'Top'], [3, 'Corner'], [4, 'Mixed', 'A different edge on each photo']], def: 4 },
        { k: 'expd', t: 'sl', label: 'Expired film', min: 0, max: 100, step: 1, def: 0, f: 'n', tip: 'Faded blacks, softer colour and a cast like old film stock' },
        { k: 'expTint', t: 'seg', label: '', opts: [[0, 'Warm'], [1, 'Magenta'], [2, 'Cyan']], def: 0 },
        { k: 'vig', t: 'sl', label: 'Vignette', min: -100, max: 100, step: 1, def: 0 }] },
    ] },
    { id: 'mask', label: 'Masks', icon: 'mask', tip: 'Radial masks — extra adjustments inside or around an area of this photo', secs: [] },
    { id: 'out', label: 'Frame & date', icon: 'frame', g: true, tip: 'Frame and date stamp for every photo', secs: [
      { sec: 'Frame', items: [
        { k: 'frameOn', t: 'seg', label: 'Frame', opts: OFFON, def: 0 },
        { k: 'frameTo', t: 'seg', label: 'Add to', opts: [['all', 'Instagram + Original'], ['ig', 'Instagram only']], def: 'all', on: 'frameOn' },
        { k: 'frameColor', t: 'color', label: 'Color', def: '#FFFFFF', swatches: ['#FFFFFF', '#F2ECE0', '#1A1A1A', '#7A7A76'], on: 'frameOn' },
        { k: 'frameSize', t: 'sl', label: 'Border', min: 0, max: 15, step: 0.5, def: 4, f: 'pctf', on: 'frameOn' },
        { k: 'frameBottom', t: 'sl', label: 'Extra bottom (instant film)', min: 0, max: 25, step: 0.5, def: 0, f: 'pctf', on: 'frameOn' },
        { k: 'fitMode', t: 'seg', label: 'Instagram crop', opts: [['fill', 'Fill (crop)'], ['fit', 'Fit whole photo']], def: 'fill' }] },
      { sec: 'Date stamp', items: [
        { k: 'stampOn', t: 'seg', label: 'Date stamp', opts: OFFON, def: 0 },
        { k: 'stampTo', t: 'seg', label: 'Add to', opts: [['all', 'Instagram + Original'], ['ig', 'Instagram only']], def: 'all', on: 'stampOn' },
        { k: 'stampFmt', t: 'sel', label: 'Format', opts: [['ymd', "'26 11 07"], ['mdy', "11 07 '26"], ['dmy', "07 11 '26"], ['ymd4', '2026 11 07'], ['dots', '07.11.2026']], def: 'ymd', on: 'stampOn' },
        { k: 'stampTime', t: 'seg', label: 'Show', opts: [[0, 'Date'], [1, 'Date + time']], def: 0, on: 'stampOn' },
        { k: 'stampPos', t: 'seg', label: 'Position', opts: [['tl', '↖', 'Top left'], ['tr', '↗', 'Top right'], ['bl', '↙', 'Bottom left'], ['br', '↘', 'Bottom right']], def: 'br', on: 'stampOn' },
        { k: 'stampColor', t: 'seg', label: 'Color', opts: [['orange', 'Orange'], ['red', 'Red'], ['yellow', 'Yellow'], ['white', 'White']], def: 'orange', on: 'stampOn' },
        { k: 'stampSize', t: 'sl', label: 'Size', min: 2, max: 6, step: 0.1, def: 3.2, f: 'pctf', on: 'stampOn' }] },
    ] },
  ];
  const SPECK = { sim: { k: 'sim', t: 'seg', def: 'provia', tab: 'film' }, adapt: { k: 'adapt', t: 'seg', def: 0, tab: 'sims', g: true } };
  TABS.forEach(T => T.secs.forEach(S => S.items.forEach(it => { if (it.k) { it.tab = T.id; it.secName = S.sec; if (T.g) it.g = true; SPECK[it.k] = it; } })));
  const DEF = {}; for (const k in SPECK) if (SPECK[k].def !== undefined) DEF[k] = SPECK[k].def;
  const tabKeys = id => Object.keys(DEF).filter(k => SPECK[k].tab === id);
  const BASIC_KEYS = tabKeys('basic'), OUT_KEYS = tabKeys('out');
  const LOOK_KEYS = Object.keys(DEF).filter(k => !BASIC_KEYS.includes(k) && !OUT_KEYS.includes(k));
  const FILM_KEYS = ['sim', 'dr', 'highlight', 'shadow', 'color', 'cc', 'ccb', 'wbR', 'wbB', 'ec', 'clarity', 'sharp', 'grain', 'grainSize', 'wc', 'mg'];
  const G = { ...DEF };

  /* Themes — your own looks beside Fujifilm's simulations, chosen in the same list. A theme is built on a Fujifilm
     LUT and carries its own film settings; your sliders stay yours and apply on top. Each photo is analysed once
     and corrected toward the theme's reference photos (see Match below). */
  const THEMES = {
    tokyo: { id: 'tokyo', label: 'Tokyo', sub: 'Your references', lut: 'classic-chrome', kind: 'theme',
      base: { dr: 200, highlight: -1, shadow: 1, cc: 1, ccb: 1, wbB: -3, sharp: -1, bloom: 30,
        grain: { grain: 55, grainSize: 1, grainRough: 50, grainColor: 0, grainS: 90, grainM: 100, grainH: 45 } } },
  };
  // a theme's own settings folded under the user's: offsets add, Auto range and empty grain/glow take the theme's
  function themed(s, th) {
    const b = th.base, o = { ...s, sim: th.lut };
    if (!s.dr) o.dr = b.dr;
    for (const k of ['highlight', 'shadow', 'color', 'wbR', 'wbB', 'sharp']) o[k] = s[k] + (b[k] || 0);
    o.cc = Math.max(s.cc, b.cc || 0); o.ccb = Math.max(s.ccb, b.ccb || 0);
    if (!(s.grain > 0) && b.grain) Object.assign(o, b.grain);
    if (!(s.bloom > 0) && b.bloom) o.bloom = b.bloom;
    return o;
  }
  // a film stock's own grain / halation / glow, used while your own effect is off
  function filmBase(s, b) {
    const o = { ...s };
    if (!(s.grain > 0) && b.grain) Object.assign(o, b.grain);
    if (!(s.hal > 0) && b.hal) o.hal = b.hal;
    if (!(s.bloom > 0) && b.bloom) o.bloom = b.bloom;
    return o;
  }
  const simReady = id => { const L = THEMES[id] ? THEMES[id].lut : id, S = SIMBY[L]; return !!lutReady[L] && (!S || !S.pack || !!packOk[L]); };
  const locked = id => { const L = THEMES[id] ? THEMES[id].lut : id, S = SIMBY[L]; return !!(S && S.pack && !Packs.has(S.pack)); };

  /* ---------- state ---------- */
  const photos = [];
  let cur = -1, anchor = -1, selSet = new Set(), scope = 'all', view = 'photo', ratio = '3x4', tab = 'basic', mixSel = 0;
  let compare = false, split = false, splitPos = 0.5, hoverSim = null, engine = null, exporting = false, cancelReq = false, clip = null;
  let SIMS = [], SIMBY = {}, IDX = null, curLayout = null;
  const lutReady = {}, packOk = {};
  const expSizes = new Set(['3x4']);
  const cv = $('#view'), ovl = $('#ovl');
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* unavailable */ } } };
  tab = store.get('filmlab.tab', 'basic');
  G.adapt = store.get('filmlab.adapt', 0) ? 1 : 0;

  const MQ = matchMedia('(max-width: 900px), (pointer: coarse) and (max-height: 520px)');   // phone layout (portrait or on its side)
  const capP = name => (async () => { try { return (window.claude && window.claude.use) ? await window.claude.use(name) : null; } catch (e) { return null; } })();
  const dlP = capP('downloads');
  const Account = (async () => {
    try {
      const [d, u] = await Promise.all([capP('db'), capP('user')]);
      if (!d || !u) return null;
      const id = await u.id(); return id ? { db: d, uid: id } : null;
    } catch (e) { return null; }
  })();

  /* ---------- helpers ---------- */
  let toastT = 0;
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600); }
  function toastAction(msg, label, fn, ms) {
    const t = $('#toast'), b = document.createElement('button');
    t.textContent = msg; b.className = 'tact'; b.textContent = label; b.onclick = () => { t.hidden = true; fn(); };
    t.append(b); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 6000);
  }
  function busy(msg) { const b = $('#busy'); b.hidden = !msg; if (msg) b.textContent = msg; }
  const tick = () => new Promise(r => setTimeout(r, 0));
  function debounce(fn, ms) { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function putPixels(c, px, w, h) { c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer), w || c.width, h || c.height), 0, 0); }
  const sign = v => v > 0 ? '+' : v < 0 ? '−' : '';
  function fmt(k, v) {
    const f = (SPECK[k] || {}).f;
    if (f === 'ev') {
      const t = Math.round(v * 3); if (!t) return '0 EV';
      const w = Math.trunc(t / 3), r = Math.abs(t % 3);
      return sign(t) + (w ? Math.abs(w) : '') + (r ? (w ? ' ' : '') + r + '/3' : '') + ' EV';
    }
    if (f === 'evd') return Math.abs(v) < 0.005 ? '0 EV' : sign(v) + Math.abs(v).toFixed(2) + ' EV';
    if (f === 'half') return sign(v) + (Math.abs(v) % 1 ? Math.abs(v).toFixed(1) : Math.abs(v));
    if (f === 'pct') return Math.round(v) + '%';
    if (f === 'pctf') return (+v).toFixed(1).replace(/\.0$/, '') + '%';
    if (f === 'x') return (+v).toFixed(1) + '×';
    if (f === 'n') return String(Math.round(v));
    return sign(Math.round(v)) + Math.abs(Math.round(v));
  }

  /* ---------- effective settings ---------- */
  function eff(ph) {
    const s = { ...G };
    if (ph && ph.adj) for (const k in ph.adj) {
      const it = SPECK[k]; if (!it || it.g) continue;
      s[k] = it.t === 'sl' ? clamp(G[k] + ph.adj[k], it.min, it.max) : ph.adj[k];
    }
    return s;
  }
  function params(s, ph) {
    const th = THEMES[s.sim];
    if (th) s = themed(s, th);
    const sim = SIMBY[s.sim] || SIMBY.provia || { id: 'provia', kind: 'color' };
    if (sim.base && !th) s = filmBase(s, sim.base);
    // a theme's per-photo correction toward its references, added under the user's own Basic values
    const mv = th && !s._nomatch && ph && ph.match ? ph.match[th.id] : null;
    const M = key => (mv && mv[key]) || 0;
    // Adaptive (Fujifilm simulations): exposure, white balance and shadow tone set for this photo
    const av = !th && s.adapt && !s._nomatch && ph && ph.auto ? ph.auto : null;
    const MKS = !s._nomatch && ph && ph.masks ? ph.masks.filter(m => m.on !== false).slice(0, MASK_MAX) : [];
    if (av) s = { ...s, ev: s.ev + (av.ev || 0), temp: s.temp + (av.temp || 0), tint: s.tint + (av.tint || 0), shadow: s.shadow + (av.shadow || 0) };
    const k = 0.0035, temp = s.temp + M('temp'), tint = s.tint + M('tint');
    let g = [2 ** (temp * k + s.wbR * 0.035), 2 ** (-tint * 0.003), 2 ** (-temp * k + s.wbB * 0.035)];
    const y = g[0] * 0.2627 + g[1] * 0.677998 + g[2] * 0.059302, e = 2 ** (s.ev + s.ec + M('ev'));
    g = g.map(x => x / y * e);
    const id = lutReady[sim.id] ? sim.id : 'provia';
    const dr = s.dr === 0 ? ((ph && ph.autoDR) || 100) : s.dr;
    let hsl = null;
    for (let i = 0; i < 8; i++) if (s['h' + i] || s['s' + i] || s['l' + i] || M('h' + i) || M('s' + i) || M('l' + i)) { hsl = [[], [], []]; break; }
    if (hsl) for (let i = 0; i < 8; i++) { hsl[0].push((s['h' + i] + M('h' + i)) / 100); hsl[1].push((s['s' + i] + M('s' + i)) / 100); hsl[2].push((s['l' + i] + M('l' + i)) / 100); }
    return {
      lut: id, isP3: ph ? ph.isP3 : true, mono: (SIMBY[id] || sim).kind === 'mono', gains: g, dr,
      shadow: s.shadow, highlight: s.highlight, colorScale: 1 + 0.07 * s.color, cc: s.cc, ccb: s.ccb, wc: s.wc, mg: s.mg,
      basic: [(s.contrast + M('contrast')) / 100, (s.hl + M('hl')) / 100, (s.sh + M('sh')) / 100, (s.whites + M('whites')) / 100, (s.blacks + M('blacks')) / 100, (s.vib + M('vib')) / 100, (s.sat + M('sat')) / 100, M('roll') / 100], hsl,
      clarity: s.clarity, sharp: s.sharp, grain: s.grain, grainSize: s.grainSize, grainRough: s.grainRough, grainColor: s.grainColor,
      grainS: s.grainS, grainM: s.grainM, grainH: s.grainH, hal: s.hal, bloom: s.bloom, vig: s.vig, leak: s.leak, leakStyle: s.leakStyle,
      expd: s.expd, expTint: s.expTint, hdr: (s.hdr || 0) / 100, gain: ph && ph.gain ? ph.gain : null,
      masks: MKS.length ? MKS.map(m => maskU(m, ph)) : null, maskAsp: MKS.length ? maskAsp(ph) : null
    };
  }
  const viewSettings = ph => { const s = eff(ph); if (hoverSim) s.sim = hoverSim; return s; };
  const frameS = () => ({ on: !!G.frameOn, size: G.frameSize, bottom: G.frameBottom });
  const frameOrig = () => !!G.frameOn && G.frameTo === 'all';
  const stampOrig = () => !!G.stampOn && G.stampTo === 'all';
  const stampS = () => ({ on: !!G.stampOn, fmt: G.stampFmt, time: !!G.stampTime, pos: G.stampPos, size: G.stampSize, color: G.stampColor });
  const fitOf = ph => ph.fit || G.fitMode;
  function cropFor(ph, rid) { const c = ph.crop && ph.crop[rid]; if (c) return c; if (ph.focus) return { x: ph.focus.x, y: ph.focus.y, z: 1 }; return null; }
  function setCrop(ph, rid, c, aspect) {
    const r = Compose.cropRect(ph.w, ph.h, aspect, c);
    const cc = { x: (r.x + r.w / 2) / ph.w, y: (r.y + r.h / 2) / ph.h, z: c.z || 1 };
    ph.crop = ph.crop || {}; ph.crop[rid] = cc; ph.focus = { x: cc.x, y: cc.y };
    markAdj(); Memory.save();
  }
  const isTweaked = ph => Object.keys(ph.adj).length > 0 || Object.keys(ph.crop || {}).length > 0 || !!ph.fit || !!(ph.masks && ph.masks.length);

  /* ---------- boot ---------- */
  async function boot() {
    try { engine = new Engine(cv); } catch (e) { $('#drop').innerHTML = `<div><h2>This browser can't run Film Lab</h2><p>${esc(e.message)}</p></div>`; return; }
    decorateTop(); buildPanel(); bindPanel(); setTab(tab); buildRatios(); buildExportSizes(); Mobile.apply(); syncUI(); Presets.init();
    try {
      const [idx, inp] = await Promise.all([fetch('luts/index.json').then(r => r.json()), fetch('luts/input_s24.json').then(r => r.json())]);
      IDX = idx; engine.setInputProfile(inp);
      SIMS = idx.sims; SIMS.forEach(s => { SIMBY[s.id] = s; });
      for (const t of Object.values(THEMES)) SIMBY[t.id] = t;
      await Packs.init();
      buildSimList(); syncUI(); Icons.init(); Memory.init(); startFilm();
      await loadLut('provia');
      const rest = SIMS.filter(s => s.id !== 'provia');
      for (let i = 0; i < rest.length; i += 4) await Promise.all(rest.slice(i, i + 4).map(s => loadLut(s.id)));
      countFilms();
    } catch (e) { console.error(e); toast('Could not load the film simulations: ' + e.message, 6000); }
  }
  function decorateTop() {
    const set = (sel, icon) => { const b = $(sel); if (b && !b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', icon); };
    set('#views button[data-v=photo]', IC.one);
    set('#views button[data-v=crop]', svg('<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>'));
    set('#views button[data-v=grid]', svg('<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>'));
  }
  async function fetchLut(file) {
    return decodeLut(await fetch(file).then(r => { if (!r.ok) throw new Error(file + ' ' + r.status); return r.json(); }));
  }
  async function decodeLut(j) {
    const bin = atob(j.data), z = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i);
    const d = new Uint16Array(await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    const n = j.n, out = new Uint16Array(d.length);
    for (let row = 0; row < n * n; row++) {
      let r = 0, g = 0, b = 0; const base = row * n * 3;
      for (let x = 0; x < n; x++) { const k = base + x * 3; r = (r + d[k]) & 0xFFFF; g = (g + d[k + 1]) & 0xFFFF; b = (b + d[k + 2]) & 0xFFFF; out[k] = r; out[k + 1] = g; out[k + 2] = b; }
    }
    return out;
  }
  async function loadLut(id) {
    const s = SIMBY[id]; let data, real = true;
    if (s.pack) {
      // Fujifilm's looks come from your own pack file in this browser; PROVIA's tone stands in for the analysis until then
      const rec = await Packs.get(id);
      if (rec) data = await decodeLut(rec);
      else if (id === 'provia') { data = await fetchLut('luts/base.json'); real = false; }
      else return;
    } else data = await fetchLut(s.file);
    engine.loadLut(id, data, IDX.size, IDX.domain, s.scene);
    lutReady[id] = true; if (s.pack && real) packOk[id] = true;
    countFilms(true);
    if (id === 'provia') { photos.forEach(computeAutoDR); scheduleStrip(); }
    if (id === 'provia' || Object.values(THEMES).some(t => t.lut === id)) Match.ensure();
    const cs = photos.length ? eff(photos[cur]).sim : '';
    if (photos.length && (id === cs || id === hoverSim || (THEMES[cs] && THEMES[cs].lut === id))) { renderMain(); scheduleStrip(); }
    scheduleThumbs();
  }

  function countFilms(loading) {
    const use = SIMS.filter(s => s.pack ? packOk[s.id] : lutReady[s.id]).length, all = SIMS.filter(s => !s.pack || Packs.has(s.pack)).length;
    $('#simcount').textContent = loading && use < all ? `loading ${use}/${all}` : String(use);
  }
  // without the Fujifilm pack, start on a Kodak film
  function startFilm() {
    if (Packs.has('fuji')) { SPECK.sim.def = DEF.sim = 'provia'; return; }
    SPECK.sim.def = DEF.sim = 'portra-400';
    if (locked(G.sim)) { G.sim = 'portra-400'; syncUI(); }
  }

  /* ---------- the Fujifilm pack: Fujifilm's film data isn't published with this site — you load your own copy once per browser ---------- */
  const Packs = (() => {
    let dbP = null; const have = {};
    const db = () => dbP || (dbP = new Promise(res => {
      try { const r = indexedDB.open('filmlab-packs', 1); r.onupgradeneeded = () => r.result.createObjectStore('luts'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); }
      catch (e) { res(null); }
    }));
    async function tx(mode, fn) {
      const d = await db(); if (!d) return null;
      return new Promise(res => { try { const t = d.transaction('luts', mode), q = fn(t.objectStore('luts')); t.oncomplete = () => res(q && 'result' in q ? q.result : true); t.onerror = t.onabort = () => res(null); } catch (e) { res(null); } });
    }
    async function init() {
      const keys = (await tx('readonly', st => st.getAllKeys())) || [];
      for (const s of SIMS) if (s.pack && keys.includes(s.id)) have[s.pack] = true;
    }
    const get = id => tx('readonly', st => st.get(id));
    async function load(j) {
      const ids = Object.keys((j && j.luts) || {}).filter(id => SIMBY[id] && SIMBY[id].pack === j.pack && j.luts[id] && j.luts[id].data);
      if (!ids.length) { toast('That pack doesn\'t match this version of Film Lab', 5000); return; }
      busy(`Adding ${ids.length} films`);
      const ok = await tx('readwrite', st => { for (const id of ids) st.put(j.luts[id], id); return null; });
      if (!ok) { busy(null); toast('This browser couldn\'t keep the pack — check that it allows site storage', 6000); return; }
      have[j.pack] = true;
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* optional */ }
      for (const id of ids) await loadLut(id);
      busy(null);
      if (j.pack === 'fuji') SPECK.sim.def = DEF.sim = 'provia';
      buildSimList(); countFilms(); syncUI(); scheduleThumbs(); Match.ensure(); renderMain(); scheduleStrip();
      toast(`Fujifilm films ready — ${ids.length} films, kept in this browser`, 5000);
    }
    return { init, get, load, has: p => !!have[p] };
  })();
  // one door for the files Film Lab makes: the Fujifilm pack, a session, presets
  async function openJsonFile(f) {
    let j = null;
    try { j = JSON.parse(await f.text()); } catch (e) { /* not JSON */ }
    if (j && j.kind === 'filmlab-pack') return Packs.load(j);
    if (j && j.kind === 'session') return Memory.importSession(f);
    if (j && (Array.isArray(j) || Array.isArray(j.presets))) return Presets.importFile(f);
    toast(`${f.name} isn't a Film Lab file`, 4500);
  }

  /* ---------- film simulation list ---------- */
  function buildSimList() {
    let html = '<div class="grp">Themes</div>', grp = '';
    for (const t of Object.values(THEMES)) html += locked(t.id)
      ? `<button class="sim locked" data-id="${t.id}" aria-pressed="false" title="Uses Classic Chrome — load your Fujifilm pack first"><canvas width="136" height="102"></canvas><span><div class="nm">${esc(t.label)}</div><div class="sb"><span>Needs the Fujifilm pack</span></div></span><img class="sbadge" alt="" hidden></button>`
      : `<button class="sim" data-id="${t.id}" aria-pressed="false"><canvas width="136" height="102"></canvas><span><div class="nm">${esc(t.label)}</div><div class="sb"><span>${esc(t.sub)}</span><span class="tag th" title="Analyses each photo and corrects it toward the reference photos">adaptive</span></div></span><img class="sbadge" alt="" hidden></button>`;
    for (const s of SIMS) {
      if (s.pack && !Packs.has(s.pack)) {
        if (grp !== 'pack-' + s.pack) {
          grp = 'pack-' + s.pack;
          html += `<div class="grp bgrp" data-brand="fuji">Fujifilm<small>${SIMS.filter(x => x.pack === s.pack).length} simulations · and the Tokyo theme</small></div>`
            + `<div class="packcard"><p>Fujifilm's film data isn't published with this site. Load your Fujifilm pack file once in this browser and it stays here, offline too.</p><button class="btn primary sm" data-pack>${IC.up}<span>Load Fujifilm pack</span></button></div>`;
        }
        continue;
      }
      const g = s.brand === 'kodak' ? 'kodak' : 'fuji-' + s.kind;
      if (g !== grp) {
        grp = g;
        html += g === 'kodak' ? `<div class="grp bgrp" data-brand="kodak">Kodak<small>Built from Kodak's published film data</small></div>`
          : `<div class="grp bgrp" data-brand="fuji">Fujifilm · ${s.kind === 'mono' ? 'Black &amp; white' : 'Color'}</div>`;
      }
      const tag = s.brand === 'kodak'
        ? (s.source === 'spektrafilm' ? '<span class="tag kd" title="Kodak\'s published film data (spektrafilm), printed and viewed like the real film">film data</span>' : '<span class="tag" title="Hand-built Tri-X tone and grain — not from film data">approx.</span>')
        : s.source === 'official' ? '<span class="tag lut" title="Fujifilm\'s official 3D LUT">Fuji LUT</span>'
        : s.source === 'hand-built' ? '<span class="tag" title="Not in Fujifilm\'s LUT pack — built from Fujifilm\'s description">approx.</span>'
        : '<span class="tag" title="Built from an official LUT">derived</span>';
      html += `<button class="sim" data-id="${s.id}" aria-pressed="false"><canvas width="136" height="102"></canvas><span><div class="nm">${esc(s.label)}</div><div class="sb">${s.sub ? `<span>${esc(s.sub)}</span>` : ''}${tag}</div></span><img class="sbadge" alt="" hidden></button>`;
    }
    html += `<div class="credit">Kodak looks derived from <a href="https://github.com/andreavolpato/spektrafilm" target="_blank" rel="noopener">spektrafilm</a> by Andrea Volpato · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a></div>`;
    html += `<button class="addicons" id="addIcons" hidden>${IC.up}<span>Add your simulation icons<small>ZIP, SVG or PNG named after each simulation</small></span></button>`;
    const box = $('#sims'); box.innerHTML = html;
    $('#addIcons').addEventListener('click', () => $('#iconsFile').click());
    $$('[data-pack]', box).forEach(b => b.addEventListener('click', () => $('#packFile').click()));
    $('#adaptT').onclick = () => {
      const v = G.adapt ? 0 : 1; set('adapt', v); store.set('filmlab.adapt', v);
      toast(v ? 'Adaptive on — each photo gets its own exposure, white balance and shadows' : 'Adaptive off — the simulations as they come', 3200);
      Match.ensure();
    };
    $$('.sim', box).forEach(b => {
      b.addEventListener('click', () => { if (b.classList.contains('locked')) { $('#packFile').click(); return; } hoverSim = null; set('sim', b.dataset.id); badge(); });
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && photos.length && simReady(b.dataset.id)) { hoverSim = b.dataset.id; if (THEMES[hoverSim]) Match.one(photos[cur], hoverSim); renderMain(); badge(); } });
      b.addEventListener('pointerleave', () => { if (hoverSim) { hoverSim = null; renderMain(); badge(); } });   // previews on hover: mouse only
    });
    $$('.sim img.sbadge', box).forEach(tuneIcon);
    refreshIcons();
  }

  /* ---------- adjustment panel ---------- */
  function itemHtml(it) {
    const cc = it.c ? ` data-c="${it.c}"` : '', tip = it.tip ? ` title="${esc(it.tip)}"` : '';
    const mix = it.mix != null ? ` data-mix="${it.mix}"${it.mix === mixSel ? '' : ' hidden'}` : '';
    if (it.sub) return `<div class="sub"${cc}>${it.sub}</div>`;
    if (it.t === 'sl') return `<div class="sl" data-k="${it.k}"${cc}${tip}${mix}><label>${it.label}</label><output></output><input type="range" min="${it.min}" max="${it.max}" step="${it.step}" aria-label="${esc(it.label)}"></div>`;
    if (it.t === 'seg' || it.t === 'preset') return `<div class="row" data-k="${it.k}"${cc}${tip}>${it.label ? `<span>${it.label}</span>` : ''}<div class="seg">${it.opts.map(o => `<button data-v="${o[0]}"${o[2] ? ` title="${esc(o[2])}"` : ''}>${o[1]}</button>`).join('')}</div></div>`;
    if (it.t === 'sel') return `<div class="row" data-k="${it.k}"><span>${it.label}</span><select aria-label="${esc(it.label)}">${it.opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select></div>`;
    if (it.t === 'color') return `<div class="row" data-k="${it.k}"><span>${it.label}</span><div class="sw">${it.swatches.map(c => `<button data-v="${c}" style="background:${c}" title="${c}" aria-label="Frame color ${c}"></button>`).join('')}<input type="color" title="Custom color" aria-label="Custom frame color"></div></div>`;
    return '';
  }
  function buildPanel() {
    $('#tabs').innerHTML = TABS.map(T => `<button role="tab" data-t="${T.id}" title="${esc(T.tip)}">${IC[T.icon]}<span>${T.label}</span><i class="tdot"></i></button>`).join('');
    let h = '';
    for (const T of TABS) {
      h += `<div class="tabp" data-tab="${T.id}" role="tabpanel" hidden>`;
      if (T.id === 'film') h += `<div class="simhead"><div><small>Film simulation<span class="desk-only"> · choose on the left</span><span class="mob-only"> · choose in Films</span></small><b id="simName">PROVIA</b><img id="simWord" alt="" hidden></div><span id="simTag"></span></div>`;
      if (T.note) h += `<div class="tnote">${T.note}</div>`;
      if (T.id === 'fx') h += `<div class="tnote th" id="themeNote" hidden></div>`;
      if (T.id === 'mask') h += `<div id="maskPanel"></div>`;
      for (const S of T.secs) {
        h += `<details open data-sec="${esc(S.sec)}"><summary>${IC.chev}<span>${S.sec}</span><button class="sreset" title="Reset ${esc(S.sec)}" aria-label="Reset ${esc(S.sec)}">${IC.reset}</button></summary><div class="body">`;
        if (S.mixer) h += `<div class="mdots">${MIX.map((m, i) => `<button data-m="${i}" title="${m[0]}" aria-label="${m[0]}" style="--c:${m[1]}"></button>`).join('')}</div><div class="mname" id="mname">${MIX[mixSel][0]}</div>`;
        for (const it of S.items) h += itemHtml(it);
        h += '</div></details>';
      }
      h += '</div>';
    }
    $('#adj').innerHTML = h;
    if ($('#simWord')) tuneIcon($('#simWord'));
  }
  const segVal = (it, raw) => typeof it.opts[0][0] === 'number' ? +raw : raw;
  function bindPanel() {
    $$('#tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.t)));
    $$('#adj .sl[data-k]').forEach(el => {
      const k = el.dataset.k, inp = el.querySelector('input');
      inp.addEventListener('input', () => set(k, +inp.value));
      const reset = () => resetKeys([k]);
      el.querySelector('label').addEventListener('dblclick', reset);
      inp.addEventListener('dblclick', reset);
    });
    $$('#adj .row').forEach(el => {
      const k = el.dataset.k, it = SPECK[k];
      if (it && it.t === 'seg') el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => set(k, segVal(it, b.dataset.v))));
      else if (k === 'grainP') el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => set('grain', { off: 0, weak: 40, strong: 70 }[b.dataset.v])));
      else if (k === 'grainZ') el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => set('grainSize', b.dataset.v === 'large' ? 1.8 : 1.0)));
      else if (it && it.t === 'sel') el.querySelector('select').addEventListener('change', e => set(k, e.target.value));
      else if (it && it.t === 'color') {
        el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => set(k, b.dataset.v)));
        el.querySelector('input').addEventListener('input', e => set(k, e.target.value.toUpperCase()));
      }
    });
    $$('#adj details').forEach(d => {
      const S = TABS.flatMap(T => T.secs).find(x => x.sec === d.dataset.sec);
      d.querySelector('.sreset').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); resetKeys(S.items.filter(it => it.k && SPECK[it.k].def !== undefined).map(it => it.k)); toast(`${S.sec} reset`); });
    });
    $$('#adj .mdots button').forEach(b => b.addEventListener('click', () => {
      mixSel = +b.dataset.m;
      $$('#adj [data-mix]').forEach(el => { el.hidden = +el.dataset.mix !== mixSel; });
      $('#mname').textContent = MIX[mixSel][0]; syncUI();
    }));
    $$('#scope button').forEach(b => b.addEventListener('click', () => setScope(b.dataset.v)));
  }
  function setTab(id) {
    if (!TABS.some(T => T.id === id)) id = 'basic';
    tab = id; store.set('filmlab.tab', id);
    if (id === 'mask' && view === 'grid' && photos.length) setView('photo');
    cw0.classList.toggle('masking', id === 'mask'); renderMaskPanel(); renderMain();
    $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === id)));
    $$('#adj .tabp').forEach(p => { p.hidden = p.dataset.tab !== id; });
    if (typeof Mobile !== 'undefined') Mobile.sync();
    $('#adj').scrollTop = 0;
  }
  const shown = k => (scope === 'sel' && !SPECK[k].g && photos[cur]) ? eff(photos[cur])[k] : G[k];

  function set(k, v) {
    const it = SPECK[k];
    if (it.g || scope === 'all' || !photos.length) {
      G[k] = v;
      if (it.on && !G[it.on]) { G[it.on] = 1; toast(it.on === 'frameOn' ? 'Frame turned on' : 'Date stamp turned on'); }
    } else {
      if (it.t === 'sl') {
        const d = v - eff(photos[cur])[k];
        for (const i of selSet) {
          const ph = photos[i], a = clamp(eff(ph)[k] + d, it.min, it.max) - G[k];
          if (Math.abs(a) < 1e-9) delete ph.adj[k]; else ph.adj[k] = a;
        }
      } else for (const i of selSet) { const ph = photos[i]; if (v === G[k]) delete ph.adj[k]; else ph.adj[k] = v; }
      markAdj();
    }
    if (k === 'hdr') scheduleAutoDR();
    changed(!!it.g);
    if (k === 'sim') Match.ensure();
  }
  function resetKeys(keys) {
    let out = false;
    for (const k of keys) {
      const it = SPECK[k]; if (!it) continue;
      if (it.g || scope === 'all' || !photos.length) { G[k] = DEF[k]; out = out || !!it.g; }
      else for (const i of selSet) delete photos[i].adj[k];
    }
    markAdj(); if (keys.includes('hdr')) scheduleAutoDR();
    changed(out && keys.every(k => SPECK[k] && SPECK[k].g));
  }
  function changed(outputOnly) {
    syncUI(); renderMain(); Memory.save();
    if (!outputOnly) { scheduleThumbs(); scheduleStrip(); scheduleHist(); }
    if (view === 'grid') scheduleGrid();
  }
  function syncUI() {
    const ph = photos[cur], psel = scope === 'sel' && ph;
    $$('#adj .sl[data-k]').forEach(el => {
      const k = el.dataset.k, inp = el.querySelector('input'), out = el.querySelector('output'), v = shown(k);
      if (Math.abs(+inp.value - v) > 1e-6) inp.value = v;
      out.textContent = fmt(k, v);
      const mn = +inp.min, mx = +inp.max;
      inp.style.setProperty('--p', ((v - mn) / (mx - mn) * 100) + '%');
      inp.style.setProperty('--z', ((clamp(0, mn, mx) - mn) / (mx - mn) * 100) + '%');
      inp.classList.toggle('neg', v < 0);
      el.classList.toggle('mod', !!(psel && !SPECK[k].g && ph.adj[k] !== undefined));
      const on = SPECK[k].on; el.classList.toggle('dim', !!(on && !G[on]));
    });
    $$('#adj .row').forEach(el => {
      const k = el.dataset.k, it = SPECK[k];
      if (k === 'grainP') { const g = shown('grain'); el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String({ off: 0, weak: 40, strong: 70 }[b.dataset.v] === g))); return; }
      if (k === 'grainZ') { const z = shown('grainSize'); el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Math.abs((b.dataset.v === 'large' ? 1.8 : 1.0) - z) < 1e-6))); return; }
      if (!it) return;
      const v = shown(k);
      if (it.t === 'seg') el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(segVal(it, b.dataset.v) === v)));
      else if (it.t === 'sel') el.querySelector('select').value = v;
      else if (it.t === 'color') { el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v.toUpperCase() === String(v).toUpperCase()))); el.querySelector('input').value = v.toLowerCase(); }
      el.classList.toggle('mod', !!(psel && !it.g && ph.adj[k] !== undefined));
      el.classList.toggle('dim', !!(it.on && !G[it.on]));
    });
    const simId = shown('sim'), mono = (SIMBY[simId] || {}).kind === 'mono';
    $$('#adj [data-c=color]').forEach(e => e.classList.toggle('off', mono));
    $$('#adj [data-c=mono]').forEach(e => e.classList.toggle('off', !mono));
    $$('.sim').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === simId)));
    const s = SIMBY[simId];
    const thH = ph && THEMES[eff(ph).sim];
    const drTxt = ph && eff(ph).dr === 0 ? (thH ? ` · DR${thH.base.dr}` : ` · auto DR${ph.autoDR || 100}`) : '';
    const hs = ph ? SIMBY[eff(ph).sim] : s;      // the histogram describes the photo on screen
    const adTxt = ph && eff(ph).adapt && !thH ? ' · adaptive' : '';
    $('#hsim').innerHTML = `<b>${hs ? esc(hs.label) : ''}</b>${drTxt}${adTxt}`;
    $('#adaptT') && $('#adaptT').setAttribute('aria-checked', String(!!G.adapt));
    if ($('#simName')) {
      $('#simName').textContent = s ? s.label : '';
      $('#simTag').innerHTML = !s ? '' : s.kind === 'theme' ? `<span class="tag th" title="Built on ${esc((SIMBY[s.lut] || {}).label || s.lut)}; each photo is analysed and corrected toward the theme's references">theme · adaptive</span>` : s.sub ? `<span class="tag">${esc(s.sub)}</span>` : '';
      const wu = s && typeof Icons !== 'undefined' ? Icons.url('word', s.id) : null, wi = $('#simWord');
      if (wu) { if (wi.getAttribute('src') !== wu) wi.src = wu; wi.alt = s.label; wi.hidden = false; $('#simName').hidden = true; } else { wi.hidden = true; $('#simName').hidden = false; }
    }
    // colour mixer dots show which colours carry changes
    $$('#adj .mdots button').forEach(b => { const i = +b.dataset.m; b.classList.toggle('on', i === mixSel); b.classList.toggle('chg', !!(shown('h' + i) || shown('s' + i) || shown('l' + i))); });
    // tab dots: anything changed in that tab
    $$('#tabs button, #mtabs button[data-t]').forEach(b => {
      if (b.dataset.t === 'films') { b.classList.toggle('chg', shown('sim') !== DEF.sim || !!G.adapt); return; }
      const keys = tabKeys(b.dataset.t), extra = (b.dataset.t === 'film' && shown('sim') !== DEF.sim) || (b.dataset.t === 'mask' && !!(ph && ph.masks && ph.masks.length));
      b.classList.toggle('chg', extra || keys.some(k => k !== 'hdr' && k !== 'fitMode' && k !== 'leakStyle' && k !== 'expTint' && k !== 'frameTo' && k !== 'stampTo' && shown(k) !== DEF[k] && !(SPECK[k].on && !G[SPECK[k].on])));
    });
    // a theme brings its own grain and glow while yours are off
    const tn = $('#themeNote'), thS = THEMES[shown('sim')] || (SIMBY[shown('sim')] && SIMBY[shown('sim')].base ? SIMBY[shown('sim')] : null);
    if (tn) {
      const bb = thS ? thS.base : null;
      const bits = bb ? [!(shown('grain') > 0) && bb.grain ? (THEMES[thS.id] ? 'fine grain' : 'its film grain') : '', !(shown('hal') > 0) && bb.hal ? 'halation' : '', !(shown('bloom') > 0) && bb.bloom ? 'a soft glow' : ''].filter(Boolean) : [];
      const own = [bb && bb.grain ? 'Grain' : '', bb && bb.hal ? 'Halation' : '', bb && bb.bloom ? 'Glow' : ''].filter(Boolean);
      tn.hidden = !bits.length; tn.textContent = bits.length ? `${thS.label} adds ${bits.join(' and ')}. Set ${own.join(' or ')} above zero to use yours instead.` : '';
    }
    const n = selSet.size;
    $('#scopeSel').innerHTML = `${IC.one}<span>${n > 1 ? `Selected (${n})` : 'This photo'}</span>`;
    $$('#scope button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === scope)); b.disabled = b.dataset.v === 'sel' && !photos.length; });
    $('#right').classList.toggle('sel', scope === 'sel');
    $('#scopeNote').textContent = scope === 'all' ? 'Changes apply to every photo. Per-photo tweaks stay on top.'
      : n > 1 ? `Changes nudge the ${n} selected photos together.` : `Changes apply only to photo ${cur + 1}.`;
    buildFoot();
    badge();
  }
  function buildFoot() {
    const f = $('#foot');
    const want = scope === 'all' ? 'all' : 'sel:' + (clip ? 1 : 0);
    if (f.dataset.mode === want) return;
    f.dataset.mode = want;
    if (scope === 'all') {
      f.innerHTML = `<button class="btn" id="fReset" title="Back to defaults for every tab except Frame & date (film simulation kept)">${IC.reset}<span>Reset all</span></button><button class="btn" id="fClear" title="Remove every per-photo tweak and crop">${IC.eraser}<span>Clear tweaks</span></button>`;
      $('#fReset').onclick = () => { for (const k of [...BASIC_KEYS, ...LOOK_KEYS]) if (k !== 'sim' && k !== 'adapt') G[k] = DEF[k]; scheduleAutoDR(); changed(false); toast('Settings reset (film simulation, frame and date kept)'); };
      const fc = $('#fClear'); let armed = 0;
      fc.onclick = () => {
        if (!armed) { armed = setTimeout(() => { armed = 0; fc.querySelector('span').textContent = 'Clear tweaks'; }, 2500); fc.querySelector('span').textContent = 'Click again'; return; }
        clearTimeout(armed); armed = 0; fc.querySelector('span').textContent = 'Clear tweaks';
        photos.forEach(p => { p.adj = {}; p.crop = {}; p.focus = null; p.fit = undefined; }); markAdj(); changed(false); toast('All per-photo tweaks cleared');
      };
    } else {
      f.innerHTML = `<button class="btn" id="fRst" title="Back to the batch settings">${IC.reset}<span>Reset photo</span></button><button class="btn" id="fMatch" title="Match the brightness of the selected photos to the current one">${IC.sun}<span>Match light</span></button><button class="btn" id="fCopy" title="Copy this photo's tweaks (Ctrl+C)">${IC.copy}<span>Copy</span></button><button class="btn" id="fPaste" title="Paste tweaks onto the selected photos (Ctrl+V)"${clip ? '' : ' disabled'}>${IC.paste}<span>Paste</span></button>`;
      $('#fRst').onclick = () => { for (const i of selSet) photos[i].adj = {}; markAdj(); scheduleAutoDR(); changed(false); toast(selSet.size > 1 ? 'Tweaks removed from the selected photos' : 'Photo back to the batch settings'); };
      $('#fCopy').onclick = copyAdj; $('#fPaste').onclick = pasteAdj; $('#fMatch').onclick = matchBrightness;
    }
  }
  function setScope(s) { if (s === 'sel' && !photos.length) return; scope = s; syncUI(); }
  function copyAdj() { const ph = photos[cur]; if (!ph) return; clip = { ...ph.adj }; $('#foot').dataset.mode = ''; syncUI(); const n = Object.keys(clip).length; toast(n ? `Copied ${n} tweak${n === 1 ? '' : 's'} from photo ${cur + 1}` : `Photo ${cur + 1} has no tweaks — copied the plain batch settings`); }
  function pasteAdj() { if (!clip) return; for (const i of selSet) photos[i].adj = { ...clip }; markAdj(); scheduleAutoDR(); changed(false); toast(`Pasted onto ${selSet.size} photo${selSet.size === 1 ? '' : 's'}`); }
  function meanLin(ph) {
    const w = 96, h = Math.max(8, Math.round(96 * ph.h / ph.w));
    const px = engine.quick(ph.thumb, params(eff(ph), ph), w, h);
    let s = 0; const L = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    for (let i = 0; i < px.length; i += 4) s += 0.2126 * L(px[i]) + 0.7152 * L(px[i + 1]) + 0.0722 * L(px[i + 2]);
    return s / (px.length / 4);
  }
  function matchBrightness() {
    if (selSet.size < 2) { toast('Ctrl-click the photos to match, then press Match light'); return; }
    const ref = meanLin(photos[cur]); let n = 0;
    for (const i of selSet) {
      if (i === cur) continue;
      const ph = photos[i], m = meanLin(ph);
      const d = clamp(Math.log2(ref / Math.max(m, 1e-5)) * 0.85, -1.5, 1.5);
      const a = clamp(eff(ph).ev + d, -3, 3) - G.ev;
      if (Math.abs(a) < 0.02) delete ph.adj.ev; else ph.adj.ev = Math.round(a * 20) / 20;
      n++;
    }
    markAdj(); changed(false); toast(`Matched ${n} photo${n === 1 ? '' : 's'} to photo ${cur + 1}`);
  }

  /* ---------- HDR gain map + auto DR ---------- */
  async function loadGainMap(f, ph) {
    const rg = IO.gainMapRange(ph.info, f.size); if (!rg) return;
    const buf = await f.slice(rg.start, rg.end).arrayBuffer();
    const gp = IO.gainMapParams(buf); if (!gp || gp.baseHDR) return;
    const blob = new Blob([buf], { type: 'image/jpeg' });
    const probe = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const gw = probe.width, gh = probe.height; probe.close();
    const s = Math.min(1, 512 / Math.max(gw, gh));
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none', resizeWidth: Math.max(1, Math.round(gw * s)), resizeHeight: Math.max(1, Math.round(gh * s)), resizeQuality: 'medium' });
    const oc = new OffscreenCanvas(bmp.width, bmp.height), x = oc.getContext('2d', { willReadFrequently: true });
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, bmp.width, bmp.height).data, hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
    let acc = 0, p5 = 0; const tgt = d.length / 4 * 0.05;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= tgt) { p5 = i; break; } }
    const base = gp.min + (gp.max - gp.min) * Math.pow(p5 / 255, 1 / gp.gamma);
    ph.gain = { tex: engine.texFromBitmap(bmp, false), min: gp.min, max: gp.max, gamma: gp.gamma, base, orient: ph.info.orientation || 1 };
    bmp.close();
  }
  function computeAutoDR(ph) {
    if (!ph || !ph.thumb) return;
    if (!ph.gain || !lutReady.provia) { ph.autoDR = 100; return; }
    const w = 128, h = Math.max(8, Math.round(128 * ph.h / ph.w));
    const P1 = params({ ...eff(ph), sim: 'provia', dr: 100, _nomatch: 1 }, ph);
    P1.basic = null; P1.hsl = null;
    const clipF = px => { let n = 0; for (let i = 0; i < px.length; i += 4) if (Math.max(px[i], px[i + 1], px[i + 2]) > 251) n++; return n / (px.length / 4); };
    const a = clipF(engine.quick(ph.thumb, { ...P1, hdr: 0 }, w, h)), b = clipF(engine.quick(ph.thumb, P1, w, h));
    ph.autoDR = b - a > 0.004 ? 200 : 100;
  }
  const scheduleAutoDR = debounce(() => { photos.forEach(computeAutoDR); syncUI(); renderMain(); scheduleStrip(); scheduleThumbs(); }, 250);

  /* ---------- import ---------- */
  async function decode(file, ph, longEdge) {
    const o = { imageOrientation: 'from-image', colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
    if (longEdge && ph.w && ph.h) {
      const s = Math.min(1, longEdge / Math.max(ph.w, ph.h));
      if (s < 1) { o.resizeWidth = Math.max(1, Math.round(ph.w * s)); o.resizeHeight = Math.max(1, Math.round(ph.h * s)); o.resizeQuality = 'high'; }
    }
    const bmp = await createImageBitmap(file, o);
    if (!ph.w) { ph.w = bmp.width; ph.h = bmp.height; }
    return bmp;
  }
  let importing = Promise.resolve();
  function addFiles(list) { const files = [...list]; importing = importing.then(() => routeFiles(files)); return importing; }
  async function routeFiles(files) {
    const pics = [], icons = []; let jsons = 0;
    for (const f of files) {
      if (/\.zip$/i.test(f.name) || /zip/.test(f.type)) {
        let ents;
        try { busy('Opening ' + f.name); ents = await IO.readZip(await f.arrayBuffer(), 1500 * 1024 * 1024); }
        catch (e) { busy(null); toast(`Couldn't open ${f.name}: ${e.message}`, 5000); continue; }
        busy(null);
        for (const e of ents) {
          const nm = e.name.split('/').pop();
          if (/\.jpe?g$/i.test(nm) && !Icons.isIcon(e.name)) pics.push(new File([e.data], nm, { type: 'image/jpeg', lastModified: f.lastModified }));
          else if (/\.(svg|png|webp|jpe?g)$/i.test(nm)) icons.push({ path: e.name, data: e.data });
        }
      } else if (/\.(svg|png|webp)$/i.test(f.name) || /^image\/(svg|png|webp)/.test(f.type)) icons.push({ path: f.name, data: new Uint8Array(await f.arrayBuffer()) });
      else if (/\.json$/i.test(f.name) || f.type === 'application/json') { await openJsonFile(f); jsons++; }
      else pics.push(f);
    }
    if (icons.length) await Icons.loadItems(icons, pics.length > 0);
    if (pics.length) await importFiles(pics);
    else if (!icons.length && !jsons) toast('Film Lab reads JPEG photos — and ZIP, SVG or PNG files for your simulation icons.', 4500);
  }
  async function importFiles(list) {
    if (!engine) return;
    const files = list.filter(f => /\.jpe?g$/i.test(f.name) || f.type === 'image/jpeg');
    if (!files.length) { toast('Film Lab reads JPEG photos.'); return; }
    let n = 0, hdr = 0, skipped = 0; const added = [];
    for (const f of files) {
      const key = f.name + '|' + f.size + '|' + f.lastModified;
      if (photos.some(p => p.key === key)) { skipped++; continue; }
      busy(`Importing ${++n} of ${files.length}`);
      try {
        let info = IO.parseJpeg(await f.slice(0, 512 * 1024).arrayBuffer());
        if (!info.width) info = IO.parseJpeg(await f.arrayBuffer());
        const sz = IO.orientedSize(info);
        const ph = { key, file: f, name: f.name, info, w: sz.w, h: sz.h, isP3: info.icc ? info.isP3 : false, date: IO.captureDate(info, f.name), adj: {}, crop: {}, focus: null, fit: undefined, pending: true };   // pending: its saved edits haven't been read yet
        const bmp = await decode(f, ph, 360);
        ph.thumb = engine.texFromBitmap(bmp, false); bmp.close();
        try { await loadGainMap(f, ph); if (ph.gain) hdr++; } catch (e) { console.warn('gain map', f.name, e); }
        computeAutoDR(ph);
        photos.push(ph); addFilmItem(ph); added.push(ph);
        if (cur < 0) select(0);
      } catch (e) { console.error(e); toast(`Couldn't read ${f.name}`); }
      await tick();
    }
    const back = added.length ? await Memory.restore(added) : 0;
    busy(null); markAdj(); updateChrome(); scheduleStrip(); scheduleThumbs(); syncUI(); renderMain();
    if (view === 'grid') buildGrid();
    if (tab === 'mask') renderMaskPanel();
    Memory.save(true); Memory.keep(added); Match.ensure(); $('#resume') && ($('#resume').hidden = true);
    const bits = [`${photos.length} photo${photos.length === 1 ? '' : 's'} ready`];
    if (back) bits.push(`edits restored for ${back}`);
    if (hdr) bits.push(`HDR data in ${hdr}`);
    if (skipped) bits.push(`${skipped} already in the batch, skipped`);
    toast(bits.join(' · '), skipped ? 4000 : 2600);
  }
  async function ensurePreview(i) {
    const ph = photos[i]; if (!ph) return null;
    if (!ph.prevP) ph.prevP = (async () => {
      const bmp = await decode(ph.file, ph, Math.min(2560, engine.maxTex));
      ph.prev = engine.texFromBitmap(bmp, true); bmp.close();
      photos.forEach((p, j) => { if (p.prev && Math.abs(j - cur) > 1) { engine.deleteTex(p.prev); p.prev = null; p.prevP = null; } });
      return ph.prev;
    })();
    return ph.prevP;
  }

  /* ---------- selection, filmstrip, chrome ---------- */
  function addFilmItem(ph) {
    const wrap = document.createElement('div'), b = document.createElement('button'), x = document.createElement('button');
    wrap.className = 'fsw'; b.className = 'fs'; b.title = ph.name;
    const h = 176, w = Math.max(40, Math.round(h * ph.w / ph.h)), i = photos.indexOf(ph);
    b.innerHTML = `<canvas width="${w}" height="${h}" style="width:${w / 2}px"></canvas><span>${i + 1}</span><i></i>`;
    b.addEventListener('click', e => pick(photos.indexOf(ph), e));
    x.className = 'rm'; x.title = 'Remove from the batch'; x.setAttribute('aria-label', 'Remove ' + ph.name); x.innerHTML = IC.x;
    x.addEventListener('click', e => { e.stopPropagation(); removePhoto(ph); });
    wrap.append(b, x);
    const next = photos[i + 1] && photos[i + 1].fs ? photos[i + 1].fs.parentElement : null;
    $('#strip').insertBefore(wrap, next); ph.fs = b;
  }
  function renumber() { photos.forEach((p, j) => { const sp = p.fs && p.fs.querySelector('span'); if (sp) sp.textContent = j + 1; }); }
  // remove a photo from the batch; the last removal can be undone for a few seconds
  let removed = null, removedT = 0;
  function dropTextures(ph) {
    for (const k of ['thumb', 'prev']) if (ph[k]) { engine.deleteTex(ph[k]); ph[k] = null; }
    if (ph.gain && ph.gain.tex) { engine.deleteTex(ph.gain.tex); ph.gain = null; }
    ph.prevP = null;
  }
  function removePhoto(ph) {
    const i = photos.indexOf(ph); if (i < 0) return;
    if (removed) dropTextures(removed.ph);
    removed = { ph, i }; clearTimeout(removedT);
    removedT = setTimeout(() => { if (removed && removed.ph === ph) { dropTextures(ph); Memory.forget(ph); removed = null; } }, 7000);
    photos.splice(i, 1);
    if (ph.fs) ph.fs.parentElement.remove();
    selSet = new Set([...selSet].filter(j => j !== i).map(j => (j > i ? j - 1 : j)));
    anchor = anchor === i ? -1 : anchor > i ? anchor - 1 : anchor;
    const next = cur > i ? cur - 1 : cur === i ? Math.min(i, photos.length - 1) : cur;
    renumber(); cur = -1; hoverSim = null;
    if (photos.length) select(next, selSet.size > 0);
    else { selSet = new Set(); anchor = -1; const c = $('#hist'); c.getContext('2d').clearRect(0, 0, c.width, c.height); updateChrome(); syncUI(); badge(); }
    if (view === 'grid') { if (photos.length) buildGrid(); else setView('photo'); }
    Memory.save();
    toastAction(`Removed ${ph.name}`, 'Undo', undoRemove, 6500);
  }
  function undoRemove() {
    const r = removed; if (!r || !r.ph.thumb) return;
    removed = null; clearTimeout(removedT);
    const i = Math.min(r.i, photos.length);
    photos.splice(i, 0, r.ph);
    selSet = new Set([...selSet].map(j => (j >= i ? j + 1 : j))); if (anchor >= i) anchor++;
    addFilmItem(r.ph); renumber(); select(i); scheduleStrip(); Memory.save();
    if (view === 'grid') buildGrid();
    toast(`${r.ph.name} is back`);
  }
  function pick(i, e) {
    if (e && e.shiftKey && anchor >= 0) { selSet = new Set(); for (let j = Math.min(anchor, i); j <= Math.max(anchor, i); j++) selSet.add(j); select(i, true); }
    else if (e && (e.ctrlKey || e.metaKey)) {
      if (selSet.has(i) && selSet.size > 1) { selSet.delete(i); select(i === cur ? [...selSet][0] : cur, true); }
      else { selSet.add(i); anchor = i; select(i, true); }
    } else select(i);
  }
  function select(i, keepSel) {
    if (i < 0 || i >= photos.length) return;
    cur = i;
    if (!keepSel) { selSet = new Set([i]); anchor = i; }
    selSet.add(i);
    photos.forEach((p, j) => { if (p.fs) { p.fs.setAttribute('aria-current', String(j === i)); p.fs.setAttribute('aria-selected', String(selSet.has(j) && selSet.size > 1)); } });
    photos[i].fs && photos[i].fs.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (mSig.split(':')[0] !== String(i)) mSel = 0;
    Memory.save();
    updateChrome(); syncUI(); renderMain(); scheduleThumbs(); scheduleHist();
    if (tab === 'mask') renderMaskPanel();
    if (view === 'grid') $$('#grid .cell').forEach(c => c.setAttribute('aria-current', String(+c.dataset.i === i)));
    ensurePreview(i).then(() => { if (cur === i) renderMain(); });
    [i + 1, i - 1].forEach(j => { if (photos[j]) setTimeout(() => ensurePreview(j), 300); });
  }
  function selectAll() { if (!photos.length) return; selSet = new Set(photos.map((_, j) => j)); select(cur, true); }
  function markAdj() { photos.forEach(p => p.fs && p.fs.classList.toggle('tw', isTweaked(p))); }
  function updateChrome() {
    const has = photos.length > 0;
    $('#drop').hidden = has; $('#cwrap').hidden = !has || view === 'grid'; $('#grid').hidden = !has || view !== 'grid';
    $('#app').classList.toggle('m-empty', !has);
    $('#ctool').hidden = !has || view === 'photo'; $('#chint').hidden = !has || view !== 'crop';
    $('#exp').disabled = !has; $('#cmp').disabled = !has; $('#split').disabled = !has || view === 'grid';
    $$('#views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === view)));
    $('#cwrap').classList.toggle('crop', view === 'crop' || (view === 'photo' && frameOrig()));
    const ph = photos[cur];
    if (!ph) { $('#meta').textContent = 'No photos yet'; return; }
    const I = ph.info, bits = [];
    if (ph.date) bits.push(ph.date.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
    if (I.f35) bits.push(I.f35 + 'mm');
    if (I.fnum) bits.push('ƒ/' + (+I.fnum.toFixed(1)));
    if (I.exp) bits.push(I.exp >= 1 ? I.exp + 's' : '1/' + Math.round(1 / I.exp) + 's');
    if (I.iso) bits.push('ISO ' + I.iso);
    $('#meta').innerHTML = `<span class="num">${cur + 1} / ${photos.length}</span> · <b>${esc(ph.name)}</b>${bits.length ? ' · ' + bits.join(' · ') : ''}`;
    $('#hsize').textContent = `${ph.w}×${ph.h}${ph.isP3 ? ' · P3' : ''}${ph.gain ? ' · HDR' : ''}`;
    syncCropTool();
  }
  function badge() {
    const b = $('#badge');
    if (compare) { b.hidden = false; b.className = 'badge before'; b.textContent = 'Before — camera original'; }
    else if (hoverSim) { b.hidden = false; b.className = 'badge'; b.textContent = 'Preview: ' + SIMBY[hoverSim].label; }
    else b.hidden = true;
    const s = $('#sbadge');
    s.hidden = scope !== 'sel' || !photos.length || view === 'grid';
    s.textContent = selSet.size > 1 ? `Editing ${selSet.size} selected photos` : `Editing photo ${cur + 1} only`;
  }

  /* ---------- views: photo / crop / grid ---------- */
  function setView(v) {
    if (!photos.length && v !== 'photo') return;
    view = v; updateChrome(); badge();
    if (v === 'grid') buildGrid(); else renderMain();
  }
  function buildRatios() {
    $('#ratios').innerHTML = Compose.SIZES.map(s => `<button data-v="${s.id}" title="${s.name} · ${s.w}×${s.h}">${s.label}</button>`).join('');
    $$('#ratios button').forEach(b => b.addEventListener('click', () => { ratio = b.dataset.v; syncCropTool(); if (view === 'grid') buildGrid(); else renderMain(); }));
    $$('#fitseg button').forEach(b => b.addEventListener('click', () => {
      for (const i of selSet) { const p = photos[i]; if (b.dataset.v === G.fitMode) p.fit = undefined; else p.fit = b.dataset.v; }
      markAdj(); syncCropTool(); renderMain(); if (view === 'grid') scheduleGrid();
    }));
    $('#zoom').addEventListener('input', e => {
      const ph = photos[cur]; if (!ph || !curLayout || fitOf(ph) === 'fit') return;
      const c = cropFor(ph, ratio) || { x: 0.5, y: 0.5, z: 1 };
      setCrop(ph, ratio, { ...c, z: +e.target.value }, curLayout.w / curLayout.h); renderMain();
    });
    $('#creset').addEventListener('click', () => resetCrop(ratio));
  }
  function resetCrop(rid) {
    const ph = photos[cur]; if (!ph) return;
    if (ph.crop) delete ph.crop[rid];
    if (!Object.keys(ph.crop || {}).length) ph.focus = null;
    markAdj(); syncCropTool(); renderMain(); if (view === 'grid') scheduleGrid();
  }
  function syncCropTool() {
    $$('#ratios button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ratio)));
    const ph = photos[cur]; if (!ph) return;
    const m = fitOf(ph);
    $$('#fitseg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === m)));
    const c = cropFor(ph, ratio);
    $('#zoom').value = c ? c.z || 1 : 1; $('#zoom').disabled = m === 'fit'; $('#zlab').style.opacity = m === 'fit' ? 0.4 : 1;
  }

  let rafOn = false;
  function renderMain() { if (rafOn) return; rafOn = true; requestAnimationFrame(() => { rafOn = false; drawMain(); }); }
  function fitBox(w, h, aw, ah) { const sc = Math.min(aw / w, ah / h); return [Math.max(1, Math.floor(w * sc)), Math.max(1, Math.floor(h * sc))]; }
  function drawMain() {
    const ph = photos[cur]; if (!ph || !engine || !lutReady.provia) return;
    if (view === 'grid') { scheduleGrid(); return; }
    const st = $('#stage'), mob = MQ.matches, padX = mob ? 8 : 26, padY = view === 'crop' ? (mob ? 48 : 56) : (mob ? 8 : 26);
    const aw = Math.max(50, st.clientWidth - padX * 2), ah = Math.max(50, st.clientHeight - padY * 2);
    const src = ph.prev || ph.thumb, P = params(viewSettings(ph), ph);
    if (tab === 'mask' && P.masks && (mShow || (mDrag && mDrag.kind !== 'rot'))) { const en = (ph.masks || []).filter(m => m.on !== false), i = en.indexOf((ph.masks || [])[mSel]); if (i >= 0) P.maskShow = i; }
    let OW, OH, mode, crop, frame, stampIt;
    if (view === 'crop') { const S = Compose.SIZE[ratio]; OW = S.w; OH = S.h; mode = fitOf(ph); crop = cropFor(ph, ratio); frame = frameS(); stampIt = !!G.stampOn; }
    else { OW = ph.w; OH = ph.h; mode = 'fill'; crop = cropFor(ph, 'orig'); frame = frameOrig() ? frameS() : null; stampIt = stampOrig(); }
    const [cw, ch] = fitBox(OW, OH, aw, ah);
    let dpr = Math.min(window.devicePixelRatio || 1, 2); dpr = Math.min(dpr, 2560 / Math.max(cw, ch));
    const pw = Math.max(1, Math.round(cw * dpr)), phh = Math.max(1, Math.round(ch * dpr));
    for (const c of [cv, ovl]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; if (c.width !== pw || c.height !== phh) { c.width = pw; c.height = phh; } }
    $('#cwrap').style.marginTop = view === 'crop' ? '30px' : '0';
    const L = Compose.layout(pw, phh, ph.w, ph.h, frame, mode, crop);
    curLayout = L;
    const cr = [L.src.x / ph.w, L.src.y / ph.h, L.src.w / ph.w, L.src.h / ph.h];
    const bg = Compose.hexToRgb((frame && frame.on) || mode === 'fit' ? G.frameColor : '#000000');
    const vp = [L.x, phh - L.y - L.h, L.w, L.h];
    engine.renderTo(src, P, L.w, L.h, { toCanvas: true, crop: cr, vp, clear: bg, bypass: compare, seed: cur + 7 });
    let sx = null;
    if (split && !compare) {
      sx = Math.round(L.x + L.w * splitPos);
      if (sx > L.x) engine.renderTo(src, P, L.w, L.h, { toCanvas: true, crop: cr, vp, bypass: true, seed: cur + 7, scissor: [L.x, phh - L.y - L.h, sx - L.x, L.h] });
    }
    const o = ovl.getContext('2d'); o.clearRect(0, 0, pw, phh);
    if (!compare && stampIt) {
      o.save(); if (sx != null) { o.beginPath(); o.rect(sx, 0, pw - sx, phh); o.clip(); }
      Compose.drawStamp(o, { x: L.x, y: L.y, w: L.w, h: L.h }, ph.date, stampS()); o.restore();
    }
    if (sx != null) drawSplit(o, sx, L, dpr);
    if (tab === 'mask') drawMasks(o, ph, L, dpr);
    scheduleHist();
  }
  function drawSplit(o, sx, L, dpr) {
    o.save();
    o.fillStyle = 'rgba(0,0,0,.35)'; o.fillRect(sx - 1.5 * dpr, L.y, 3 * dpr, L.h);
    o.fillStyle = '#fff'; o.fillRect(sx - 0.75 * dpr, L.y, 1.5 * dpr, L.h);
    const cy = L.y + L.h / 2, r = 15 * dpr;
    o.beginPath(); o.arc(sx, cy, r, 0, Math.PI * 2); o.fillStyle = 'rgba(18,19,21,.85)'; o.fill();
    o.lineWidth = 1.5 * dpr; o.strokeStyle = '#fff'; o.stroke();
    o.beginPath(); o.moveTo(sx - 4 * dpr, cy - 5 * dpr); o.lineTo(sx - 9 * dpr, cy); o.lineTo(sx - 4 * dpr, cy + 5 * dpr);
    o.moveTo(sx + 4 * dpr, cy - 5 * dpr); o.lineTo(sx + 9 * dpr, cy); o.lineTo(sx + 4 * dpr, cy + 5 * dpr); o.stroke();
    o.font = `600 ${11 * dpr}px "IBM Plex Sans", system-ui, sans-serif`; o.textBaseline = 'middle';
    const tag = (t, x, right) => {
      const w = o.measureText(t).width + 14 * dpr, h = 20 * dpr, xx = right ? x - w : x, yy = L.y + 10 * dpr;
      o.fillStyle = 'rgba(18,19,21,.78)'; o.fillRect(xx, yy, w, h); o.fillStyle = '#fff'; o.fillText(t, xx + 7 * dpr, yy + h / 2);
    };
    if (sx - L.x > 70 * dpr) tag('BEFORE', L.x + 10 * dpr, false);
    if (L.x + L.w - sx > 70 * dpr) tag('AFTER', L.x + L.w - 10 * dpr, true);
    o.restore();
  }
  function toggleSplit() { if (!photos.length || view === 'grid') return; split = !split; if (split) { compare = false; $('#cmp').setAttribute('aria-pressed', 'false'); } $('#split').setAttribute('aria-pressed', String(split)); badge(); renderMain(); }
  function toggleCompare() { if (!photos.length) return; compare = !compare; if (compare && split) { split = false; $('#split').setAttribute('aria-pressed', 'false'); } $('#cmp').setAttribute('aria-pressed', String(compare)); badge(); renderMain(); scheduleHist(); }

  // drag on the photo: split divider, or move the crop (Crop view, or the framed original in Photo view)
  let drag = null;
  const cw0 = $('#cwrap');
  const canPan = ph => view === 'crop' ? fitOf(ph) !== 'fit' : frameOrig();
  const capture = id => { try { cw0.setPointerCapture(id); } catch (e) { /* the pointer already ended */ } };
  const touches = new Map(); let pinch = null;
  const tDist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cw0.addEventListener('pointerdown', e => {
    const ph = photos[cur]; if (!ph || !curLayout) return;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size > 1) {
        if (mDrag) maskUp();
        drag = null; cw0.classList.remove('drag');
        if (view === 'crop' && fitOf(ph) !== 'fit' && touches.size === 2) pinch = { d0: tDist(), z0: (cropFor(ph, ratio) || {}).z || 1 };
        return;
      }
    }
    if (tab === 'mask' && !compare && view !== 'grid') { if (maskDown(e)) capture(e.pointerId); return; }
    const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, px = (e.clientX - r.left) * dpr, L = curLayout;
    if (split && !compare) {
      const sx = L.x + L.w * splitPos;
      if (Math.abs(px - sx) < 20 * dpr || !canPan(ph)) {
        drag = { kind: 'split', r, dpr }; splitPos = clamp((px - L.x) / L.w, 0, 1); renderMain();
        capture(e.pointerId); return;
      }
    }
    if (!canPan(ph)) { if (view === 'crop') toast('This photo is set to “Fit whole” — choose Fill to crop it'); return; }
    const rid = view === 'crop' ? ratio : 'orig';
    drag = { kind: 'pan', rid, x: e.clientX, y: e.clientY, L, cx: L.src.x + L.src.w / 2, cy: L.src.y + L.src.h / 2, z: (cropFor(ph, rid) || {}).z || 1 };
    capture(e.pointerId); cw0.classList.add('drag');
  });
  cw0.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      const ph = photos[cur]; if (!ph || touches.size < 2 || !curLayout) return;
      const c = cropFor(ph, ratio) || { x: 0.5, y: 0.5, z: 1 };
      setCrop(ph, ratio, { ...c, z: clamp(pinch.z0 * tDist() / Math.max(pinch.d0, 1), 1, 4) }, curLayout.w / curLayout.h);
      syncCropTool(); renderMain(); return;
    }
    if (mDrag) { maskMove(e); return; }
    if (!drag) return; const ph = photos[cur];
    if (drag.kind === 'split') { const L = curLayout; splitPos = clamp(((e.clientX - drag.r.left) * drag.dpr - L.x) / L.w, 0, 1); renderMain(); return; }
    const dpr = cv.width / cv.clientWidth, k = drag.L.src.w / drag.L.w;
    const nx = drag.cx - (e.clientX - drag.x) * dpr * k, ny = drag.cy - (e.clientY - drag.y) * dpr * k;
    setCrop(ph, drag.rid, { x: nx / ph.w, y: ny / ph.h, z: drag.z }, drag.L.w / drag.L.h); renderMain();
  });
  const endDrag = e => {
    if (e && touches.delete(e.pointerId) && touches.size < 2) pinch = null;
    if (mDrag) maskUp(); if (drag) { drag = null; cw0.classList.remove('drag'); if (view === 'grid') scheduleGrid(); }
  };
  cw0.addEventListener('pointerup', endDrag); cw0.addEventListener('pointercancel', endDrag);
  // touch: hold the photo to see the camera original; swipe sideways for the next / previous photo
  let tg = null;
  const tgStop = () => { if (!tg) return; clearTimeout(tg.hold); if (tg.held) { compare = false; $('#cmp').setAttribute('aria-pressed', 'false'); badge(); renderMain(); scheduleHist(); } tg = null; };
  cw0.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    if (touches.size > 1) { tgStop(); return; }
    const free = view === 'photo' && tab !== 'mask' && !split && !drag;
    tg = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), free, moved: false, held: false, hold: 0 };
    if (free && !compare) tg.hold = setTimeout(() => {
      if (tg && !tg.moved) { tg.held = true; compare = true; $('#cmp').setAttribute('aria-pressed', 'true'); badge(); renderMain(); }
    }, 260);
  });
  cw0.addEventListener('pointermove', e => {
    if (tg && e.pointerId === tg.id && !tg.moved && Math.hypot(e.clientX - tg.x, e.clientY - tg.y) > 10) { tg.moved = true; clearTimeout(tg.hold); }
  });
  const tgEnd = e => {
    if (!tg || e.pointerId !== tg.id) return;
    const dx = e.clientX - tg.x, dy = e.clientY - tg.y, dt = performance.now() - tg.t, sw = tg.free && !tg.held && e.type === 'pointerup';
    tgStop();
    if (sw && Math.abs(dx) > 48 && Math.abs(dx) > 1.6 * Math.abs(dy) && dt < 700 && photos.length > 1) select(clamp(cur + (dx < 0 ? 1 : -1), 0, photos.length - 1));
  };
  cw0.addEventListener('pointerup', tgEnd); cw0.addEventListener('pointercancel', tgEnd);
  cw0.addEventListener('contextmenu', e => { if (MQ.matches) e.preventDefault(); });
  cw0.addEventListener('dblclick', () => { if (tab === 'mask') return; if (view === 'crop') resetCrop(ratio); else if (frameOrig()) resetCrop('orig'); });
  cw0.addEventListener('wheel', e => {
    const ph = photos[cur]; if (view !== 'crop' || !ph || !curLayout || fitOf(ph) === 'fit') return;
    e.preventDefault();
    const c = cropFor(ph, ratio) || { x: 0.5, y: 0.5, z: 1 };
    setCrop(ph, ratio, { ...c, z: clamp((c.z || 1) * Math.exp(-e.deltaY * 0.0015), 1, 4) }, curLayout.w / curLayout.h);
    syncCropTool(); renderMain();
  }, { passive: false });

  /* ---------- masks: extra adjustments inside (or outside) an ellipse, or on one side of a linear gradient ---------- */
  const MASK_MAX = 4;
  const MK_SL = [['exp', 'Exposure', -3, 3, 0.05], ['contrast', 'Contrast', -100, 100, 1], ['hl', 'Highlights', -100, 100, 1], ['sh', 'Shadows', -100, 100, 1],
    ['warm', 'Warmth', -100, 100, 1], ['sat', 'Saturation', -100, 100, 1], ['clarity', 'Clarity', -100, 100, 1], ['feather', 'Feather', 0, 100, 1]];
  const MK_TPL = {
    plain: { label: 'Radial', tip: 'An empty mask in the middle — then set what changes inside it', o: {} },
    light: { label: 'Light up', tip: 'Brighten the subject', o: { rx: 0.26, ry: 0.34, exp: 0.45, sh: 15, feather: 75 } },
    dark: { label: 'Darken around', tip: 'Darken everything outside — a vignette you place yourself', o: { rx: 0.4, ry: 0.5, invert: true, exp: -0.6, feather: 85 } },
    warm: { label: 'Warm glow', tip: 'Warm light on one area', o: { rx: 0.3, ry: 0.3, warm: 35, exp: 0.15, feather: 85 } },
    lin: { label: 'Linear', tip: 'An empty linear gradient — full effect on one side, fading across the band', o: { type: 'linear', len: 0.45, rot: Math.PI / 2 } },
    sky: { label: 'Darker sky', tip: 'Darken and deepen the sky, fading out towards the horizon', o: { type: 'linear', cy: 0.3, len: 0.42, rot: Math.PI / 2, exp: -0.55, hl: -25, sat: 12 } },
  };
  let mDraw = store.get('filmlab.mdraw') === 'linear' ? 'linear' : 'radial';   // what a drag on the photo draws
  let mSel = 0, mShow = false, mDrag = null, mSig = '';
  const newMask = o => Object.assign({ type: 'radial', cx: 0.5, cy: 0.5, rx: 0.25, ry: 0.25, len: 0.45, rot: 0, feather: 60, invert: false, on: true, exp: 0, contrast: 0, hl: 0, sh: 0, warm: 0, sat: 0, clarity: 0 }, o || {});
  const isLin = m => m && m.type === 'linear';
  const maskAsp = ph => { const m = Math.min(ph.w, ph.h); return [ph.w / m, ph.h / m]; };
  const curMasks = () => (photos[cur] && photos[cur].masks) || [];
  // a mask as the engine needs it: geometry in short-side units, exposure + warmth as a gain, tone, saturation, clarity
  function maskU(m, ph) {
    const a = maskAsp(ph), k = 0.0035;
    let g = [2 ** (m.warm * k), 1, 2 ** (-m.warm * k)];
    const y = g[0] * 0.2627 + g[1] * 0.677998 + g[2] * 0.059302, e = 2 ** m.exp;
    g = g.map(x => x / y * e);
    return { geo: isLin(m) ? [m.cx * a[0], m.cy * a[1], Math.max(m.len || 0.45, 0.005), -1] : [m.cx * a[0], m.cy * a[1], m.rx, m.ry],
      rot: [Math.cos(m.rot), Math.sin(m.rot), clamp(m.feather / 100, 0.02, 1), m.invert ? 1 : 0],
      gain: g, b1: [m.contrast / 100, m.hl / 100, m.sh / 100, 0], sat: m.sat / 100, clar: m.clarity / 100 * 5 };
  }
  function maskSummary(m) {
    const p = [];
    if (m.exp) p.push(`${m.exp > 0 ? '+' : '−'}${Math.abs(m.exp).toFixed(2)} EV`);
    for (const [k, l] of [['contrast', 'contrast'], ['hl', 'highlights'], ['sh', 'shadows'], ['warm', 'warmth'], ['sat', 'saturation'], ['clarity', 'clarity']]) if (m[k]) p.push(`${l} ${m[k] > 0 ? '+' : '−'}${Math.abs(Math.round(m[k]))}`);
    return (isLin(m) ? 'Linear · ' : '') + (m.invert ? (isLin(m) ? 'Flipped · ' : 'Outside · ') : '') + (p.length ? p.slice(0, 2).join(' · ') + (p.length > 2 ? ' …' : '') : 'no changes yet');
  }
  function maskChanged(light) {
    markAdj(); renderMain(); Memory.save();
    if (light) syncMaskValues(); else renderMaskPanel();
    syncUI(); scheduleThumbs(); scheduleHist();
  }
  function addMask(kind) {
    const ph = photos[cur]; if (!ph) return;
    ph.masks = ph.masks || [];
    if (ph.masks.length >= MASK_MAX) { toast(`Up to ${MASK_MAX} masks per photo`); return; }
    let cx = 0.5, cy = 0.5;
    if (curLayout) { const r = curLayout.src; cx = (r.x + r.w / 2) / ph.w; cy = (r.y + r.h / 2) / ph.h; }
    ph.masks.push(newMask({ cx, cy, ...MK_TPL[kind].o })); mSel = ph.masks.length - 1;
    if (view === 'grid') setView('photo');
    maskChanged();
  }
  function delMask(i) {
    const ph = photos[cur]; if (!ph || !ph.masks || !ph.masks[i]) return;
    const [m] = ph.masks.splice(i, 1); mSel = clamp(mSel > i ? mSel - 1 : mSel, 0, Math.max(0, ph.masks.length - 1)); maskChanged();
    toastAction(`Mask ${i + 1} deleted`, 'Undo', () => { if (!photos.includes(ph)) return; ph.masks.splice(Math.min(i, ph.masks.length), 0, m); if (photos[cur] === ph) mSel = i; maskChanged(); });
  }
  function renderMaskPanel() {
    const box = $('#maskPanel'); if (!box) return;
    const ph = photos[cur], ms = curMasks();
    if (mSel >= ms.length) mSel = Math.max(0, ms.length - 1);
    mSig = `${cur}:${ms.length}:${mSel}`;
    let h = `<div class="tnote">Extra adjustments on one area of this photo. Drag on the photo to draw a mask, up to ${MASK_MAX}: radial for a subject, linear for a sky or the ground. Shift keeps a radial round and snaps a linear's angle.</div>`;
    if (!ph) { box.innerHTML = h + '<div class="mempty">Add photos to use masks.</div>'; return; }
    h += `<div class="row mdraw"><span>Drag draws</span><div class="seg"><button data-mdraw="radial" aria-pressed="${mDraw === 'radial'}">Radial</button><button data-mdraw="linear" aria-pressed="${mDraw === 'linear'}">Linear</button></div></div>`;
    h += `<div class="mq">${Object.entries(MK_TPL).map(([k, t]) => `<button class="btn sm" data-mt="${k}" title="${esc(t.tip)}"${ms.length >= MASK_MAX ? ' disabled' : ''}>${k === 'plain' || k === 'lin' ? IC.plus : ''}<span>${t.label}</span></button>`).join('')}</div>`;
    if (ms.length) {
      h += `<div class="mlist">${ms.map((m, i) => `<div class="mrow" data-mi="${i}" aria-selected="${i === mSel}"><button class="mpick" data-mi="${i}"><i>${i + 1}</i><span><b>${isLin(m) ? 'Linear' : 'Radial'} ${i + 1}</b><small>${esc(maskSummary(m))}</small></span></button><button class="ib" data-meye="${i}" aria-pressed="${m.on !== false}" title="${m.on !== false ? 'Turn this mask off' : 'Turn this mask on'}" aria-label="Turn mask ${i + 1} on or off">${m.on !== false ? IC.eye : IC.eyeOff}</button><button class="ib" data-mdel="${i}" title="Delete this mask" aria-label="Delete mask ${i + 1}">${IC.trash}</button></div>`).join('')}</div>`;
      const m = ms[mSel];
      h += `<details open class="msec"><summary>${IC.chev}<span>${isLin(m) ? 'Linear' : 'Radial'} ${mSel + 1}</span><button class="sreset" data-mreset title="Reset this mask's adjustments" aria-label="Reset mask ${mSel + 1}">${IC.reset}</button></summary><div class="body">`
        + (isLin(m) ? `<div class="row"><span>Full effect</span><div class="seg"><button data-minv="0" aria-pressed="${!m.invert}">Start side</button><button data-minv="1" aria-pressed="${!!m.invert}">Other side</button></div></div>`
          : `<div class="row"><span>Affects</span><div class="seg"><button data-minv="0" aria-pressed="${!m.invert}">Inside</button><button data-minv="1" aria-pressed="${!!m.invert}">Outside</button></div></div>`)
        + MK_SL.filter(([k]) => !(isLin(m) && k === 'feather')).map(([k, lab, mn, mx, st]) => `<div class="sl" data-mk="${k}"><label>${lab}</label><output></output><input type="range" min="${mn}" max="${mx}" step="${st}" value="${m[k]}" aria-label="${lab}"></div>`).join('')
        + `<div class="row"><span>Show mask</span><div class="seg"><button data-mshow="0" aria-pressed="${!mShow}">Off</button><button data-mshow="1" aria-pressed="${mShow}">Red overlay</button></div></div>`
        + `</div></details>`;
    } else h += `<div class="mempty">No masks on this photo yet.</div>`;
    box.innerHTML = h;
    $$('[data-mt]', box).forEach(b => b.onclick = () => addMask(b.dataset.mt));
    $$('[data-mdraw]', box).forEach(b => b.onclick = () => { mDraw = b.dataset.mdraw; store.set('filmlab.mdraw', mDraw); renderMaskPanel(); });
    $$('.mpick', box).forEach(b => b.onclick = () => { mSel = +b.dataset.mi; renderMaskPanel(); renderMain(); });
    $$('[data-meye]', box).forEach(b => b.onclick = () => { const mm = ms[+b.dataset.meye]; mm.on = mm.on === false; maskChanged(); });
    $$('[data-mdel]', box).forEach(b => b.onclick = () => delMask(+b.dataset.mdel));
    $$('[data-minv]', box).forEach(b => b.onclick = () => { ms[mSel].invert = b.dataset.minv === '1'; maskChanged(); });
    $$('[data-mshow]', box).forEach(b => b.onclick = () => { mShow = b.dataset.mshow === '1'; renderMaskPanel(); renderMain(); });
    const rs = $('[data-mreset]', box);
    if (rs) rs.onclick = e => { e.preventDefault(); e.stopPropagation(); const mm = ms[mSel]; for (const [k] of MK_SL) mm[k] = k === 'feather' ? 60 : 0; maskChanged(); };
    $$('.sl[data-mk]', box).forEach(el => {
      const k = el.dataset.mk, inp = el.querySelector('input');
      inp.addEventListener('input', () => { const mm = curMasks()[mSel]; if (!mm) return; mm[k] = +inp.value; syncMaskValues(); renderMain(); });
      inp.addEventListener('change', () => { markAdj(); scheduleThumbs(); scheduleHist(); syncUI(); Memory.save(); });
      const reset = () => { const mm = curMasks()[mSel]; if (!mm) return; mm[k] = k === 'feather' ? 60 : 0; maskChanged(true); };
      el.querySelector('label').addEventListener('dblclick', reset); inp.addEventListener('dblclick', reset);
    });
    syncMaskValues();
  }
  function syncMaskValues() {
    const ms = curMasks(), m = ms[mSel]; if (!m) return;
    $$('#maskPanel .sl[data-mk]').forEach(el => {
      const k = el.dataset.mk, inp = el.querySelector('input'), out = el.querySelector('output'), v = m[k], mn = +inp.min, mx = +inp.max;
      if (Math.abs(+inp.value - v) > 1e-6) inp.value = v;
      out.textContent = k === 'exp' ? (Math.abs(v) < 0.005 ? '0 EV' : sign(v) + Math.abs(v).toFixed(2) + ' EV') : k === 'feather' ? Math.round(v) + '%' : (v > 0 ? '+' : '') + Math.round(v);
      inp.style.setProperty('--p', ((v - mn) / (mx - mn) * 100) + '%'); inp.style.setProperty('--z', ((clamp(0, mn, mx) - mn) / (mx - mn) * 100) + '%');
      inp.classList.toggle('neg', v < 0);
    });
    $$('#maskPanel .mrow').forEach(r => { const mm = ms[+r.dataset.mi]; if (mm) r.querySelector('small').textContent = maskSummary(mm); });
  }
  // on the photo: the mask in canvas pixels, its handles, and hit tests
  function mGeo(m, ph, L) {
    const k = L.w / L.src.w, S = Math.min(ph.w, ph.h);
    return { lin: isLin(m), x: L.x + (m.cx * ph.w - L.src.x) * k, y: L.y + (m.cy * ph.h - L.src.y) * k, rx: m.rx * S * k, ry: m.ry * S * k,
      h: (m.len || 0.45) * S * k / 2, c: Math.cos(m.rot), s: Math.sin(m.rot) };
  }
  function mHandles(g, dpr) {
    const P = (a, b) => ({ x: g.x + a * g.c - b * g.s, y: g.y + a * g.s + b * g.c });
    if (g.lin) return { a: P(-g.h, 0), z: P(g.h, 0) };          // start and end of the band: drag to turn and widen
    return { r: P(g.rx, 0), l: P(-g.rx, 0), b: P(0, g.ry), t: P(0, -g.ry), rot: P(0, -g.ry - 24 * dpr) };
  }
  const inEllipse = (g, x, y) => { const dx = x - g.x, dy = y - g.y, a = (dx * g.c + dy * g.s) / Math.max(g.rx, 1), b = (-dx * g.s + dy * g.c) / Math.max(g.ry, 1); return a * a + b * b <= 1; };
  const onMask = (g, x, y, hit) => g.lin ? Math.abs((x - g.x) * g.c + (y - g.y) * g.s) <= Math.max(g.h, hit) && Math.abs(-(x - g.x) * g.s + (y - g.y) * g.c) < 2.5 * hit + 40
    : inEllipse(g, x, y);
  function maskDown(e) {
    const ph = photos[cur], L = curLayout; if (!ph || !L) return false;
    const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    const ms = ph.masks || [], hit = (e.pointerType === 'touch' ? 24 : 12) * dpr, m = ms[mSel];
    if (m) {
      const H = mHandles(mGeo(m, ph, L), dpr);
      for (const k in H) if (Math.hypot(H[k].x - x, H[k].y - y) < hit) { mDrag = { kind: k, r, dpr }; return true; }
    }
    const order = ms.map((_, i) => i).sort((a, b) => (a === mSel ? -1 : b === mSel ? 1 : a - b));
    for (const i of order) {
      const g = mGeo(ms[i], ph, L);
      if (onMask(g, x, y, hit) || Math.hypot(g.x - x, g.y - y) < hit) {
        if (i !== mSel) { mSel = i; renderMaskPanel(); }
        mDrag = { kind: 'move', r, dpr, x0: x, y0: y, cx: ms[i].cx, cy: ms[i].cy }; renderMain(); return true;
      }
    }
    if (ms.length >= MASK_MAX) { toast(`Up to ${MASK_MAX} masks per photo — delete one to draw another`); return true; }
    const k = L.w / L.src.w, px = (L.src.x + (x - L.x) / k) / ph.w, py = (L.src.y + (y - L.y) / k) / ph.h;
    ph.masks = ms; ms.push(mDraw === 'linear' ? newMask({ type: 'linear', cx: px, cy: py, len: 0.01, rot: Math.PI / 2 }) : newMask({ cx: px, cy: py, rx: 0.02, ry: 0.02 }));
    mSel = ms.length - 1; mDrag = { kind: 'new', r, dpr, x0: x, y0: y, px, py };
    renderMaskPanel(); renderMain(); return true;
  }
  function maskMove(e) {
    const ph = photos[cur], L = curLayout, m = ph && ph.masks && ph.masks[mSel], d = mDrag; if (!m || !d || !L) return;
    const x = (e.clientX - d.r.left) * d.dpr, y = (e.clientY - d.r.top) * d.dpr, k = L.w / L.src.w, S = Math.min(ph.w, ph.h);
    if (d.kind === 'move') { m.cx = clamp(d.cx + (x - d.x0) / k / ph.w, -0.25, 1.25); m.cy = clamp(d.cy + (y - d.y0) / k / ph.h, -0.25, 1.25); }
    else if (d.kind === 'new' && isLin(m)) {
      // linear: drag from where the effect is full to where it ends
      let a = Math.atan2(y - d.y0, x - d.x0); if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * Math.PI / 12;
      const dist = Math.hypot(x - d.x0, y - d.y0);
      m.rot = a; m.len = Math.max(0.01, dist / k / S);
      m.cx = d.px + (Math.cos(a) * dist / 2) / k / ph.w; m.cy = d.py + (Math.sin(a) * dist / 2) / k / ph.h;
    }
    else if (d.kind === 'new') { m.rx = Math.max(0.02, Math.abs(x - d.x0) / k / S); m.ry = Math.max(0.02, Math.abs(y - d.y0) / k / S); if (e.shiftKey) m.rx = m.ry = Math.max(m.rx, m.ry); }
    else if (d.kind === 'a' || d.kind === 'z') {
      // a band end: turns the gradient around its centre and sets how wide the fade is
      const g = mGeo(m, ph, L); let dx = x - g.x, dy = y - g.y;
      if (d.kind === 'a') { dx = -dx; dy = -dy; }
      let a = Math.atan2(dy, dx); if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * Math.PI / 12;
      m.rot = a; m.len = Math.max(0.01, 2 * Math.hypot(dx, dy) / k / S);
    }
    else {
      const g = mGeo(m, ph, L), dx = x - g.x, dy = y - g.y, a = dx * g.c + dy * g.s, b = -dx * g.s + dy * g.c;
      if (d.kind === 'l' || d.kind === 'r') { m.rx = Math.max(0.02, Math.abs(a) / k / S); if (e.shiftKey) m.ry = m.rx; }
      else if (d.kind === 't' || d.kind === 'b') { m.ry = Math.max(0.02, Math.abs(b) / k / S); if (e.shiftKey) m.rx = m.ry; }
      else if (d.kind === 'rot') { m.rot = Math.atan2(dy, dx) + Math.PI / 2; if (e.shiftKey) m.rot = Math.round(m.rot / (Math.PI / 12)) * Math.PI / 12; }
    }
    renderMain();
  }
  function maskUp() {
    const m = curMasks()[mSel];
    if (mDrag && mDrag.kind === 'new' && m && isLin(m) && m.len < 0.04) { m.len = 0.45; m.rot = Math.PI / 2; }   // a click: a top-to-bottom fade
    else if (mDrag && mDrag.kind === 'new' && m && !isLin(m) && m.rx < 0.04 && m.ry < 0.04) m.rx = m.ry = 0.2;   // a click makes a medium circle
    mDrag = null; maskChanged();
  }
  function drawMasks(o, ph, L, dpr) {
    const ms = ph.masks || []; if (!ms.length) return;
    o.save(); o.font = `600 ${10 * dpr}px "IBM Plex Sans", system-ui, sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle';
    ms.forEach((m, i) => {
      const g = mGeo(m, ph, L), sel = i === mSel, rot = Math.atan2(g.s, g.c);
      o.shadowColor = 'rgba(0,0,0,.65)'; o.shadowBlur = 3 * dpr;
      o.lineWidth = (sel ? 1.6 : 1.1) * dpr; o.strokeStyle = sel ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)';
      o.setLineDash(m.on === false ? [4 * dpr, 4 * dpr] : []);
      if (g.lin) {
        // three lines across the photo: full effect, the middle, no effect
        const R = Math.hypot(L.w, L.h), line = (off, dash, wdt, col) => {
          const cx = g.x + off * g.c, cy = g.y + off * g.s;
          o.setLineDash(dash); o.lineWidth = wdt; o.strokeStyle = col;
          o.beginPath(); o.moveTo(cx + g.s * R, cy - g.c * R); o.lineTo(cx - g.s * R, cy + g.c * R); o.stroke();
        };
        o.save(); o.beginPath(); o.rect(L.x, L.y, L.w, L.h); o.clip();
        const off = m.on === false ? [4 * dpr, 4 * dpr] : [];
        line(-g.h, off, (sel ? 1.6 : 1.1) * dpr, sel ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)');
        if (sel) line(0, [5 * dpr, 4 * dpr], dpr, 'rgba(255,255,255,.6)');
        line(g.h, sel ? [2 * dpr, 3 * dpr] : [2 * dpr, 4 * dpr], (sel ? 1.3 : 1) * dpr, 'rgba(255,255,255,.55)');
        o.restore(); o.setLineDash([]);
        if (sel) {
          const H = mHandles(g, dpr);
          o.beginPath(); o.moveTo(H.a.x, H.a.y); o.lineTo(H.z.x, H.z.y); o.lineWidth = 1.2 * dpr; o.strokeStyle = 'rgba(255,255,255,.8)'; o.stroke();
          for (const kk in H) { o.beginPath(); o.arc(H[kk].x, H[kk].y, 5.5 * dpr, 0, Math.PI * 2); o.fillStyle = kk === 'a' ? '#fff' : '#5B9CF6'; o.fill(); o.lineWidth = 1.2 * dpr; o.strokeStyle = 'rgba(0,0,0,.55)'; o.stroke(); }
        }
        o.beginPath(); o.arc(g.x, g.y, 8.5 * dpr, 0, Math.PI * 2); o.fillStyle = sel ? '#5B9CF6' : 'rgba(18,19,21,.78)'; o.fill();
        o.lineWidth = 1.2 * dpr; o.strokeStyle = '#fff'; o.stroke();
        o.shadowBlur = 0; o.fillStyle = '#fff'; o.fillText(String(i + 1), g.x, g.y + 0.5 * dpr);
        return;
      }
      o.beginPath(); o.ellipse(g.x, g.y, Math.max(1, g.rx), Math.max(1, g.ry), rot, 0, Math.PI * 2); o.stroke();
      if (sel) {
        const f = clamp(1 - m.feather / 100, 0.02, 1);
        o.setLineDash([3 * dpr, 3 * dpr]); o.lineWidth = dpr; o.strokeStyle = 'rgba(255,255,255,.55)';
        o.beginPath(); o.ellipse(g.x, g.y, Math.max(1, g.rx * f), Math.max(1, g.ry * f), rot, 0, Math.PI * 2); o.stroke(); o.setLineDash([]);
        const H = mHandles(g, dpr);
        o.beginPath(); o.moveTo(H.t.x, H.t.y); o.lineTo(H.rot.x, H.rot.y); o.lineWidth = 1.2 * dpr; o.strokeStyle = 'rgba(255,255,255,.8)'; o.stroke();
        for (const kk in H) { o.beginPath(); o.arc(H[kk].x, H[kk].y, (kk === 'rot' ? 5.5 : 4.5) * dpr, 0, Math.PI * 2); o.fillStyle = kk === 'rot' ? '#5B9CF6' : '#fff'; o.fill(); o.lineWidth = 1.2 * dpr; o.strokeStyle = 'rgba(0,0,0,.55)'; o.stroke(); }
      }
      o.setLineDash([]);
      o.beginPath(); o.arc(g.x, g.y, 8.5 * dpr, 0, Math.PI * 2); o.fillStyle = sel ? '#5B9CF6' : 'rgba(18,19,21,.78)'; o.fill();
      o.lineWidth = 1.2 * dpr; o.strokeStyle = '#fff'; o.stroke();
      o.shadowBlur = 0; o.fillStyle = '#fff'; o.fillText(String(i + 1), g.x, g.y + 0.5 * dpr);
    });
    o.restore();
  }

  // grid: every photo with its Instagram crop, frame and date
  function buildGrid() {
    const S = Compose.SIZE[ratio], g = $('#grid');
    const cellH = S.w / S.h < 0.9 ? 250 : S.w / S.h > 1.5 ? 170 : 220;
    const cw = Math.round(cellH * S.w / S.h);
    g.style.setProperty('--cw', cw + 'px');
    g.innerHTML = photos.map((ph, i) => `<div class="cell" data-i="${i}" aria-current="${i === cur}"><div class="cimg"><canvas width="${Math.round(cw * 1.5)}" height="${Math.round(cellH * 1.5)}" style="width:${cw}px;height:${cellH}px"></canvas><button class="rm" data-i="${i}" title="Remove from the batch" aria-label="Remove ${esc(ph.name)}">${IC.x}</button></div><span>${i + 1}</span></div>`).join('');
    $$('.cell .rm', g).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); removePhoto(photos[+b.dataset.i]); }));
    $$('.cell', g).forEach(cell => {
      const i = +cell.dataset.i, c = cell.querySelector('canvas');
      let d = null;
      c.addEventListener('pointerdown', e => {
        const ph = photos[i];
        d = { x: e.clientX, y: e.clientY, moved: false, L: cell._L, cx: cell._L ? cell._L.src.x + cell._L.src.w / 2 : 0, cy: cell._L ? cell._L.src.y + cell._L.src.h / 2 : 0, z: (cropFor(ph, ratio) || {}).z || 1 };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', e => {
        if (!d) return; const ph = photos[i];
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) d.moved = true;
        if (!d.moved || !d.L || fitOf(ph) === 'fit') return;
        const k = d.L.src.w / d.L.w * (c.width / c.clientWidth);
        setCrop(ph, ratio, { x: (d.cx - (e.clientX - d.x) * k) / ph.w, y: (d.cy - (e.clientY - d.y) * k) / ph.h, z: d.z }, d.L.w / d.L.h);
        drawCell(cell);
      });
      c.addEventListener('pointerup', e => { if (d && !d.moved) pick(i, e); d = null; });
      c.addEventListener('dblclick', () => { select(i); setView('crop'); });
    });
    scheduleGrid();
  }
  function drawCell(cell) {
    const i = +cell.dataset.i, ph = photos[i], c = cell.querySelector('canvas'); if (!ph) return;
    const L = Compose.layout(c.width, c.height, ph.w, ph.h, frameS(), fitOf(ph), cropFor(ph, ratio));
    cell._L = L;
    const crop = [L.src.x / ph.w, L.src.y / ph.h, L.src.w / ph.w, L.src.h / ph.h];
    const px = engine.quick(ph.thumb, params(eff(ph), ph), L.w, L.h, { crop });
    const x = c.getContext('2d');
    x.fillStyle = G.frameOn || fitOf(ph) === 'fit' ? G.frameColor : '#000'; x.fillRect(0, 0, c.width, c.height);
    x.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), L.w, L.h), L.x, L.y);
    Compose.drawStamp(x, { x: L.x, y: L.y, w: L.w, h: L.h }, ph.date, stampS());
    cell.querySelector('span').textContent = `${i + 1}${fitOf(ph) === 'fit' ? ' · fit' : ''}`;
  }
  const scheduleGrid = debounce(() => { if (view !== 'grid' || !lutReady.provia) return; $$('#grid .cell').forEach(drawCell); }, 120);

  /* ---------- histogram, sim thumbnails, filmstrip ---------- */
  const scheduleHist = debounce(drawHist, 90);
  function drawHist() {
    const ph = photos[cur]; if (!ph || !lutReady.provia) return;
    const w = 160, h = Math.max(24, Math.round(160 * ph.h / ph.w));
    const px = engine.quick(ph.thumb, params(viewSettings(ph), ph), w, h, { bypass: compare });
    const B = 64, r = new Float32Array(B), g = new Float32Array(B), b = new Float32Array(B);
    for (let i = 0; i < px.length; i += 4) { r[px[i] >> 2]++; g[px[i + 1] >> 2]++; b[px[i + 2] >> 2]++; }
    const c = $('#hist'), x = c.getContext('2d'), W = c.width, H = c.height;
    let mx = 1; for (let i = 1; i < B - 1; i++) mx = Math.max(mx, r[i], g[i], b[i]);
    x.clearRect(0, 0, W, H); x.globalCompositeOperation = 'lighter';
    [[r, 'rgba(232,92,88,.62)'], [g, 'rgba(98,196,118,.58)'], [b, 'rgba(92,140,240,.66)']].forEach(([a, col]) => {
      x.beginPath(); x.moveTo(0, H);
      for (let i = 0; i < B; i++) x.lineTo(i / (B - 1) * W, H - Math.min(1, a[i] / mx) * (H - 6));
      x.lineTo(W, H); x.closePath(); x.fillStyle = col; x.fill();
    });
    x.globalCompositeOperation = 'source-over';
  }
  const scheduleThumbs = debounce(drawSimThumbs, 160);
  function drawSimThumbs() {
    const ph = photos[cur]; if (!ph) return;
    const a = 4 / 3, pa = ph.w / ph.h;
    const crop = pa > a ? [(1 - a / pa) / 2, 0, a / pa, 1] : [0, (1 - pa / a) / 2, 1, pa / a];
    const base = eff(ph);
    for (const b of $$('.sim')) {
      const id = b.dataset.id; if (!simReady(id)) continue;
      if (THEMES[id]) Match.one(ph, id); else Match.oneAuto(ph);
      const c = b.querySelector('canvas');
      putPixels(c, engine.quick(ph.thumb, params({ ...base, sim: id }, ph), c.width, c.height, { crop }));
    }
  }
  const scheduleStrip = debounce(drawStrip, 380);
  function drawStrip() {
    if (!lutReady.provia) return;
    for (const ph of photos) {
      const c = ph.fs && ph.fs.querySelector('canvas'); if (!c) continue;
      putPixels(c, engine.quick(ph.thumb, params(eff(ph), ph), c.width, c.height));
    }
  }

  /* ---------- simulation icons: the viewer's own files, loaded once, kept in their account/browser ---------- */
  const Icons = (() => {
    const LS = 'filmlab.icons.v1', MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    let set = store.get(LS, { badge: {}, word: {} }), urls = { badge: {}, word: {} }, acc = null, chain = Promise.resolve();
    const norm = t => String(t).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/^[\d\s._-]+/, '').replace(/[^a-z0-9]/g, '');
    function simFor(path) {
      const base = norm(path.split('/').pop()); if (!base) return null;
      for (const sm of SIMS) if (norm(sm.id) === base || norm(sm.label) === base) return sm.id;
      return null;
    }
    const kindFor = path => /word/i.test(path) ? 'word' : 'badge';
    function toItem(name, bytes) {
      const ext = (name.split('.').pop() || '').toLowerCase(), mime = MIME[ext];
      if (!mime || bytes.length > 400 * 1024) return null;
      if (ext === 'svg') return { type: mime, data: new TextDecoder().decode(bytes) };
      let bin = ''; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      return { type: mime, data: 'data:' + mime + ';base64,' + btoa(bin) };
    }
    function rebuild() {
      for (const k of ['badge', 'word']) {
        for (const id in urls[k]) if (urls[k][id].startsWith('blob:')) URL.revokeObjectURL(urls[k][id]);
        urls[k] = {};
        for (const id in set[k]) { const it = set[k][id]; urls[k][id] = it.data.startsWith('data:') ? it.data : URL.createObjectURL(new Blob([it.data], { type: it.type })); }
      }
      refreshIcons();
    }
    async function init() {
      rebuild();
      acc = await Account; if (!acc) return;
      try {
        const snaps = await Promise.all(['badge', 'word'].map(k => acc.db.doc('data/users/' + acc.uid + '/icons-' + k).get()));
        const got = snaps.map(sn => sn.exists ? ((sn.data() || {}).items || {}) : null);
        if (got[0] || got[1]) { set = { badge: { ...(got[0] || {}) }, word: { ...(got[1] || {}) } }; store.set(LS, set); rebuild(); }
        else if (has()) await sync();
      } catch (e) { /* the browser copy stays */ }
    }
    function sync() {
      store.set(LS, set);
      if (!acc) return Promise.resolve();
      chain = chain.then(async () => {
        for (const k of ['badge', 'word']) {
          const body = { items: set[k], updated: Date.now() };
          if (JSON.stringify(body).length > 240000) { toast('These icons are too large to keep in your account — saved in this browser'); continue; }
          await acc.db.doc('data/users/' + acc.uid + '/icons-' + k).set(body);
        }
      }).catch(e => { console.warn('icon sync', e); toast('Icons saved in this browser only — account sync failed'); });
      return chain;
    }
    async function load(files) {
      const items = [];
      try {
        for (const f of files) {
          const buf = await f.arrayBuffer();
          if (/\.zip$/i.test(f.name) || /zip/.test(f.type)) for (const e of await IO.readZip(buf, 60 * 1024 * 1024)) items.push({ path: e.name, data: e.data });
          else items.push({ path: f.name, data: new Uint8Array(buf) });
        }
      } catch (e) { toast('Could not read that file: ' + e.message, 5000); return; }
      return loadItems(items);
    }
    async function loadItems(items, quiet) {
      const next = { badge: { ...set.badge }, word: { ...set.word } }; let nb = 0, nw = 0;
      for (const it of items) {
        const id = simFor(it.path); if (!id) continue;
        const v = toItem(it.path, it.data); if (!v) continue;
        const k = kindFor(it.path); next[k][id] = v; if (k === 'badge') nb++; else nw++;
      }
      if (!nb && !nw) {
        if (!quiet) {
          const names = items.slice(0, 3).map(it => it.path.split('/').pop()).join(', ');
          toast(`No simulation icons found${names ? ' (saw ' + names + (items.length > 3 ? '…' : '') + ')' : ''} — name each file after its simulation, e.g. 04-classic-chrome.svg`, 6000);
        }
        return;
      }
      set = next; rebuild(); await sync();
      toast(`Loaded ${nb} icon${nb === 1 ? '' : 's'}${nw ? ` and ${nw} wordmark${nw === 1 ? '' : 's'}` : ''} · ${acc ? 'saved to your account' : 'saved in this browser'}`, 3500);
    }
    async function clear() { set = { badge: {}, word: {} }; rebuild(); await sync(); toast('Icons removed'); }
    function has() { return Object.keys(set.badge).length + Object.keys(set.word).length > 0; }
    return { init, load, loadItems, clear, has, isIcon: p => !!simFor(p), url: (k, id) => urls[k][id] || null };
  })();
  // dark artwork on the dark UI gets a light backing so it stays readable
  function tuneIcon(img) {
    img.onload = () => {
      try {
        const w = 96, h = Math.max(1, Math.round(96 * img.naturalHeight / Math.max(1, img.naturalWidth)));
        const c = document.createElement('canvas'); c.width = w; c.height = Math.min(h, 400);
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height).data; let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
        img.classList.toggle('chip', n > 0 && sum / n < 105);
      } catch (e) { img.classList.add('chip'); }
    };
  }
  function refreshIcons() {
    $$('.sim').forEach(b => {
      const u = Icons.url('badge', b.dataset.id), im = b.querySelector('img.sbadge'); if (!im) return;
      if (u) { if (im.getAttribute('src') !== u) im.src = u; im.hidden = false; b.classList.add('hasb'); } else { im.hidden = true; im.removeAttribute('src'); b.classList.remove('hasb'); }
    });
    $('#iconsClear') && ($('#iconsClear').hidden = !Icons.has());
    $('#addIcons') && ($('#addIcons').hidden = Icons.has());
    syncUI();
  }


  /* ---------- memory: close the tool and carry on later. Your edits (settings, per-photo tweaks, crops, masks)
     are saved to your account as you work; the photos themselves stay in this browser, never uploaded.
     Import a photo again on another day — or on another computer — and its edits come back. ---------- */
  const Memory = (() => {
    const LS_SESSION = 'filmlab.session.v1';
    let idbP = null, timer = 0, sessJ = '', status = '';
    const saved = {};
    const mkey = ph => ph.name + '|' + (ph.file ? ph.file.size : 0);
    const hash = str => {
      let a = 0x811c9dc5, b = 0x9e3779b1;
      for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 13); }
      return (a >>> 0).toString(36) + (b >>> 0).toString(36);
    };
    function idb() {
      return idbP || (idbP = new Promise(res => {
        try {
          const r = indexedDB.open('filmlab-memory', 1);
          r.onupgradeneeded = () => { const d = r.result; for (const n of ['photos', 'kv']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
          r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
        } catch (e) { res(null); }
      }));
    }
    async function op(store, mode, fn) {
      const d = await idb(); if (!d) return null;
      return new Promise(res => {
        try { const t = d.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && 'result' in q ? q.result : true); t.onerror = t.onabort = () => res(null); }
        catch (e) { res(null); }
      });
    }
    const get = (st, k) => op(st, 'readonly', s => s.get(k)), put = (st, k, v) => op(st, 'readwrite', s => s.put(v, k));
    const del = (st, k) => op(st, 'readwrite', s => s.delete(k)), keys = st => op(st, 'readonly', s => s.getAllKeys());
    const docOf = (a, name) => a.db.doc('data/users/' + a.uid + '/' + name);
    const recOf = ph => ({ n: ph.name, adj: ph.adj || {}, crop: ph.crop || {}, fit: ph.fit || null, focus: ph.focus || null, masks: ph.masks || [] });
    function setStatus(st) {
      status = st; const el = $('#saveState'); if (!el) return;
      el.hidden = !photos.length && st !== 'saving';
      el.textContent = st === 'saving' ? 'Saving…' : st === 'local' ? 'Saved in this browser' : st === 'saved' ? 'All changes saved' : '';
      el.className = 'savest ' + st;
    }
    function save(now) {
      if (!booted) return; clearTimeout(timer);
      if (now) { flush(); return; }
      timer = setTimeout(flush, 1000); if (photos.length) setStatus('saving');
    }
    // leaving or hiding the page saves at once (this browser's copy is written synchronously)
    const leave = () => { if (booted && timer) { clearTimeout(timer); timer = 0; flush(); } };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
    async function flush() {
      timer = 0;
      const sess = { v: 1, G: { ...G }, cur, keys: photos.map(mkey), names: photos.map(p => p.name) }, jobs = [];
      const sj = JSON.stringify(sess);
      if (sj !== sessJ) { sessJ = sj; const full = { ...sess, t: Date.now() }; store.set(LS_SESSION, full); jobs.push(['fl-session', full]); }
      for (const ph of photos) {
        if (ph.pending) continue;          // never overwrite a photo's saved edits before they are read back
        const k = mkey(ph), rec = recOf(ph), j = JSON.stringify(rec);
        if (saved[k] === j) continue;
        saved[k] = j; const full = { ...rec, t: Date.now() };
        put('kv', 'e:' + k, full);
        jobs.push(['fle-' + hash(k), full]);
      }
      if (!jobs.length) { setStatus(status === 'saving' ? 'saved' : status); return; }
      const a = await Account; let ok = !!a;
      if (a) for (const [name, body] of jobs) { try { await docOf(a, name).set(JSON.parse(JSON.stringify(body))); } catch (e) { ok = false; console.warn('memory', e); } }
      setStatus(ok ? 'saved' : 'local');
    }
    // edits for photos that were just imported: this browser first, then your account
    async function restore(list) {
      const a = await Promise.race([Account, new Promise(r => setTimeout(() => r(null), 4000))]);
      const recs = await Promise.all(list.map(async ph => {
        const k = mkey(ph); let rec = await get('kv', 'e:' + k);
        if (!rec && a) { try { const sn = await docOf(a, 'fle-' + hash(k)).get(); rec = sn.exists ? sn.data() : null; } catch (e) { /* offline */ } }
        return rec;
      }));
      let n = 0;
      list.forEach((ph, i) => {
        const r = recs[i]; if (!r) return;
        ph.adj = r.adj || {}; ph.crop = r.crop || {}; ph.fit = r.fit || undefined; ph.focus = r.focus || null; ph.masks = Array.isArray(r.masks) ? r.masks : [];
        saved[mkey(ph)] = JSON.stringify(recOf(ph));
        if (Object.keys(ph.adj).length || Object.keys(ph.crop).length || ph.fit || ph.masks.length) n++;
      });
      list.forEach(ph => { delete ph.pending; });
      return n;
    }
    // the photos of this session stay in the browser so you can continue with one click
    async function keep(list) {
      for (const ph of list) if (ph.file) await put('photos', mkey(ph), ph.file);
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* optional */ }
    }
    const forget = ph => del('photos', mkey(ph));
    async function lastSession() {
      let s = store.get(LS_SESSION, null);
      const a = await Promise.race([Account, new Promise(r => setTimeout(() => r(null), 5000))]);
      if (a) {
        try { const sn = await docOf(a, 'fl-session').get(); const rs = sn.exists ? sn.data() : null; if (rs && (!s || (rs.t || 0) > (s.t || 0))) { s = rs; store.set(LS_SESSION, rs); } }
        catch (e) { /* offline */ }
      }
      return s;
    }
    function applyG(g) {
      if (!g) return;
      for (const k in g) if (k in DEF && typeof g[k] === typeof DEF[k] && (k !== 'sim' || SIMBY[g[k]] || !SIMS.length)) G[k] = g[k];
    }
    let booted = false;
    async function init() {
      const local = store.get(LS_SESSION, null);
      if (local && local.G && !photos.length) { applyG(local.G); sessJ = ''; syncUI(); }
      booted = true;
      const s = await lastSession();
      if (s && s !== local && s.G && !photos.length) { applyG(s.G); syncUI(); renderMain(); }
      await showResume(s);
    }
    async function showResume(s) {
      const box = $('#resume'); if (!box) return;
      s = s || store.get(LS_SESSION, null);
      if (!s || !s.keys || !s.keys.length || photos.length) { box.hidden = true; return; }
      const have = new Set((await keys('photos')) || []), n = s.keys.filter(k => have.has(k)).length;
      const when = s.t ? new Date(s.t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      box.innerHTML = n
        ? `<div><b>Continue where you left off</b><small>${s.keys.length} photo${s.keys.length === 1 ? '' : 's'}${when ? ' · ' + esc(when) : ''}, with all their edits</small></div><button class="btn primary" id="resumeGo">Continue</button><button class="btn" id="resumeNew" title="Start with an empty batch — edits stay saved and come back if you import those photos again">New session</button>`
        : `<div><b>Your last session: ${s.keys.length} photo${s.keys.length === 1 ? '' : 's'}</b><small>They aren't kept in this browser. Import them again and their edits come back.</small></div>`;
      box.hidden = false;
      const go = $('#resumeGo'), nw = $('#resumeNew');
      if (go) go.onclick = () => resume(s);
      if (nw) nw.onclick = async () => { await op('photos', 'readwrite', st => st.clear()); box.hidden = true; store.set(LS_SESSION, { ...s, keys: [], names: [], t: Date.now() }); sessJ = ''; save(); };
    }
    async function resume(s) {
      $('#resume').hidden = true;
      const files = [];
      for (const k of s.keys) {
        const f = await get('photos', k); if (!f) continue;
        files.push(f instanceof File ? f : new File([f], k.split('|')[0], { type: 'image/jpeg' }));
      }
      if (!files.length) { toast('Those photos are no longer in this browser — import them again and their edits come back', 5000); return; }
      await addFiles(files);
      if (s.cur != null && photos[s.cur]) select(s.cur);
      if (files.length < s.keys.length) toast(`${s.keys.length - files.length} photo${s.keys.length - files.length === 1 ? ' was' : 's were'} not in this browser — import ${s.keys.length - files.length === 1 ? 'it' : 'them'} again to get the edits back`, 5000);
    }
    // a session file: every edit of this batch, to open on another device or browser
    async function exportSession() {
      if (!photos.length) { toast('Add photos first — a session file keeps the edits of the photos you are working on'); return; }
      const body = { app: 'Film Lab', kind: 'session', version: 1, saved: new Date().toISOString(), G: { ...G }, cur,
        photos: photos.map(ph => ({ key: mkey(ph), name: ph.name, adj: ph.adj || {}, crop: ph.crop || {}, fit: ph.fit || null, focus: ph.focus || null, masks: ph.masks || [] })) };
      const d = new Date(), p2 = n => String(n).padStart(2, '0');
      const name = `FilmLab session ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}-${p2(d.getMinutes())} (${photos.length} photo${photos.length === 1 ? '' : 's'}).json`;
      try { await saveFile(name, new Blob([JSON.stringify(body)], { type: 'application/json' })); toast('Session file saved'); }
      catch (e) { if (!(e && e.code === 'declined')) toast(saveErr(e && e.code)); }
    }
    async function importSession(f) {
      let j;
      try { j = JSON.parse(await f.text()); } catch (e) { j = null; }
      if (!j || j.kind !== 'session' || !Array.isArray(j.photos)) { toast('That file isn\'t a Film Lab session'); return; }
      applyG(j.G);
      let now = 0;
      for (const r of j.photos) {
        if (!r || typeof r.key !== 'string') continue;
        const rec = { n: String(r.name || ''), adj: r.adj && typeof r.adj === 'object' ? r.adj : {}, crop: r.crop && typeof r.crop === 'object' ? r.crop : {},
          fit: r.fit || null, focus: r.focus || null, masks: Array.isArray(r.masks) ? r.masks : [], t: Date.now() };
        await put('kv', 'e:' + r.key, rec);              // waits here for the same photos to be imported
        const ph = photos.find(p => mkey(p) === r.key);
        if (ph) { ph.adj = rec.adj; ph.crop = rec.crop; ph.fit = rec.fit || undefined; ph.focus = rec.focus; ph.masks = rec.masks; saved[r.key] = ''; now++; }
      }
      const keysL = j.photos.filter(r => r && typeof r.key === 'string');
      if (!photos.length) store.set(LS_SESSION, { v: 1, G: { ...G }, cur: j.cur || 0, keys: keysL.map(r => r.key), names: keysL.map(r => String(r.name || '')), t: Date.now() });
      sessJ = '';
      markAdj(); syncUI(); renderMaskPanel(); renderMain(); scheduleThumbs(); scheduleHist(); Match.ensure(); save();
      if (!photos.length) showResume();
      toast(now ? `Session opened · edits applied to ${now} photo${now === 1 ? '' : 's'}`
        : `Session opened · import its ${keysL.length} photo${keysL.length === 1 ? '' : 's'} and their edits come back`, 5000);
    }
    return { init, save, restore, keep, forget, showResume, exportSession, importSession, get status() { return status; } };
  })();

  /* ---------- look match: an adaptive preset. Each photo is analysed after the film look and gets its own
     corrections (exposure, white balance, tone curve, colour by hue) that move it toward the statistics of a
     reference set — rather than one fixed filter for every photo. ---------- */
  const Match = (() => {
    const TAU = 6.283185307, HC = [0.506, 1.047, 1.833, 2.478, 3.403, 4.538, 5.149, 5.760];
    const Q = [0.5, 1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99.5];
    const S2L = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const v = i / 255; S2L[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const adiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
    const REFS = {
      tokyo: {
        name: 'Tokyo',
        // fingerprint of the nine Tokyo reference photos: tone percentiles (OKLab L) and mid-tone colourfulness per photo,
        // and the tint of their near-neutral greys
        ref: {"q":[[0.122,0.139,0.154,0.176,0.204,0.238,0.272,0.3,0.323,0.346,0.37,0.413,0.521,0.617,0.926,0.996],[0.067,0.067,0.067,0.113,0.142,0.181,0.193,0.214,0.24,0.271,0.314,0.414,0.503,0.605,0.738,0.853],[0.096,0.106,0.115,0.135,0.161,0.201,0.227,0.246,0.275,0.304,0.347,0.412,0.527,0.627,0.813,0.84],[0.067,0.079,0.085,0.085,0.107,0.141,0.166,0.198,0.262,0.38,0.517,0.663,0.82,0.893,0.944,0.974],[0.118,0.128,0.134,0.144,0.156,0.182,0.22,0.282,0.376,0.503,0.677,0.795,0.953,0.997,1,1],[0.085,0.085,0.085,0.097,0.127,0.156,0.189,0.241,0.318,0.45,0.629,0.821,0.937,0.98,0.997,1],[0.085,0.097,0.107,0.125,0.147,0.174,0.194,0.211,0.225,0.246,0.29,0.389,0.706,0.962,0.997,1],[0,0,0,0.067,0.067,0.142,0.424,0.583,0.598,0.607,0.613,0.652,0.792,0.811,0.828,0.838],[0.115,0.122,0.134,0.156,0.187,0.258,0.342,0.406,0.461,0.525,0.577,0.633,0.711,0.805,0.867,0.919]],"cq":[[0.02,0.043,0.075,0.105],[0.007,0.01,0.02,0.032],[0.021,0.039,0.072,0.093],[0.017,0.055,0.089,0.114],[0.01,0.017,0.032,0.05],[0.02,0.04,0.057,0.069],[0.017,0.025,0.045,0.081],[0.05,0.055,0.057,0.059],[0.017,0.031,0.067,0.123]],"nt":[-0.001,0.011]},
        // the look's own colour character: warm hues keep their richness, cool hues and dull colours are muted,
        // the most saturated colours roll off like film
        look: { vib: -15, roll: 40, s0: 5, s1: 15, s2: 10, s3: -10, s4: -18, s5: -22, s6: -15, s7: -5 },
      },
    };
    const CFG = {
      lg: 240,                                   // analysis size (long edge)
      keyMin: 0.24, dk0: 0.03, dk1: 0.30, dkP: 0.40, evMin: -0.8, evMax: 0.5,   // exposure: a moodier key
      ntC: 0.03, ntMin: 0.01, wb: 0.5, tMax: 30, nMax: 20,                      // white balance from near-neutral greys
      kSig: 0.08, dMax: 0.12, lam: 0.015, thMax: 0.8,                            // tone curve
      alpha: [0.6, 0.6, 0.55, 0.5, 0.45, 0.35, 0.25, 0.15, 0, 0.15, 0.25, 0.3, 0.4, 0.45, 0.5, 0.5],
      cAlpha: 0.2, satMin: -20, satMax: 10,                                     // overall colourfulness (gentle: colour is mostly content)
    };

    function lab(px) {
      const n = px.length >> 2, L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
      for (let i = 0, j = 0; j < n; i += 4, j++) {
        const r = S2L[px[i]], g = S2L[px[i + 1]], b = S2L[px[i + 2]];
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        L[j] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s; A[j] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s; B[j] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
      }
      return { n, L, A, B };
    }
    function pct(L) { const s = Float32Array.from(L).sort(), n = s.length; return Q.map(p => s[Math.min(n - 1, Math.round(p / 100 * (n - 1)))]); }
    function bandSums(X) {
      const W = new Float64Array(8), ZR = new Float64Array(8), ZI = new Float64Array(8), CW = new Float64Array(8), LW = new Float64Array(8);
      for (let j = 0; j < X.n; j++) {
        const a = X.A[j], b = X.B[j], C = Math.hypot(a, b); if (C <= 0.015) continue;
        const gt = sstep(0.015, 0.06, C); let h = Math.atan2(b, a); if (h < 0) h += TAU;
        for (let k = 0; k < 8; k++) {
          let d = Math.abs(h - HC[k]); d = Math.min(d, TAU - d); if (d >= 0.8639) continue;
          const c = Math.cos(d / 0.55), w = c * c * gt;
          W[k] += w; ZR[k] += w * a; ZI[k] += w * b; CW[k] += w * C; LW[k] += w * X.L[j];
        }
      }
      return { n: X.n, W, ZR, ZI, CW, LW };
    }
    function bands(S, imgs) {
      const out = [];
      for (let k = 0; k < 8; k++) out.push(S.W[k] > 1e-6 ? { cov: S.W[k] / S.n, h: (Math.atan2(S.ZI[k], S.ZR[k]) + TAU) % TAU, C: S.CW[k] / S.W[k], L: S.LW[k] / S.W[k], imgs: imgs ? imgs[k] : 1 } : null);
      return out;
    }
    function neutralIdx(X) {
      const idx = [];
      for (let j = 0; j < X.n; j++) { const L = X.L[j]; if (L > 0.3 && L < 0.96 && Math.hypot(X.A[j], X.B[j]) < CFG.ntC) idx.push(j); }
      return idx;
    }
    function meanAB(X, idx) { let a = 0, b = 0; for (const j of idx) { a += X.A[j]; b += X.B[j]; } return [a / idx.length, b / idx.length]; }
    const CQ = [50, 75, 90];
    function chromaQ(X) {      // colourfulness of the mid-tones (deep shadows and blown highlights carry no colour)
      const C = []; for (let j = 0; j < X.n; j++) { const L = X.L[j]; if (L > 0.15 && L < 0.92) C.push(Math.hypot(X.A[j], X.B[j])); }
      if (C.length < 50) return CQ.map(() => 0.02);
      C.sort((a, b) => a - b); return CQ.map(p => C[Math.min(C.length - 1, Math.round(p / 100 * (C.length - 1)))]);
    }

    // reference fingerprint: tone percentiles per image, neutral tint, pooled colour per hue band
    function fingerprint(pxList) {
      const q = [], cq = [], nts = [], pool = { n: 0, W: new Float64Array(8), ZR: new Float64Array(8), ZI: new Float64Array(8), CW: new Float64Array(8), LW: new Float64Array(8) }, imgs = new Array(8).fill(0);
      for (const px of pxList) {
        const X = lab(px); q.push(pct(X.L)); cq.push(chromaQ(X));
        const idx = neutralIdx(X); if (idx.length > X.n * 0.01) nts.push(meanAB(X, idx));
        const S = bandSums(X);
        for (let k = 0; k < 8; k++) {
          pool.W[k] += S.W[k] / S.n; pool.ZR[k] += S.ZR[k] / S.n; pool.ZI[k] += S.ZI[k] / S.n; pool.CW[k] += S.CW[k] / S.n; pool.LW[k] += S.LW[k] / S.n;
          if (S.W[k] / S.n > 0.01) imgs[k]++;
        }
      }
      pool.n = pxList.length;
      const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
      const r3 = x => Math.round(x * 1000) / 1000;
      return { q: q.map(a => a.map(r3)), cq: cq.map(a => a.map(r3)), nt: [r3(med(nts.map(x => x[0]))), r3(med(nts.map(x => x[1])))], bands: bands(pool, imgs).map(b => b && b.imgs ? { h: r3(b.h), C: r3(b.C), L: r3(b.L), cov: r3(b.cov), imgs: b.imgs } : null) };
    }

    function render(ph, s) {
      const lg = CFG.lg, land = ph.w >= ph.h;
      const w = land ? lg : Math.max(8, Math.round(lg * ph.w / ph.h)), h = land ? Math.max(8, Math.round(lg * ph.h / ph.w)) : lg;
      return lab(engine.quick(ph.thumb, params(s, ph), w, h));
    }
    // the theme on its own, as it renders with every slider at its default: the correction depends on the photo only
    function baseOf(ph, id) { return { ...DEF, sim: id, hdr: eff(ph).hdr, _nomatch: 1 }; }
    const T = (base, v) => Object.assign({ ...base }, v);
    const P0 = 0.565;
    const basis = x => {
      const u = clamp((x - P0) / (1 - P0), 0, 1), w = clamp(x / P0, 0, 1);
      return [1.6 * x * (x - P0) * (1 - x), 0.64 * u * (1 - u) * (1 - P0), 0.64 * w * (1 - w) * P0, 0.12 * x * x * x, 0.10 * (1 - x) ** 3];
    };
    function lsq(rows, rhs, wts, lam, lo, hi) {   // small weighted ridge least squares with box limits (clamp + re-solve)
      const n = rows[0].length, fixed = new Array(n).fill(null);
      for (let pass = 0; pass < 3; pass++) {
        const A = Array.from({ length: n }, () => new Float64Array(n + 1));
        for (let r = 0; r < rows.length; r++) {
          let res = rhs[r]; for (let i = 0; i < n; i++) if (fixed[i] != null) res -= rows[r][i] * fixed[i];
          for (let i = 0; i < n; i++) { if (fixed[i] != null) continue; for (let j = 0; j < n; j++) if (fixed[j] == null) A[i][j] += wts[r] * rows[r][i] * rows[r][j]; A[i][n] += wts[r] * rows[r][i] * res; }
        }
        for (let i = 0; i < n; i++) { A[i][i] += lam; if (fixed[i] != null) { A[i].fill(0); A[i][i] = 1; A[i][n] = fixed[i]; } }
        for (let c = 0; c < n; c++) {             // Gauss-Jordan
          let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
          [A[c], A[p]] = [A[p], A[c]]; const d = A[c][c] || 1e-12;
          for (let j = c; j <= n; j++) A[c][j] /= d;
          for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let j = c; j <= n; j++) A[r][j] -= f * A[c][j]; }
        }
        const x = A.map(r => r[n]); let again = false;
        for (let i = 0; i < n; i++) if (fixed[i] == null && (x[i] < lo || x[i] > hi)) { fixed[i] = clamp(x[i], lo, hi); again = true; }
        if (!again) return x.map((v, i) => fixed[i] != null ? fixed[i] : v);
      }
      return fixed.map(v => v || 0);
    }

    function solve(ph, id) {
      const R = REFS[id].ref, c = CFG, v = {}, base = baseOf(ph, id), info = {};
      // A. exposure — a moodier key, darker for bright, flat phone frames
      let X = render(ph, base), q = pct(X.L);
      const m0 = q[8], mt = Math.max(Math.min(m0, c.keyMin), m0 - c.dk0 - c.dk1 * Math.max(0, m0 - c.dkP));
      info.m0 = m0; info.mt = mt;
      if (Math.abs(mt - m0) > 0.004) {
        let e0 = 0, l0 = m0, e1 = -0.5, l1 = pct(render(ph, T(base, { ev: e1 })).L)[8];
        for (let it = 0; it < 2 && Math.abs(l1 - l0) > 1e-4; it++) {
          const e2 = clamp(e1 + (mt - l1) * (e1 - e0) / (l1 - l0), c.evMin, c.evMax);
          e0 = e1; l0 = l1; e1 = e2; l1 = pct(render(ph, T(base, { ev: e1 })).L)[8];
        }
        v.ev = e1;
      }
      // B. white balance — near-neutral greys toward the reference tint (gently: scene colour is part of the photo)
      X = render(ph, T(base, v));
      const idx = neutralIdx(X);
      if (idx.length > X.n * c.ntMin) {
        const ab0 = meanAB(X, idx), want = [c.wb * (R.nt[0] - ab0[0]), c.wb * (R.nt[1] - ab0[1])], st = 15;
        const dT = meanAB(render(ph, T(base, { ...v, temp: st })), idx).map((x, i) => (x - ab0[i]) / st);
        const dN = meanAB(render(ph, T(base, { ...v, tint: st })), idx).map((x, i) => (x - ab0[i]) / st);
        const det = dT[0] * dN[1] - dT[1] * dN[0];
        info.nt = ab0;
        if (Math.abs(det) > 1e-10) {
          v.temp = clamp((want[0] * dN[1] - want[1] * dN[0]) / det, -c.tMax, c.tMax);
          v.tint = clamp((dT[0] * want[1] - dT[1] * want[0]) / det, -c.nMax, c.nMax);
        }
      }
      // C. tone curve — blacks, shadows and highlights toward references of a similar key
      X = render(ph, T(base, v)); q = pct(X.L);
      const Rq = Q.map(() => 0); let ws = 0;
      R.q.forEach(rq => { const w = Math.exp(-(((rq[8] - q[8]) / c.kSig) ** 2)) + 1e-6; ws += w; rq.forEach((x, i) => { Rq[i] += w * x; }); });
      const clipped = q[15] > 0.985, rows = [], rhs = [], wts = [];
      q.forEach((x, i) => {
        const a = c.alpha[i] * (clipped && i >= 14 ? 0.3 : 1);
        rows.push(basis(x)); rhs.push(clamp(a * (Rq[i] / ws - x), -c.dMax, c.dMax)); wts.push(i === 8 ? 3 : 1);
      });
      const th = lsq(rows, rhs, wts, c.lam, -c.thMax, c.thMax);
      ['contrast', 'hl', 'sh', 'whites', 'blacks'].forEach((k, i) => { v[k] = th[i] * 100; });
      info.q = q; info.Rq = Rq.map(x => x / ws);
      // D. colour — the look's own colour character (warm hues kept, cool hues and dull colours muted),
      //    then overall colourfulness pulled toward references of a similar key
      const look = REFS[id].look || {};
      for (const k in look) v[k] = look[k];
      X = render(ph, T(base, v));
      const cq = chromaQ(X), Rc = CQ.map(() => 0); let wc = 0;
      R.q.forEach((rq, r) => { const w = Math.exp(-(((rq[8] - q[8]) / c.kSig) ** 2)) + 1e-6; wc += w; R.cq[r].forEach((x, i) => { Rc[i] += w * Math.log(Math.max(x, 1e-3)); }); });
      let dl = 0; cq.forEach((x, i) => { dl += (Rc[i] / wc - Math.log(Math.max(x, 1e-3))) / cq.length; });
      v.sat = clamp((Math.exp(c.cAlpha * dl) - 1) * 100, c.satMin, c.satMax);
      info.cq = cq; info.Rc = Rc.map(x => Math.exp(x / wc));
      const out = {};
      for (const k in v) { const r = k === 'ev' ? Math.round(v[k] * 100) / 100 : Math.round(v[k] * 10) / 10; if (r) out[k] = r; }
      return { v: out, info };
    }

    // Adaptive for the Fujifilm simulations — what a careful photographer sets per shot: exposure, white balance and
    // shadow tone, worked out once per photo on neutral PROVIA. They act before the simulation, so each one keeps its look.
    const ACFG = { keyHi: 0.58, keyLo: 0.34, pullHi: 0.5, pullLo: 0.3, evMin: -0.7, evMax: 0.4, wb: 0.6, nt: [0, 0.006], tMax: 25, nMax: 15, black: 0.085, bPull: 0.5, shMax: 2 };
    function solveAuto(ph) {
      const c = ACFG, v = {}, base = { ...DEF, sim: 'provia', hdr: eff(ph).hdr, _nomatch: 1 };
      // exposure: bright, flat phone frames come down toward a camera's key; dark frames come up a little
      const m0 = pct(render(ph, base).L)[8];
      const mt = m0 > c.keyHi ? m0 - c.pullHi * (m0 - c.keyHi) : m0 < c.keyLo ? m0 + c.pullLo * (c.keyLo - m0) : m0;
      if (Math.abs(mt - m0) > 0.005) {
        let e0 = 0, l0 = m0, e1 = mt < m0 ? -0.4 : 0.3, l1 = pct(render(ph, T(base, { ev: e1 })).L)[8];
        for (let it = 0; it < 2 && Math.abs(l1 - l0) > 1e-4; it++) {
          const e2 = clamp(e1 + (mt - l1) * (e1 - e0) / (l1 - l0), c.evMin, c.evMax);
          e0 = e1; l0 = l1; e1 = e2; l1 = pct(render(ph, T(base, { ev: e1 })).L)[8];
        }
        v.ev = e1;
      }
      // white balance: near-neutral greys toward a camera's slightly warm neutral
      let X = render(ph, T(base, v));
      const idx = neutralIdx(X);
      if (idx.length > X.n * 0.01) {
        const ab0 = meanAB(X, idx), want = [c.wb * (c.nt[0] - ab0[0]), c.wb * (c.nt[1] - ab0[1])], st = 15;
        const dT = meanAB(render(ph, T(base, { ...v, temp: st })), idx).map((x, i) => (x - ab0[i]) / st);
        const dN = meanAB(render(ph, T(base, { ...v, tint: st })), idx).map((x, i) => (x - ab0[i]) / st);
        const det = dT[0] * dN[1] - dT[1] * dN[0];
        if (Math.abs(det) > 1e-10) {
          v.temp = clamp((want[0] * dN[1] - want[1] * dN[0]) / det, -c.tMax, c.tMax);
          v.tint = clamp((dT[0] * want[1] - dT[1] * want[0]) / det, -c.nMax, c.nMax);
        }
      }
      // shadows: phone HDR lifts them — deepen halfway toward where a camera puts the darkest tones (never lift)
      const p1 = pct(render(ph, T(base, v)).L)[1];
      if (p1 > c.black + 0.01) {
        const want = p1 - c.bPull * (p1 - c.black), q1 = pct(render(ph, T(base, { ...v, shadow: 1 })).L)[1];
        if (q1 < p1 - 1e-4) v.shadow = clamp((p1 - want) / (p1 - q1), 0, c.shMax);
      }
      const out = {};
      for (const k in v) { const r = k === 'ev' ? Math.round(v[k] * 100) / 100 : Math.round(v[k] * 10) / 10; if (r) out[k] = r; }
      return out;
    }
    const needAuto = ph => !!eff(ph).adapt && !ph.auto;
    function oneAuto(ph) {
      if (!ph || !needAuto(ph) || !lutReady.provia) return;
      try { ph.auto = solveAuto(ph); } catch (e) { console.error('adaptive', e); }
    }
    const themeOf = ph => (THEMES[eff(ph).sim] && REFS[eff(ph).sim] ? eff(ph).sim : null);
    const has = (ph, id) => !!(ph.match && ph.match[id]);
    function one(ph, id) {                       // analyse one photo now (hover preview, the list thumbnail)
      if (!ph || !REFS[id] || has(ph, id) || !simReady(id)) return;
      try { (ph.match = ph.match || {})[id] = solve(ph, id).v; } catch (e) { console.error('match', e); }
    }
    let chain = Promise.resolve(), running = false;
    const needs = ph => (themeOf(ph) && !has(ph, themeOf(ph)) && simReady(themeOf(ph))) || (needAuto(ph) && lutReady.provia);
    function run(list) {
      chain = chain.then(async () => {
        list = list.filter(ph => photos.includes(ph) && needs(ph));
        if (!list.length) return;
        running = true;
        for (let i = 0; i < list.length; i++) {
          const ph = list[i], id = themeOf(ph);
          if (list.length > 1) busy(`Analysing photo ${i + 1} of ${list.length}`);
          if (id) one(ph, id);
          oneAuto(ph);
          await tick();
        }
        running = false; busy(null); changed(false);
      });
      return chain;
    }
    // every photo gets its correction once: for the theme it shows, and for Adaptive when that is on
    function ensure() { return run(photos.filter(needs)); }
    return { REFS, CFG, ACFG, fingerprint, solve, solveAuto, run, ensure, one, oneAuto, lab, pct, bandSums, bands, get running() { return running; } };
  })();

  /* ---------- presets: your own looks ---------- */
  const Presets = (() => {
    const LS = 'filmlab.presets.v1';
    let list = [], db = null, uid = null, chain = Promise.resolve(), where = 'browser';
    const OLD_TOKYO = { dr: 200, highlight: -1, shadow: 1, cc: 1, ccb: 1, wbB: -3, sharp: -1, grain: 55, bloom: 30 };
    function migrate(p) {
      const st = p && p.s; if (!st || st.match === undefined) return p;
      if (st.match === 'tokyo') { st.sim = 'tokyo'; for (const k in OLD_TOKYO) if (st[k] === OLD_TOKYO[k]) st[k] = DEF[k]; }
      delete st.match; delete st.matchAmt; return p;
    }
    list = store.get(LS, []).map(migrate);
    async function init() {
      try {
        const acc = await Account; if (!acc) return;
        const ref = acc.db.doc('data/users/' + acc.uid + '/filmlab');
        const snap = await Promise.race([ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
        db = acc.db; uid = acc.uid; where = 'account';
        const remote = snap.exists ? ((snap.data() || {}).presets || []) : [];
        if (remote.length) { list = remote.map(p => migrate({ name: p.name, created: p.created, inc: p.inc, s: { ...p.s } })); store.set(LS, list); }
        else if (list.length) await save();
        renderPop();
      } catch (e) { db = null; }
    }
    function save() {
      store.set(LS, list);
      if (!db) return Promise.resolve();
      const body = { presets: list.map(p => ({ name: p.name, created: p.created, inc: p.inc || null, s: p.s })), updated: Date.now() };
      chain = chain.then(() => db.doc('data/users/' + uid + '/filmlab').set(body)).catch(e => { console.warn('preset sync', e); toast('Presets saved in this browser only — account sync failed'); });
      return chain;
    }
    function add(name, incBasic, incOut) {
      name = name.trim().slice(0, 60); if (!name) { toast('Give the preset a name first'); return; }
      const keys = [...LOOK_KEYS, ...(incBasic ? BASIC_KEYS : []), ...(incOut ? OUT_KEYS : [])];
      const s = {}; for (const k of keys) s[k] = G[k];
      const p = { name, created: Date.now(), inc: { basic: !!incBasic, out: !!incOut }, s };
      const i = list.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
      if (i >= 0) list[i] = p; else list.unshift(p);
      save(); renderPop(); toast(`Saved “${name}”`);
    }
    function apply(p, builtIn) {
      let s = p.s;
      if (builtIn) { s = {}; for (const k of FILM_KEYS) s[k] = DEF[k]; Object.assign(s, p.s); }
      const keys = Object.keys(s).filter(k => k in DEF && (p.inc || builtIn ? true : !OUT_KEYS.includes(k)));
      if (scope === 'sel' && photos.length) {
        for (const i of selSet) {
          const ph = photos[i];
          for (const k of keys) {
            const it = SPECK[k]; if (it.g) continue;
            if (it.t === 'sl') { const a = clamp(s[k], it.min, it.max) - G[k]; if (Math.abs(a) < 1e-9) delete ph.adj[k]; else ph.adj[k] = a; }
            else if (s[k] === G[k]) delete ph.adj[k]; else ph.adj[k] = s[k];
          }
        }
        for (const k of keys) if (SPECK[k].g) G[k] = s[k];
        markAdj(); toast(`“${p.name}” applied to ${selSet.size === 1 ? 'this photo' : selSet.size + ' photos'}`);
      } else { for (const k of keys) G[k] = s[k]; toast(`“${p.name}” applied to all photos`); }
      scheduleAutoDR(); changed(false);
      // an adaptive look: analyse the photos it now applies to against the new film settings
      if (keys.includes('sim')) Match.ensure();
    }
    function del(i) { const p = list[i]; list.splice(i, 1); save(); renderPop(); if (p) toast(`Deleted “${p.name}”`); }
    async function download(arr, filename) {
      const blob = new Blob([JSON.stringify({ app: 'Film Lab', version: 3, presets: arr }, null, 1)], { type: 'application/json' });
      try { await saveFile(filename, blob); toast('Preset file saved'); }
      catch (e) { if (!(e && e.code === 'declined')) toast(e && e.code === 'unavailable' ? 'Saving files isn\'t available in this view' : 'The preset file could not be saved'); }
    }
    const safe = s => s.replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'preset';
    function exportOne(i) { const p = list[i]; if (p) download([p], `FilmLab preset - ${safe(p.name)}.json`); }
    function exportAll() { if (!list.length) { toast('No presets to export yet'); return; } download(list, 'FilmLab presets.json'); }
    async function importFile(f) {
      try {
        const j = JSON.parse(await f.text()); const arr = Array.isArray(j) ? j : j.presets;
        if (!Array.isArray(arr)) throw new Error('no presets');
        let n = 0;
        for (const p of arr) {
          if (!p || typeof p.name !== 'string' || !p.s || typeof p.s !== 'object') continue;
          migrate(p);
          const s = {}; for (const k in p.s) if (k in DEF && typeof p.s[k] === typeof DEF[k]) s[k] = p.s[k];
          if (s.sim && !SIMBY[s.sim] && SIMS.length) delete s.sim;
          const q = { name: p.name.slice(0, 60), created: +p.created || Date.now(), inc: p.inc && typeof p.inc === 'object' ? { basic: !!p.inc.basic, out: !!p.inc.out } : undefined, s };
          const i = list.findIndex(x => x.name.toLowerCase() === q.name.toLowerCase());
          if (i >= 0) list[i] = q; else list.push(q); n++;
        }
        save(); renderPop(); toast(`Imported ${n} preset${n === 1 ? '' : 's'}`);
      } catch (e) { toast('That file isn\'t a Film Lab presets file'); }
    }
    function renderPop() {
      const pop = $('#pop'); if (pop.hidden) return;
      const target = scope === 'sel' && photos.length ? (selSet.size > 1 ? `applies to ${selSet.size} selected` : 'applies to this photo') : 'applies to all photos';
      const mine = list.length ? list.map((p, i) => `<div class="pitem"><button class="pa" data-i="${i}" title="Apply “${esc(p.name)}”"><b>${esc(p.name)}</b><small>${esc((SIMBY[p.s.sim] || {}).label || p.s.sim || '')}${p.inc && p.inc.basic ? ' · with Basic' : ''}${p.inc && p.inc.out ? ' · with frame & date' : ''}</small></button><button class="pi px" data-i="${i}" title="Save as a file to share or back up" aria-label="Export ${esc(p.name)}">${IC.down}</button><button class="pi pd" data-i="${i}" title="Delete" aria-label="Delete ${esc(p.name)}">${IC.trash}</button></div>`).join('')
        : '<div class="pempty">No presets yet. Set up a look, name it below and save.</div>';
      pop.innerHTML = `<h4><span>Presets</span><em>${target}</em></h4>
        <div class="pgroup">Your presets</div>
        <div class="plist">${mine}</div>
        <div class="psave"><input id="pname" placeholder="Name this look" maxlength="60"><button class="btn primary" id="psave">Save</button></div>
        <label class="pchk"><input type="checkbox" id="pIncBasic">Include Basic corrections</label>
        <label class="pchk"><input type="checkbox" id="pIncOut">Include frame &amp; date</label>
        <div class="prow"><button class="btn sm" id="pimp">${IC.up}<span>Import file</span></button><button class="btn sm" id="pexp">${IC.down}<span>Export all</span></button></div>
        <div class="pnote">${where === 'account' ? 'Your presets are saved to your account.' : 'Your presets are saved in this browser — export a file as a backup.'}</div>
        <div class="pgroup">Session file<small>Every edit of these photos — open it on another device, then add the same photos</small></div>
        <div class="prow"><button class="btn sm" id="sopen">${IC.up}<span>Open session</span></button><button class="btn sm" id="ssave">${IC.down}<span>Save session</span></button></div>`;
      $$('.pa[data-i]', pop).forEach(b => b.onclick = () => apply(list[+b.dataset.i]));
      $$('.px', pop).forEach(b => b.onclick = () => exportOne(+b.dataset.i));
      $$('.pd', pop).forEach(b => b.onclick = () => { if (b.classList.contains('arm')) del(+b.dataset.i); else { $$('.pd.arm', pop).forEach(x => x.classList.remove('arm')); b.classList.add('arm'); b.title = 'Click again to delete'; } });
      const nm = $('#pname'); nm.addEventListener('keydown', e => { if (e.key === 'Enter') add(nm.value, $('#pIncBasic').checked, $('#pIncOut').checked); e.stopPropagation(); });
      $('#psave').onclick = () => add(nm.value, $('#pIncBasic').checked, $('#pIncOut').checked);
      $('#pexp').onclick = exportAll; $('#pimp').onclick = () => $('#pimport').click();
      $('#ssave').onclick = () => Memory.exportSession(); $('#sopen').onclick = () => $('#sessFile').click();
    }
    function toggle(open) {
      const pop = $('#pop'), btn = $('#presetsBtn');
      const show = open == null ? pop.hidden : open;
      pop.hidden = !show; btn.setAttribute('aria-expanded', String(show));
      if (show) { const r = btn.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(window.innerWidth - 340, r.right - 330)) + 'px'; renderPop(); }
    }
    return { init, toggle, importFile, renderPop, add, apply, get list() { return list; } };
  })();

  /* ---------- export ---------- */
  async function saveFile(filename, blob) {
    const dl = await dlP;
    if (dl) return dl.save({ filename, data: blob });
    if (window.claude) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
    const a = document.createElement('a'), u = URL.createObjectURL(blob);    // a standalone copy: a normal download
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  const saveErr = c => c === 'declined' ? 'Download cancelled.' : c === 'rate_limited' ? 'Another download prompt is open — try again in a moment.'
    : c === 'too_large' ? 'That file is too large for this app. Export fewer sizes at a time.'
    : c === 'unavailable' ? 'Saving files isn\'t available in this view — open Film Lab from its claude.ai page to download.' : 'The download could not be saved here.';
  let expWhich = 'all', expAs = 'zip', expAsTouched = false;
  function segSet(sel, v) { $$(sel + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }
  function buildExportSizes() {
    $('#igs').innerHTML = Compose.SIZES.map(s => `<label class="opt"><input type="checkbox" data-r="${s.id}"><span><b>${s.label} · ${s.w} × ${s.h}</b><small>${s.name}</small></span></label>`).join('');
    $$('#igs input').forEach(c => c.addEventListener('change', () => { if (c.checked) expSizes.add(c.dataset.r); else expSizes.delete(c.dataset.r); summary(); }));
    $('#oOrig').addEventListener('change', summary);
    $$('#oWhich button').forEach(b => b.addEventListener('click', () => { expWhich = b.dataset.v; segSet('#oWhich', expWhich); summary(); }));
    $$('#oAs button').forEach(b => b.addEventListener('click', () => { expAs = b.dataset.v; expAsTouched = true; segSet('#oAs', expAs); summary(); }));
  }
  function summary() {
    const n = expWhich === 'one' ? 1 : photos.length, k = ($('#oOrig').checked ? 1 : 0) + expSizes.size, s = SIMBY[G.sim];
    const per = photos.some(p => p.adj.sim) ? ' (plus per-photo choices)' : '';
    $('#oWhich button[data-v=all]').textContent = `All (${photos.length})`;
    $('#go').textContent = expAs === 'zip' ? 'Export ZIP' : (n * k === 1 ? 'Save photo' : `Save ${n * k} photos`);
    $('#dlgsub').textContent = `${n} photo${n === 1 ? '' : 's'} · ${s ? s.label : ''}${per} · ${k} size${k === 1 ? '' : 's'} → ` +
      (expAs === 'zip' ? `${n * k} files in one ZIP.` : `${n * k} separate JPEG${n * k === 1 ? '' : 's'}${window.claude && n * k > 1 ? ', each one confirmed' : ''}.`);
    const fr = G.frameOn ? (G.frameTo === 'all' ? 'on Instagram and Original' : 'on Instagram only') : 'off';
    const st = G.stampOn ? (G.stampTo === 'all' ? 'on Instagram and Original' : 'on Instagram only') : 'off';
    $('#dlgout').textContent = `Frame: ${fr} · Date stamp: ${st} — change these in the Frame & date tab.`;
  }
  async function encodeOut(px, L, frameRGB, stampDate, q) {
    const c = new OffscreenCanvas(L.W, L.H), x = c.getContext('2d');
    if (L.w !== L.W || L.h !== L.H) { x.fillStyle = frameRGB; x.fillRect(0, 0, L.W, L.H); }
    x.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), L.w, L.h), L.x, L.y);
    if (stampDate) Compose.drawStamp(x, { x: L.x, y: L.y, w: L.w, h: L.h }, stampDate, stampS());
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: q });
    return new Uint8Array(await blob.arrayBuffer());
  }
  function status(msg, cls) { const s = $('#status'); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); }
  function progress(f) { $('#bar').hidden = false; $('#bar i').style.width = Math.round(f * 100) + '%'; }
  function openExport() {
    if (!photos.length) return;
    $$('#igs input').forEach(c => { c.checked = expSizes.has(c.dataset.r); });
    if (!expAsTouched) expAs = MQ.matches ? 'files' : 'zip';   // phones save photos one by one, so they land in the gallery
    segSet('#oWhich', expWhich); segSet('#oAs', expAs);
    summary(); status(''); $('#bar').hidden = true; $('#go').disabled = false; $('#modal').hidden = false;
  }
  async function runExport() {
    const wantO = $('#oOrig').checked, sizes = Compose.SIZES.filter(s => expSizes.has(s.id)), q = +$('#oQ').value;
    if (!wantO && !sizes.length) { status('Choose at least one size.', 'err'); return; }
    const stampO = stampOrig(), frameO = frameOrig();
    exporting = true; cancelReq = false; $('#go').disabled = true; $('#cancel').textContent = 'Cancel';
    const zip = expAs === 'zip' ? new IO.ZipWriter() : null, list = expWhich === 'one' ? [cur] : photos.map((_, i) => i);
    let saved = 0;
    const put = async (path, bytes, date, flat) => {
      if (zip) { zip.add(path, bytes, date); return; }
      status(`Saving ${flat}…`);
      await saveFile(flat, new Blob([bytes], { type: 'image/jpeg' })); saved++;
    };
    const d0 = new Date(), p2 = n => String(n).padStart(2, '0');
    const ds = `${d0.getFullYear()}-${p2(d0.getMonth() + 1)}-${p2(d0.getDate())}`, ts = `${p2(d0.getHours())}.${p2(d0.getMinutes())}`;
    const root = `FilmLab ${ds} ${ts}`;                          // every export gets its own folder
    const total = list.length * ((wantO ? 1 : 0) + sizes.length); let done = 0;
    progress(0);
    try {
      for (const i of list) {
        if (cancelReq) throw new Error('cancelled');
        const ph = photos[i], nn = String(i + 1).padStart(2, '0'), base = ph.name.replace(/\.[^.]+$/, '');
        const fname = `${nn}_${base}.jpg`;
        status(`Developing ${list.indexOf(i) + 1} of ${list.length} · ${ph.name}`);
        await tick();
        let bmp = await decode(ph.file, ph, 0);
        const lim = Math.min(engine.maxTex, 9000);
        if (Math.max(bmp.width, bmp.height) > lim) { bmp.close(); bmp = await decode(ph.file, ph, lim); }
        const W = bmp.width, H = bmp.height;
        const src = engine.texFromBitmap(bmp, false); bmp.close();
        const P = params(eff(ph), ph), seed = i + 7, date = ph.date || new Date();
        const one = async (L, sharp, outKey, stampIt) => {
          const crop = [L.src.x / W, L.src.y / H, L.src.w / W, L.src.h / H];
          const cw = Math.max(1, Math.round(L.src.w)), ch = Math.max(1, Math.round(L.src.h));
          const px = engine.renderTo(src, P, L.w, L.h, { key: 'xcolor', outKey, crop, colorW: cw, colorH: ch, mip: cw > L.w * 1.05, extraSharp: sharp, seed });
          return encodeOut(px, L, G.frameColor, stampIt ? ph.date : null, q);
        };
        if (wantO) {
          const L = frameO ? Compose.layout(W, H, W, H, frameS(), 'fill', cropFor(ph, 'orig'))
            : { W, H, x: 0, y: 0, w: W, h: H, src: { x: 0, y: 0, w: W, h: H } };
          let bytes = await one(L, 0, 'xout', stampO);
          bytes = IO.withExif(bytes, ph.info.exif, ph.info.exifOrientationAt, ph.info.exifLE);
          await put(`${root}/Original/${fname}`, bytes, date, `FilmLab_${nn}_${base}.jpg`);
          progress(++done / total); await tick();
        }
        for (const S of sizes) {
          if (cancelReq) { engine.deleteTex(src); throw new Error('cancelled'); }
          const L = Compose.layout(S.w, S.h, W, H, frameS(), fitOf(ph), cropFor(ph, S.id));
          const bytes = await one(L, 0.35, 'xig', !!G.stampOn);
          await put(`${root}/Instagram ${S.label.replace(':', 'x')}/${fname}`, bytes, date, `FilmLab_${nn}_${base}_IG-${S.label.replace(':', 'x')}.jpg`);
          progress(++done / total); await tick();
        }
        engine.deleteTex(src);
      }
      ['xcolor', 'xout', 'xig', 'blurA', 'blurB'].forEach(k => engine.releaseRT(k));
      if (!zip) { status(`Saved ${saved} photo${saved === 1 ? '' : 's'}.`, 'ok'); return; }
      const blob = zip.finish();
      const zname = `FilmLab_${ds}_${ts.replace('.', '-')}_${list.length}photos.zip`;
      status(`${list.length} photo${list.length === 1 ? '' : 's'} packed · ${(blob.size / 1048576).toFixed(1)} MB. Confirm the download…`);
      window.__lastExport = { blob, fname: zname };
      try { await saveFile(zname, blob); status(`Saved ${zname}`, 'ok'); }
      catch (e) { status(saveErr(e && e.code), 'err'); }
    } catch (e) {
      ['xcolor', 'xout', 'xig'].forEach(k => engine.releaseRT(k));
      if (e.message === 'cancelled') status('Export cancelled.');
      else if (e && e.code) status((saved ? `Saved ${saved}, then: ` : '') + saveErr(e.code), 'err');
      else { console.error(e); status('Export failed: ' + e.message, 'err'); }
    } finally { exporting = false; $('#go').disabled = false; $('#cancel').textContent = 'Close'; }
  }

  /* ---------- phones: a bottom tool bar opens one sheet at a time — Films, or one settings tab ---------- */
  const Mobile = (() => {
    const app = $('#app'), bar = $('#mtabs');
    const short = { basic: 'Basic', film: 'Film', fx: 'FX', mask: 'Masks', out: 'Frame' };
    let sheet = 'films', built = false;
    function build() {
      if (built) return; built = true;
      bar.innerHTML = `<button role="tab" data-t="films" aria-selected="true">${IC.roll}<span>Films</span><i class="tdot"></i></button>` +
        TABS.map(T => `<button role="tab" data-t="${T.id}" aria-selected="false">${IC[T.icon]}<span>${short[T.id] || T.label}</span><i class="tdot"></i></button>`).join('');
      $$('button', bar).forEach(b => b.addEventListener('click', () => pick(b.dataset.t)));
    }
    function pick(id) {
      if (id === sheet && !app.classList.contains('m-collapsed')) { app.classList.add('m-collapsed'); sync(); return; }   // tap again: more room for the photo
      app.classList.remove('m-collapsed');
      sheet = id;
      app.classList.toggle('m-films', id === 'films');
      if (id === 'films') { if (tab === 'mask') setTab('basic'); else sync(); }
      else if (tab !== id) setTab(id); else sync();
      if (id === 'films') { const a = $('#sims .sim[aria-pressed=true]'); if (a) a.scrollIntoView({ block: 'nearest' }); }
    }
    function sync() {
      if (!built) return;
      if (sheet !== 'films') sheet = tab;
      const col = app.classList.contains('m-collapsed');
      $$('button', bar).forEach(b => b.setAttribute('aria-selected', String(!col && b.dataset.t === sheet)));
    }
    function apply() {
      build();
      if (MQ.matches) { app.classList.toggle('m-films', sheet === 'films'); if (sheet === 'films' && tab === 'mask') setTab('basic'); }
      else app.classList.remove('m-films', 'm-collapsed');
      sync(); badge(); renderMain();
    }
    MQ.addEventListener('change', apply);
    return { apply, sync, pick, get sheet() { return sheet; } };
  })();

  /* ---------- events ---------- */
  ['#file', '#file2'].forEach(s => $(s).addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; }));
  const stage = $('#stage');
  window.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('over'); });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) stage.classList.remove('over'); });
  window.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  $('#cmp').addEventListener('click', toggleCompare);
  $('#split').addEventListener('click', toggleSplit);
  $('#exp').addEventListener('click', openExport);
  $('#go').addEventListener('click', runExport);
  $('#cancel').addEventListener('click', () => { if (exporting) cancelReq = true; else $('#modal').hidden = true; });
  $$('#views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)));
  $('#presetsBtn').addEventListener('click', e => { e.stopPropagation(); Presets.toggle(); });
  $('#pimport').addEventListener('change', e => { const f = e.target.files[0]; if (f) Presets.importFile(f); e.target.value = ''; });
  $('#sessFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) Memory.importSession(f); e.target.value = ''; Presets.toggle(false); });
  $('#packFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) openJsonFile(f); e.target.value = ''; });
  $('#dropSess').addEventListener('click', () => $('#sessFile').click());

  // a standalone copy (not inside Claude): works offline after the first visit and installs like an app
  if (!window.claude && 'serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    let hadCtl = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline support', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl) toastAction('Film Lab was updated', 'Reload', () => location.reload(), 12000); hadCtl = true; });
  }
  let installEv = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; $('#installBtn').hidden = false; });
  window.addEventListener('appinstalled', () => { installEv = null; $('#installBtn').hidden = true; toast('Film Lab is installed'); });
  $('#installBtn').addEventListener('click', async () => { if (!installEv) return; installEv.prompt(); try { await installEv.userChoice; } catch (e) { /* closed */ } installEv = null; $('#installBtn').hidden = true; });
  const imenu = $('#imenu');
  $('#iconsBtn').addEventListener('click', e => { e.stopPropagation(); imenu.hidden = !imenu.hidden; $('#iconsClear').hidden = !Icons.has(); });
  $('#iconsLoad').addEventListener('click', () => { imenu.hidden = true; $('#iconsFile').click(); });
  $('#iconsClear').addEventListener('click', () => { imenu.hidden = true; Icons.clear(); });
  $('#iconsFile').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) Icons.load(f); });
  document.addEventListener('pointerdown', e => { if (!imenu.hidden && !imenu.contains(e.target) && !$('#iconsBtn').contains(e.target)) imenu.hidden = true; });
  document.addEventListener('pointerdown', e => { const pop = $('#pop'); if (!pop.hidden && !pop.contains(e.target) && !$('#presetsBtn').contains(e.target)) Presets.toggle(false); });
  window.addEventListener('keydown', e => {
    const inField = e.target.matches && e.target.matches('input:not([type=range]),select,textarea');
    if (!$('#modal').hidden) { if (e.key === 'Escape' && !exporting) $('#modal').hidden = true; return; }
    if (e.key === 'Escape') { if (!$('#pop').hidden) { Presets.toggle(false); return; } if (selSet.size > 1) select(cur); return; }
    if (inField) return;
    if (e.target.matches && e.target.matches('input[type=range]') && /^Arrow|^Page|^Home$|^End$/.test(e.key)) return;   // let sliders take their keys
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === '\\') { e.preventDefault(); toggleCompare(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return; }
    if (mod && e.key.toLowerCase() === 'c') { if (photos.length) { e.preventDefault(); copyAdj(); } return; }
    if (mod && e.key.toLowerCase() === 'v') { if (clip) { e.preventDefault(); pasteAdj(); } return; }
    if (mod || e.altKey) return;
    if (tab === 'mask' && (e.key === 'Delete' || e.key === 'Backspace') && curMasks()[mSel]) { e.preventDefault(); delMask(mSel); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); select(Math.min(cur + 1, photos.length - 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); select(Math.max(cur - 1, 0)); }
    else if (e.key === 'y' || e.key === 'Y') toggleSplit();
    else if (e.key === 'p' || e.key === 'P') setView('photo');
    else if (e.key === 'c' || e.key === 'C') setView('crop');
    else if (e.key === 'g' || e.key === 'G') setView('grid');
  });
  new ResizeObserver(() => renderMain()).observe(stage);
  window.FilmLab = { G, DEF, photos, params, eff, addFiles, select, pick, set, resetKeys, setScope, setView, setTab, selectAll, copyAdj, pasteAdj, matchBrightness,
    presets: Presets, icons: Icons, toggleSplit, toggleCompare, get layout() { return curLayout; }, get state() { return { cur, scope, view, ratio, tab, split, splitPos, sel: [...selSet] }; },
    setRatio: r => { ratio = r; syncCropTool(); renderMain(); }, setSplitPos: v => { splitPos = v; renderMain(); },
    match: Match,
    mstats: (i, withMatch, over) => {
      const ph = photos[i], s0 = Object.assign(withMatch ? eff(ph) : { ...eff(ph), _nomatch: 1 }, over || {}), lg = 240, land = ph.w >= ph.h;
      const w = land ? lg : Math.round(lg * ph.w / ph.h), h = land ? Math.round(lg * ph.h / ph.w) : lg;
      const X = Match.lab(engine.quick(ph.thumb, params(s0, ph), w, h));
      return { q: Match.pct(X.L), bands: Match.bands(Match.bandSums(X)) };
    },
    fpUrls: async urls => {
      const px = [];
      for (const u of urls) {
        const img = await createImageBitmap(await (await fetch(u)).blob());
        const sc = 240 / Math.max(img.width, img.height), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, w, h); px.push(x.getImageData(0, 0, w, h).data); img.close();
      }
      return Match.fingerprint(px);
    },
    renderURL: async (i, long, over, withMatch = true) => {
      select(i); const ph = photos[i]; await ensurePreview(i); const src = ph.prev || ph.thumb;
      const s0 = Object.assign(withMatch ? eff(ph) : { ...eff(ph), _nomatch: 1 }, over || {});
      const land = ph.w >= ph.h, w = land ? long : Math.round(long * ph.w / ph.h), h = land ? Math.round(long * ph.h / ph.w) : long;
      const px = engine.renderTo(src, params(s0, ph), w, h, { key: 'tcol', outKey: 'tout', seed: i + 7 });
      const c = document.createElement('canvas'); c.width = w; c.height = h; putPixels(c, px, w, h);
      return c.toDataURL('image/jpeg', 0.92);
    },
    runExport: (opts) => { openExport(); if (opts) { if (opts.sizes) { expSizes.clear(); opts.sizes.forEach(s => expSizes.add(s)); $$('#igs input').forEach(c => { c.checked = expSizes.has(c.dataset.r); }); } if (opts.orig != null) $('#oOrig').checked = opts.orig; } return runExport(); } };
  Object.defineProperty(window, '__engine', { get: () => engine });
  boot();
}
