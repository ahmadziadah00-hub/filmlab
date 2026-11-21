/* io.js — JPEG metadata (EXIF / ICC / size), EXIF transplant for exports, and a store-only ZIP writer. */
(function (root) {
  'use strict';

  /* ---------- JPEG parsing ---------- */
  function u16(b, o, le) { return le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]; }
  function u32(b, o, le) { return le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
  function ascii(b, o, n) { let s = ''; for (let i = 0; i < n; i++) { const c = b[o + i]; if (!c) break; s += String.fromCharCode(c); } return s.trim(); }

  // Parse a TIFF/EXIF block. t = Uint8Array starting at "II"/"MM".
  function parseTiff(t) {
    const out = { orientation: 1, orientationAt: -1, make: '', model: '', date: '', iso: 0, f35: 0, fnum: 0, exp: 0 };
    if (t.length < 8) return out;
    const le = t[0] === 0x49;
    const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    function readIfd(off, cb) {
      if (off + 2 > t.length) return;
      const n = u16(t, off, le);
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12; if (e + 12 > t.length) break;
        const tag = u16(t, e, le), type = u16(t, e + 2, le), cnt = u32(t, e + 4, le);
        const size = (typeSize[type] || 1) * cnt;
        const valOff = size <= 4 ? e + 8 : u32(t, e + 8, le);
        cb(tag, type, cnt, valOff, e + 8);
      }
    }
    let exifIfd = 0;
    readIfd(u32(t, 4, le), (tag, type, cnt, vo) => {
      if (tag === 0x0112) { out.orientation = u16(t, vo, le); out.orientationAt = vo; }
      else if (tag === 0x010F) out.make = ascii(t, vo, cnt);
      else if (tag === 0x0110) out.model = ascii(t, vo, cnt);
      else if (tag === 0x8769) exifIfd = u32(t, vo, le);
    });
    const rat = (vo) => { const d = u32(t, vo + 4, le); return d ? u32(t, vo, le) / d : 0; };
    if (exifIfd) readIfd(exifIfd, (tag, type, cnt, vo) => {
      if (tag === 0x9003) out.date = ascii(t, vo, cnt);
      else if (tag === 0x8827) out.iso = u16(t, vo, le);
      else if (tag === 0xA405) out.f35 = u16(t, vo, le);
      else if (tag === 0x829D) out.fnum = rat(vo);
      else if (tag === 0x829A) out.exp = rat(vo);
    });
    out.le = le;
    return out;
  }

  function iccDescription(icc) {
    try {
      const n = u32(icc, 128, false);
      for (let i = 0; i < n; i++) {
        const e = 132 + i * 12;
        const sig = ascii(icc, e, 4), off = u32(icc, e + 4, false);
        if (sig !== 'desc') continue;
        const type = ascii(icc, off, 4);
        if (type === 'desc') return ascii(icc, off + 12, u32(icc, off + 8, false));
        if (type === 'mluc') {
          const rec = off + 16, len = u32(icc, rec + 4, false), so = off + u32(icc, rec + 8, false);
          let s = ''; for (let k = 0; k < len; k += 2) s += String.fromCharCode(u16(icc, so + k, false));
          return s.trim();
        }
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  function parseJpeg(buf) {
    const b = new Uint8Array(buf);
    const info = { width: 0, height: 0, orientation: 1, date: '', make: '', model: '', icc: '', isP3: false, exif: null, exifOrientationAt: -1 };
    if (b[0] !== 0xFF || b[1] !== 0xD8) return info;
    let o = 2; const iccParts = [];
    while (o + 4 <= b.length) {
      if (b[o] !== 0xFF) { o++; continue; }
      const m = b[o + 1];
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01 || m === 0xFF) { o += m === 0xFF ? 1 : 2; continue; }
      if (m === 0xDA || m === 0xD9) break;
      const len = u16(b, o + 2, false), p = o + 4;
      if (m === 0xE1 && ascii(b, p, 4) === 'Exif' && !info.exif) {
        const t = b.subarray(p + 6, o + 2 + len);
        const ex = parseTiff(t);
        info.orientation = ex.orientation || 1; info.make = ex.make; info.model = ex.model; info.date = ex.date; info.iso = ex.iso; info.f35 = ex.f35; info.fnum = ex.fnum; info.exp = ex.exp;
        info.exif = b.slice(o, o + 2 + len);               // whole APP1 segment incl. marker
        if (ex.orientationAt >= 0) info.exifOrientationAt = 4 + 6 + ex.orientationAt;  // offset inside info.exif
        info.exifLE = ex.le;
      } else if (m === 0xE2 && ascii(b, p, 11) === 'ICC_PROFILE') {
        iccParts.push({ seq: b[p + 12], data: b.subarray(p + 14, o + 2 + len) });
      } else if (m === 0xE2 && b[p] === 0x4D && b[p + 1] === 0x50 && b[p + 2] === 0x46 && b[p + 3] === 0) {
        info.mpf = parseMpf(b, p + 4, o + 2 + len);          // multi-picture index (Ultra HDR gain map lives here)
      } else if (m === 0xE1 && ascii(b, p, 28) === 'http://ns.adobe.com/xap/1.0/') {
        const x = new TextDecoder('latin1').decode(b.subarray(p + 29, o + 2 + len));
        const mm = /Item:Semantic="GainMap"[^>]*Item:Length="(\d+)"/.exec(x) || /Item:Length="(\d+)"[^>]*Item:Semantic="GainMap"/.exec(x);
        if (mm) info.gmLen = +mm[1];
        if (/hdrgm:Version/.test(x)) info.hdrgm = true;
      } else if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) {
        info.height = u16(b, p + 1, false); info.width = u16(b, p + 3, false);
      }
      o += 2 + len;
    }
    if (iccParts.length) {
      iccParts.sort((a, c) => a.seq - c.seq);
      const total = iccParts.reduce((s, x) => s + x.data.length, 0);
      const icc = new Uint8Array(total); let k = 0;
      for (const x of iccParts) { icc.set(x.data, k); k += x.data.length; }
      info.icc = iccDescription(icc);
      info.isP3 = /P3/i.test(info.icc);
    }
    return info;
  }

  // MPF APP2: entries of {size, offset}; offsets are relative to the MPF TIFF header (absolute = base + offset)
  function parseMpf(b, base, end) {
    try {
      const le = b[base] === 0x49;
      const ifd = base + u32(b, base + 4, le);
      const n = u16(b, ifd, le); let entries = null;
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (u16(b, e, le) === 0xB002) {
          const cnt = u32(b, e + 4, le), off = base + u32(b, e + 8, le);
          entries = [];
          for (let k = 0; k + 16 <= cnt && off + k + 16 <= end; k += 16)
            entries.push({ attr: u32(b, off + k, le), size: u32(b, off + k + 4, le), offset: u32(b, off + k + 8, le) });
        }
      }
      return entries ? { base, entries } : null;
    } catch (e) { return null; }
  }

  // Byte range of the gain-map JPEG inside the file, or null.
  function gainMapRange(info, fileSize) {
    if (!info.hdrgm && !info.gmLen) return null;
    const m = info.mpf;
    if (m && m.entries.length > 1) {
      const e = m.entries[1];
      if (e.size > 0 && e.offset > 0 && m.base + e.offset + e.size <= fileSize) return { start: m.base + e.offset, end: m.base + e.offset + e.size };
    }
    if (info.gmLen && info.gmLen < fileSize) return { start: fileSize - info.gmLen, end: fileSize };
    return null;
  }

  // hdrgm parameters from the gain-map image's own XMP (attribute or element form; per-channel values averaged)
  function gainMapParams(buf) {
    const b = new Uint8Array(buf);
    if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
    const txt = new TextDecoder('latin1').decode(b.subarray(0, Math.min(b.length, 65536)));
    const num = (k, d) => {
      let m = new RegExp('hdrgm:' + k + '="([^"]+)"').exec(txt);
      if (m) return parseFloat(m[1]);
      m = new RegExp('<hdrgm:' + k + '>([\\s\\S]*?)</hdrgm:' + k + '>').exec(txt);
      if (!m) return d;
      const v = (m[1].match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(parseFloat);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : d;
    };
    if (!/hdrgm:Version/.test(txt)) return null;
    const baseHDR = /hdrgm:BaseRenditionIsHDR="True"|<hdrgm:BaseRenditionIsHDR>True/i.test(txt);
    return { min: num('GainMapMin', 0), max: num('GainMapMax', 1), gamma: num('Gamma', 1) || 1,
             offSdr: num('OffsetSDR', 1 / 64), offHdr: num('OffsetHDR', 1 / 64), capMax: num('HDRCapacityMax', 1), baseHDR };
  }

  // Oriented (display) size for EXIF orientation 5..8 (rotated 90°)
  function orientedSize(info) {
    const rot = info.orientation >= 5 && info.orientation <= 8;
    return rot ? { w: info.height, h: info.width } : { w: info.width, h: info.height };
  }

  // Build a JPEG that carries the original EXIF (orientation reset to 1) in front of freshly encoded data.
  function withExif(jpeg, exifSeg, orientationAt, le) {
    if (!exifSeg) return jpeg;
    const ex = exifSeg.slice();
    if (orientationAt > 0 && orientationAt + 1 < ex.length) {
      if (le) { ex[orientationAt] = 1; ex[orientationAt + 1] = 0; } else { ex[orientationAt] = 0; ex[orientationAt + 1] = 1; }
    }
    // copy encoded segments after SOI, dropping APP0 (JFIF) so EXIF APP1 comes first
    const parts = [new Uint8Array([0xFF, 0xD8]), ex];
    let o = 2;
    while (o + 4 <= jpeg.length && jpeg[o] === 0xFF) {
      const m = jpeg[o + 1];
      if (m === 0xDA) break;
      const len = u16(jpeg, o + 2, false);
      if (m !== 0xE0 && m !== 0xE1) parts.push(jpeg.subarray(o, o + 2 + len));
      o += 2 + len;
    }
    parts.push(jpeg.subarray(o));
    const total = parts.reduce((s, x) => s + x.length, 0);
    const out = new Uint8Array(total); let k = 0;
    for (const x of parts) { out.set(x, k); k += x.length; }
    return out;
  }

  // "2026:11:07 15:29:28" or file name 20261107_152928 -> Date
  function captureDate(info, name) {
    let m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(info.date || '');
    if (!m) m = /(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/.exec(name || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }

  /* ---------- CRC32 + ZIP (store) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  class ZipWriter {
    constructor() { this.parts = []; this.central = []; this.offset = 0; this.count = 0; }
    add(name, data, date) {
      const enc = new TextEncoder().encode(name);
      const d = date || new Date();
      const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
      const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      const crc = crc32(data), size = data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, day, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, enc.length, true); lh.setUint16(28, 0, true);
      this.parts.push(lh.buffer, enc, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, day, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, enc.length, true);
      ch.setUint32(42, this.offset, true);
      this.central.push(ch.buffer, enc);
      this.offset += 30 + enc.length + size; this.count++;
    }
    finish() {
      const cdSize = this.central.reduce((s, x) => s + (x.byteLength || x.length), 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, this.count, true); end.setUint16(10, this.count, true);
      end.setUint32(12, cdSize, true); end.setUint32(16, this.offset, true);
      return new Blob([...this.parts, ...this.central, end.buffer], { type: 'application/zip' });
    }
  }

  // Minimal ZIP reader (stored + deflate) for loading the viewer's own icon files.
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
  }
  async function readZip(buf, maxTotal) {
    const b = new Uint8Array(buf), dv = new DataView(buf instanceof ArrayBuffer ? buf : b.buffer);
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('not a ZIP file');
    const n = dv.getUint16(e + 10, true), cd = dv.getUint32(e + 16, true);
    const out = []; let p = cd, total = 0;
    for (let k = 0; k < n; k++) {
      if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (name.endsWith('/') || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
      total += usize; if (maxTotal && total > maxTotal) throw new Error('ZIP too large');
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const raw = b.subarray(start, start + csize);
      const data = method === 0 ? raw.slice() : method === 8 ? await inflateRaw(raw) : null;
      if (data) out.push({ name, data });
    }
    return out;
  }

  root.IO = { parseJpeg, orientedSize, withExif, captureDate, ZipWriter, crc32, gainMapRange, gainMapParams, readZip };
})(window);
