/* compose.js — output geometry (Instagram sizes, frame, crop / fit) and the LED date stamp. */
(function (root) {
  'use strict';

  const SIZES = [
    { id: '3x4', label: '3:4', name: 'Portrait 3:4', w: 1080, h: 1440 },
    { id: '4x5', label: '4:5', name: 'Portrait 4:5', w: 1080, h: 1350 },
    { id: '1x1', label: '1:1', name: 'Square 1:1', w: 1080, h: 1080 },
    { id: '191x1', label: '1.91:1', name: 'Landscape 1.91:1', w: 1080, h: 566 },
    { id: '9x16', label: '9:16', name: 'Story 9:16', w: 1080, h: 1920 },
  ];
  const SIZE = Object.fromEntries(SIZES.map(s => [s.id, s]));

  // Frame borders in output pixels for a canvas of W x H.
  function frameBox(W, H, fr) {
    if (!fr || !fr.on) return { l: 0, t: 0, r: 0, b: 0 };
    const s = Math.min(W, H), side = Math.round(s * fr.size / 100), extra = Math.round(s * (fr.bottom || 0) / 100);
    return { l: side, t: side, r: side, b: side + extra };
  }

  // Largest crop of aspect `a` (w/h) inside an image W x H, zoomed by z and centred near (cx, cy) (0..1), clamped inside.
  function cropRect(W, H, a, c) {
    c = c || {}; const z = Math.max(1, c.z || 1);
    let cw, ch;
    if (W / H > a) { ch = H; cw = H * a; } else { cw = W; ch = W / a; }
    cw /= z; ch /= z;
    const cx = (c.x == null ? 0.5 : c.x) * W, cy = (c.y == null ? 0.5 : c.y) * H;
    const x = Math.min(Math.max(cx - cw / 2, 0), W - cw), y = Math.min(Math.max(cy - ch / 2, 0), H - ch);
    return { x, y, w: cw, h: ch };            // in image pixels
  }

  /* Layout of one output: canvas W x H, the photo's placement and the source region to sample.
     mode 'fill' crops the photo to the inner area; 'fit' shows it whole inside the inner area. */
  function layout(W, H, imgW, imgH, fr, mode, c) {
    const fb = frameBox(W, H, fr);
    const iw = W - fb.l - fb.r, ih = H - fb.t - fb.b;
    if (mode === 'fit') {
      const s = Math.min(iw / imgW, ih / imgH);
      const pw = Math.max(1, Math.round(imgW * s)), ph = Math.max(1, Math.round(imgH * s));
      return { W, H, x: fb.l + Math.round((iw - pw) / 2), y: fb.t + Math.round((ih - ph) / 2), w: pw, h: ph, src: { x: 0, y: 0, w: imgW, h: imgH }, inner: { x: fb.l, y: fb.t, w: iw, h: ih } };
    }
    const r = cropRect(imgW, imgH, iw / ih, c);
    return { W, H, x: fb.l, y: fb.t, w: iw, h: ih, src: r, inner: { x: fb.l, y: fb.t, w: iw, h: ih } };
  }

  /* ---------- LED date stamp (seven-segment, drawn as light) ---------- */
  // segments: a top, b upper-right, c lower-right, d bottom, e lower-left, f upper-left, g middle
  const DIG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g' };
  const COLORS = {
    orange: { core: '#FFB25A', glow: '#FF6A1A' },
    red: { core: '#FF7A5C', glow: '#F0281E' },
    yellow: { core: '#FFE79A', glow: '#FFB81E' },
    white: { core: '#FFFFFF', glow: '#C8D6FF' },
  };
  const pad2 = n => String(n).padStart(2, '0');

  function stampText(d, fmt, time) {
    if (!d) return '';
    const Y = d.getFullYear(), yy = pad2(Y % 100), M = pad2(d.getMonth() + 1), D = pad2(d.getDate());
    let s;
    switch (fmt) {
      case 'mdy': s = `${M} ${D} '${yy}`; break;
      case 'dmy': s = `${D} ${M} '${yy}`; break;
      case 'ymd4': s = `${Y} ${M} ${D}`; break;
      case 'dots': s = `${D}.${M}.${Y}`; break;
      default: s = `'${yy} ${M} ${D}`;
    }
    if (time) s += `  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return s;
  }

  function glyphWidth(ch, h) {
    if (ch === ' ') return h * 0.5;
    if (ch === "'" || ch === '.' || ch === ':') return h * 0.24;
    return h * 0.56;
  }
  function textWidth(s, h) { let w = 0; for (const ch of s) w += glyphWidth(ch, h) + h * 0.12; return Math.max(0, w - h * 0.12); }

  function segPath(ctx, x, y, w, h, t, seg, sk) {
    // (x,y) = top-left of the digit cell; skew sk shifts x by -sk*(y - mid)
    const P = (px, py) => [x + px + sk * (h - py), y + py];
    const g = t * 0.12, hh = h / 2;
    const polys = {
      a: [[g + t * 0.5, 0], [w - g - t * 0.5, 0], [w - g - t, t], [g + t, t]],
      d: [[g + t, h - t], [w - g - t, h - t], [w - g - t * 0.5, h], [g + t * 0.5, h]],
      g: [[g + t * 0.6, hh], [g + t, hh - t / 2], [w - g - t, hh - t / 2], [w - g - t * 0.6, hh], [w - g - t, hh + t / 2], [g + t, hh + t / 2]],
      f: [[0, g + t * 0.5], [t, g + t], [t, hh - g - t / 2], [t * 0.5, hh - g], [0, hh - g - t * 0.2]],
      e: [[0, hh + g + t * 0.2], [t * 0.5, hh + g], [t, hh + g + t / 2], [t, h - g - t], [0, h - g - t * 0.5]],
      b: [[w, g + t * 0.5], [w, hh - g - t * 0.2], [w - t * 0.5, hh - g], [w - t, hh - g - t / 2], [w - t, g + t]],
      c: [[w, hh + g + t * 0.2], [w, h - g - t * 0.5], [w - t, h - g - t], [w - t, hh + g + t / 2], [w - t * 0.5, hh + g]],
    }[seg];
    const p0 = P(...polys[0]); ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i < polys.length; i++) { const p = P(...polys[i]); ctx.lineTo(p[0], p[1]); }
    ctx.closePath();
  }

  function glyphs(ctx, s, x, y, h) {
    const t = h * 0.13, sk = 0.1;
    ctx.beginPath();
    for (const ch of s) {
      const w = glyphWidth(ch, h);
      if (DIG[ch]) for (const seg of DIG[ch]) segPath(ctx, x, y, w, h, t, seg, sk);
      else if (ch === "'") { const px = x + w * 0.3 + sk * h; ctx.rect(px, y, t, h * 0.3); }
      else if (ch === '.') ctx.rect(x + w * 0.3, y + h - t, t, t);
      else if (ch === ':') { ctx.rect(x + w * 0.3 + sk * h * 0.7, y + h * 0.27, t, t); ctx.rect(x + w * 0.3 + sk * h * 0.25, y + h * 0.66, t, t); }
      x += w + h * 0.12;
    }
  }

  /* Draw the stamp onto ctx within the photo area (x, y, w, h). st: {on, fmt, time, pos, size, color} */
  function drawStamp(ctx, area, date, st) {
    if (!st || !st.on || !date) return;
    const s = stampText(date, st.fmt, st.time); if (!s) return;
    const short = Math.min(area.w, area.h);
    const h = Math.max(6, short * (st.size || 3.2) / 100);
    const tw = textWidth(s, h) + h * 0.1, m = short * 0.045;
    const right = !st.pos || st.pos[1] === 'r', bottom = !st.pos || st.pos[0] === 'b';
    const x = right ? area.x + area.w - m - tw : area.x + m;
    const y = bottom ? area.y + area.h - m - h : area.y + m;
    const col = COLORS[st.color] || COLORS.orange;
    ctx.save();
    ctx.beginPath(); ctx.rect(area.x, area.y, area.w, area.h); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = col.glow; ctx.shadowBlur = h * 0.55; ctx.fillStyle = col.glow; ctx.globalAlpha = 0.55;
    glyphs(ctx, s, x, y, h); ctx.fill();
    ctx.shadowBlur = h * 0.18; ctx.globalAlpha = 0.9; ctx.fillStyle = col.core;
    glyphs(ctx, s, x, y, h); ctx.fill();
    ctx.restore();
  }

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); const v = m ? parseInt(m[1], 16) : 0xffffff;
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
  }

  root.Compose = { SIZES, SIZE, frameBox, cropRect, layout, drawStamp, stampText, hexToRgb, STAMP_COLORS: COLORS };
})(window);
