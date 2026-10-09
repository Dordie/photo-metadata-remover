/*
 * metadata.js: find and remove hidden metadata from JPEG, PNG and WebP files.
 * Pure byte-level code with no dependencies. Works in browsers and in Node (for tests).
 * Clean mode never re-encodes pixels: it copies the image data and drops metadata blocks.
 */
(function (root) {
  'use strict';

  const utf8 = new TextDecoder('utf-8');
  const latin1 = new TextDecoder('latin1');

  function ascii(u8, off, len) {
    let s = '';
    for (let i = 0; i < len && off + i < u8.length; i++) s += String.fromCharCode(u8[off + i]);
    return s;
  }
  function startsWith(u8, off, str) { return ascii(u8, off, str.length) === str; }
  function clip(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /* ---------- CRC32 (PNG chunks, ZIP) ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8, start = 0, end = u8.length, seed = 0) {
    let c = (seed ^ 0xFFFFFFFF) >>> 0;
    for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function concat(parts) {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  /* ---------- type detection by magic bytes ---------- */
  function detectType(u8) {
    if (u8.length >= 3 && u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) return 'jpeg';
    if (u8.length >= 8 && u8[0] === 0x89 && ascii(u8, 1, 3) === 'PNG' && u8[4] === 0x0D && u8[5] === 0x0A && u8[6] === 0x1A && u8[7] === 0x0A) return 'png';
    if (u8.length >= 12 && ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 4) === 'WEBP') return 'webp';
    if (u8.length >= 6 && ascii(u8, 0, 3) === 'GIF') return 'gif';
    if (u8.length >= 12 && ascii(u8, 4, 4) === 'ftyp') {
      const brand = ascii(u8, 8, 4);
      if (/^avi[fs]$/.test(brand)) return 'avif';
      if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return 'heic';
    }
    return 'unknown';
  }

  /* ---------- Findings collector ---------- */
  function Findings() { this.list = []; }
  Findings.prototype.add = function (id, value) {
    value = value === undefined || value === null ? '' : clip(value, 140);
    if (!this.list.some(f => f.id === id && f.value === value)) this.list.push({ id, value });
  };

  /* ---------- EXIF (TIFF structure) ---------- */
  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  function parseTiff(u8, start, end, F) {
    const len = end - start;
    const res = { orientation: 1 };
    if (len < 8) return res;
    const dv = new DataView(u8.buffer, u8.byteOffset + start, len);
    const bo = dv.getUint16(0);
    let le;
    if (bo === 0x4949) le = true; else if (bo === 0x4D4D) le = false; else return res;
    if (dv.getUint16(2, le) !== 42) return res;
    const u16 = o => dv.getUint16(o, le);
    const u32 = o => dv.getUint32(o, le);
    const visited = new Set();

    function readIFD(off) {
      if (!off || off < 8 || off + 2 > len || visited.has(off)) return null;
      visited.add(off);
      const n = u16(off);
      if (n > 1000) return null;
      const tags = new Map();
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (e + 12 > len) break;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
        const size = (TYPE_SIZE[type] || 1) * count;
        const voff = size <= 4 ? e + 8 : u32(e + 8);
        if (size > len || voff > len - size) continue;
        tags.set(tag, { type, count, voff });
      }
      const np = off + 2 + n * 12;
      return { tags, next: np + 4 <= len ? u32(np) : 0 };
    }
    function str(t) {
      if (!t) return '';
      const bytes = new Uint8Array(u8.buffer, u8.byteOffset + start + t.voff, t.count);
      let e = bytes.indexOf(0); if (e < 0) e = bytes.length;
      return utf8.decode(bytes.subarray(0, e)).trim();
    }
    function nums(t) {
      if (!t) return [];
      const a = [];
      for (let i = 0; i < Math.min(t.count, 16); i++) {
        const o = t.voff;
        switch (t.type) {
          case 1: case 7: a.push(dv.getUint8(o + i)); break;
          case 3: a.push(u16(o + i * 2)); break;
          case 4: a.push(u32(o + i * 4)); break;
          case 9: a.push(dv.getInt32(o + i * 4, le)); break;
          case 5: { const d = u32(o + i * 8 + 4); a.push(d ? u32(o + i * 8) / d : 0); break; }
          case 10: { const d = dv.getInt32(o + i * 8 + 4, le); a.push(d ? dv.getInt32(o + i * 8, le) / d : 0); break; }
          default: return a;
        }
      }
      return a;
    }
    const strTag = (ifd, tag, id) => {
      let v = ifd && str(ifd.tags.get(tag));
      if (v && id === 'datetime') v = v.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      if (v) F.add(id, v);
    };

    const ifd0 = readIFD(u32(4));
    if (!ifd0) return res;
    strTag(ifd0, 0x010F, 'make');
    strTag(ifd0, 0x0110, 'model');
    strTag(ifd0, 0x0131, 'software');
    strTag(ifd0, 0x013B, 'artist');
    strTag(ifd0, 0x8298, 'copyright');
    strTag(ifd0, 0x010E, 'description');
    const o = nums(ifd0.tags.get(0x0112))[0];
    if (o >= 1 && o <= 8) res.orientation = o;

    const exifPtr = nums(ifd0.tags.get(0x8769))[0];
    const exif = readIFD(exifPtr);
    if (exif) {
      strTag(exif, 0x9003, 'datetime');
      strTag(exif, 0xA434, 'lens');
      strTag(exif, 0xA431, 'serial');
      strTag(exif, 0xA430, 'owner');
      strTag(exif, 0xA420, 'uniqueid');
      if (exif.tags.has(0x927C)) F.add('makernote', exif.tags.get(0x927C).count + ' bytes');
    }
    if (!F.list.some(f => f.id === 'datetime')) strTag(ifd0, 0x0132, 'datetime');

    const gps = readIFD(nums(ifd0.tags.get(0x8825))[0]);
    if (gps) {
      const lat = nums(gps.tags.get(0x0002)), lon = nums(gps.tags.get(0x0004));
      const latRef = str(gps.tags.get(0x0001)), lonRef = str(gps.tags.get(0x0003));
      if (lat.length === 3 && lon.length === 3) {
        let la = lat[0] + lat[1] / 60 + lat[2] / 3600;
        let lo = lon[0] + lon[1] / 60 + lon[2] / 3600;
        if (latRef === 'S') la = -la;
        if (lonRef === 'W') lo = -lo;
        let v = la.toFixed(5) + ', ' + lo.toFixed(5);
        const alt = nums(gps.tags.get(0x0006))[0];
        if (alt !== undefined && isFinite(alt)) {
          const below = nums(gps.tags.get(0x0005))[0] === 1;
          v += ' (' + (below ? '-' : '') + Math.round(alt) + ' m)';
        }
        res.gps = { lat: la, lon: lo };
        F.add('gps', v);
      } else if (gps.tags.size > 1) {
        F.add('gps', '');
      }
    }
    const ifd1 = readIFD(ifd0.next);
    if (ifd1 && ifd1.tags.size) F.add('thumbnail', '');
    return res;
  }

  function minimalTiffOrientation(o) {
    // Big-endian TIFF with a single IFD0 entry: Orientation (0x0112), SHORT, 1 value.
    return new Uint8Array([0x4D, 0x4D, 0x00, 0x2A, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0, 0, 0]);
  }

  function parseXmp(text, F) {
    F.add('xmp', Math.round(text.length / 1024 * 10) / 10 + ' KB');
    const grab = re => { const m = text.match(re); return m ? (m[1] || m[2] || '').trim() : ''; };
    const lat = grab(/exif:GPSLatitude="([^"]+)"|<exif:GPSLatitude>([^<]+)</);
    const lon = grab(/exif:GPSLongitude="([^"]+)"|<exif:GPSLongitude>([^<]+)</);
    if (lat && lon) F.add('gps', lat + ', ' + lon + ' (XMP)');
    const tool = grab(/xmp:CreatorTool="([^"]+)"|<xmp:CreatorTool>([^<]+)</);
    if (tool) F.add('software', tool);
    const creator = grab(/<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]+)</);
    if (creator) F.add('artist', creator);
    if (/<xmpMM:History>|stEvt:action/.test(text)) F.add('history', '');
  }

  /* ---------- JPEG ---------- */
  function findJpegEnd(u8, p) {
    const n = u8.length;
    while (p < n - 1) {
      if (u8[p] !== 0xFF) { p++; continue; }
      const m = u8[p + 1];
      if (m === 0xFF) { p++; continue; }
      if (m === 0x00 || (m >= 0xD0 && m <= 0xD7)) { p += 2; continue; }
      if (m === 0xD9) return p + 2;
      if (p + 4 > n) return n;
      p += 2 + ((u8[p + 2] << 8) | u8[p + 3]);
    }
    return n;
  }

  function walkJpeg(u8) {
    const segs = [];
    let p = 2;
    while (p < u8.length) {
      if (u8[p] !== 0xFF) throw new Error('corrupt');
      while (p < u8.length && u8[p] === 0xFF) p++;
      const mStart = p - 1;
      const marker = u8[p++];
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { segs.push({ marker, start: mStart, end: p, data: p }); continue; }
      if (marker === 0xD9) return { segs, sos: mStart, imageEnd: p };
      if (p + 2 > u8.length) throw new Error('corrupt');
      const L = (u8[p] << 8) | u8[p + 1];
      const end = p + L;
      if (L < 2 || end > u8.length) throw new Error('corrupt');
      if (marker === 0xDA) return { segs, sos: mStart, imageEnd: findJpegEnd(u8, end) };
      segs.push({ marker, start: mStart, end, data: p + 2 });
      p = end;
    }
    throw new Error('corrupt');
  }

  // Classify a pre-scan JPEG segment: 'keep', 'drop', or 'jfif'.
  function jpegSegment(u8, s, F, kept) {
    const m = s.marker, d = s.data, len = s.end - s.data;
    let res = { orientation: 1 };
    if (m === 0xE0) {
      if (startsWith(u8, d, 'JFIF\0')) { if (len > 14) F.add('thumbnail', ''); return { action: 'jfif' }; }
      F.add('thumbnail', ''); return { action: 'drop' };
    }
    if (m === 0xE1) {
      if (startsWith(u8, d, 'Exif\0')) res = parseTiff(u8, d + 6, s.end, F);
      else if (startsWith(u8, d, 'http://ns.adobe.com/xap/1.0/\0') || startsWith(u8, d, 'http://ns.adobe.com/xmp/extension/\0'))
        parseXmp(utf8.decode(u8.subarray(d, s.end)), F);
      else F.add('other', 'APP1 ' + len + ' bytes');
      return { action: 'drop', orientation: res.orientation, gps: res.gps };
    }
    if (m === 0xE2) {
      if (startsWith(u8, d, 'ICC_PROFILE\0')) { kept.add('icc'); return { action: 'keep' }; }
      if (startsWith(u8, d, 'MPF\0')) F.add('mpf', ''); else F.add('other', 'APP2 ' + len + ' bytes');
      return { action: 'drop' };
    }
    if (m === 0xED) { F.add('iptc', len + ' bytes'); return { action: 'drop' }; }
    if (m === 0xEE) {
      if (startsWith(u8, d, 'Adobe')) return { action: 'keep' };
      F.add('other', 'APP14 ' + len + ' bytes'); return { action: 'drop' };
    }
    if (m >= 0xE3 && m <= 0xEF) { F.add('other', 'APP' + (m - 0xE0) + ' ' + len + ' bytes'); return { action: 'drop' }; }
    if (m === 0xFE) { F.add('comment', latin1.decode(u8.subarray(d, s.end)).replace(/\0+$/, '')); return { action: 'drop' }; }
    return { action: 'keep' };
  }

  function processJpeg(u8, doClean) {
    const F = new Findings();
    const kept = new Set();
    const w = walkJpeg(u8);
    let orientation = 1, gps = null;
    const parts = [u8.subarray(0, 2)];
    const decisions = w.segs.map(s => {
      const r = jpegSegment(u8, s, F, kept);
      if (r.orientation && r.orientation !== 1) orientation = r.orientation;
      if (r.gps) gps = r.gps;
      return r;
    });
    if (orientation !== 1) F.add('orientation', String(orientation));
    const trailer = u8.length - w.imageEnd;
    if (trailer > 0) F.add('trailer', Math.round(trailer / 1024) + ' KB');
    if (!doClean) return { type: 'jpeg', findings: F.list, orientation, gps };

    const out = [];
    let jfifFirst = false;
    w.segs.forEach((s, i) => {
      const a = decisions[i].action;
      if (a === 'jfif') {
        // Rebuild JFIF APP0 without its optional embedded thumbnail.
        if (s.end - s.data >= 14) {
          const hdr = u8.slice(s.data, s.data + 14);
          hdr[12] = 0; hdr[13] = 0;
          out.push(concat([new Uint8Array([0xFF, 0xE0, 0, 16]), hdr]));
        } else out.push(u8.subarray(s.start, s.end));
        if (i === 0) jfifFirst = true;
      } else if (a === 'keep') out.push(u8.subarray(s.start, s.end));
    });
    if (orientation !== 1) {
      const body = concat([new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0]), minimalTiffOrientation(orientation)]);
      const L = body.length + 2;
      out.splice(jfifFirst ? 1 : 0, 0, concat([new Uint8Array([0xFF, 0xE1, L >> 8, L & 0xFF]), body]));
      kept.add('orientation');
    }
    parts.push(...out);
    parts.push(u8.subarray(w.sos, w.imageEnd));
    return { type: 'jpeg', findings: F.list, orientation, gps, bytes: concat(parts), kept: [...kept] };
  }

  /* ---------- PNG ---------- */
  const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'mDCv', 'cLLi', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'acTL', 'fcTL', 'fdAT']);

  function processPng(u8, doClean) {
    const F = new Findings();
    const kept = new Set();
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    const parts = [u8.subarray(0, 8)];
    let p = 8, orientation = 1, gps = null, sawEnd = false;
    const chunks = [];
    while (p + 12 <= u8.length) {
      const L = dv.getUint32(p);
      const type = ascii(u8, p + 4, 4);
      const d = p + 8, end = d + L + 4;
      if (end > u8.length) throw new Error('corrupt');
      chunks.push({ type, start: p, end, d, L });
      if (type === 'tEXt' || type === 'zTXt') {
        const z = u8.indexOf(0, d);
        const kw = latin1.decode(u8.subarray(d, Math.min(z, d + L)));
        if (type === 'tEXt') F.add('text', kw + ': ' + latin1.decode(u8.subarray(z + 1, d + L)));
        else F.add('text', kw + ' (compressed)');
      } else if (type === 'iTXt') {
        const z = u8.indexOf(0, d);
        const kw = latin1.decode(u8.subarray(d, z));
        if (kw === 'XML:com.adobe.xmp' && u8[z + 1] === 0) {
          let q = u8.indexOf(0, z + 3); q = u8.indexOf(0, q + 1);
          parseXmp(utf8.decode(u8.subarray(q + 1, d + L)), F);
        } else if (kw === 'XML:com.adobe.xmp') F.add('xmp', '');
        else if (u8[z + 1] === 0) {
          let q = u8.indexOf(0, z + 3); q = u8.indexOf(0, q + 1);
          F.add('text', kw + ': ' + utf8.decode(u8.subarray(q + 1, d + L)));
        } else F.add('text', kw + ' (compressed)');
      } else if (type === 'eXIf') {
        const r = parseTiff(u8, d, d + L, F);
        if (r.orientation !== 1) orientation = r.orientation;
        if (r.gps) gps = r.gps;
      } else if (type === 'tIME' && L === 7) {
        const y = dv.getUint16(d);
        const pad = n => String(n).padStart(2, '0');
        F.add('modified', y + '-' + pad(u8[d + 2]) + '-' + pad(u8[d + 3]) + ' ' + pad(u8[d + 4]) + ':' + pad(u8[d + 5]));
      } else if (!PNG_KEEP.has(type)) {
        F.add('other', type + ' ' + L + ' bytes');
      }
      if (type === 'iCCP') kept.add('icc');
      p = end;
      if (type === 'IEND') { sawEnd = true; break; }
    }
    if (!sawEnd) throw new Error('corrupt');
    if (orientation !== 1) F.add('orientation', String(orientation));
    if (u8.length > p) F.add('trailer', Math.round((u8.length - p) / 1024) + ' KB');
    if (!doClean) return { type: 'png', findings: F.list, orientation, gps };

    for (const c of chunks) {
      if (c.type === 'IDAT' && orientation !== 1 && !kept.has('orientation')) {
        const tiff = minimalTiffOrientation(orientation);
        const head = new Uint8Array(8);
        new DataView(head.buffer).setUint32(0, tiff.length);
        head.set([0x65, 0x58, 0x49, 0x66], 4); // 'eXIf'
        const crc = new Uint8Array(4);
        new DataView(crc.buffer).setUint32(0, crc32(tiff, 0, tiff.length, crc32(head, 4, 8)));
        parts.push(head, tiff, crc);
        kept.add('orientation');
      }
      if (PNG_KEEP.has(c.type)) parts.push(u8.subarray(c.start, c.end));
    }
    return { type: 'png', findings: F.list, orientation, gps, bytes: concat(parts), kept: [...kept] };
  }

  /* ---------- WebP ---------- */
  const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);

  function processWebp(u8, doClean) {
    const F = new Findings();
    const kept = new Set();
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    const riffEnd = Math.min(u8.length, 8 + dv.getUint32(4, true));
    let p = 12, gps = null;
    const chunks = [];
    while (p + 8 <= riffEnd) {
      const type = ascii(u8, p, 4);
      const L = dv.getUint32(p + 4, true);
      const d = p + 8;
      const end = Math.min(d + L + (L & 1), riffEnd);
      if (d + L > riffEnd) throw new Error('corrupt');
      chunks.push({ type, start: p, end });
      if (type === 'EXIF') {
        const off = startsWith(u8, d, 'Exif\0\0') ? 6 : 0;
        const r = parseTiff(u8, d + off, d + L, F);
        if (r.gps) gps = r.gps;
      } else if (type === 'XMP ') parseXmp(utf8.decode(u8.subarray(d, d + L)), F);
      else if (type === 'ICCP') kept.add('icc');
      else if (!WEBP_KEEP.has(type)) F.add('other', type.trim() + ' ' + L + ' bytes');
      p = end;
    }
    if (u8.length > riffEnd) F.add('trailer', Math.round((u8.length - riffEnd) / 1024) + ' KB');
    if (!doClean) return { type: 'webp', findings: F.list, orientation: 1, gps };

    const body = [];
    for (const c of chunks) {
      if (!WEBP_KEEP.has(c.type)) continue;
      if (c.type === 'VP8X') {
        const copy = u8.slice(c.start, c.end);
        copy[8] &= ~(0x08 | 0x04); // clear EXIF and XMP flags
        body.push(copy);
      } else body.push(u8.subarray(c.start, c.end));
    }
    const bodyBytes = concat(body);
    const head = new Uint8Array(12);
    head.set(u8.subarray(0, 12));
    new DataView(head.buffer).setUint32(4, bodyBytes.length + 4, true);
    return { type: 'webp', findings: F.list, orientation: 1, gps, bytes: concat([head, bodyBytes]), kept: [...kept] };
  }

  /* ---------- public API ---------- */
  function run(u8, doClean) {
    const type = detectType(u8);
    try {
      if (type === 'jpeg') return processJpeg(u8, doClean);
      if (type === 'png') return processPng(u8, doClean);
      if (type === 'webp') return processWebp(u8, doClean);
    } catch (e) {
      return { type, error: 'corrupt', findings: [] };
    }
    return { type, error: 'unsupported', findings: [] };
  }

  const api = {
    detectType,
    inspect: u8 => run(u8, false),
    clean: u8 => run(u8, true),
    crc32,
    concat,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhotoMeta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
