/* app.js: UI for Photo Metadata Remover. All processing is local. */
(function () {
  'use strict';

  const I18N = {
    en: {
      skip: 'Skip to content', brand: 'Photo Metadata Remover',
      h1: 'Remove hidden location and camera data from your photos',
      lead: "Photos often carry GPS coordinates, the date and time, and your phone or camera model. See what's hidden in yours and get a clean copy before you share it.",
      private: "Everything happens in your browser. Your photos are never uploaded. This page can't even make network requests, and it keeps working offline.",
      pickH: 'Choose photos', dropMain: 'Choose photos or drop them here', dropSub: 'JPEG, PNG and WebP · several at once · you can also paste',
      modeLegend: 'How should the clean copy be made?',
      modeStrip: 'Remove metadata only', modeStripHelp: 'Same pixels, no quality loss. Keeps rotation and the colour profile.',
      modeResize: 'Remove metadata and make smaller', modeResizeHelp: 'Re-saves the image. Good for email, chats and uploads.',
      maxSize: 'Longest side', sizeOriginal: 'Keep original size', format: 'Format', formatPng: 'PNG (lossless, large)', quality: 'Quality',
      resultsH: 'Your photos', zipAll: 'Download all (ZIP)', clear: 'Clear',
      faqH: 'Questions',
      q1: 'What is photo metadata?',
      a1: 'Phones and cameras save extra information inside each picture: often the exact GPS position, the date and time, the device model and sometimes its serial number, editing software, and a small preview image. Most of it is invisible when you look at the photo, but anyone who gets the original file can read it.',
      q2: 'What does this tool remove, and what does it keep?',
      a2: "It removes EXIF (including GPS), XMP, IPTC, comments, embedded previews, maker notes and any data appended after the image. It keeps only what's needed to show the picture correctly: the rotation flag and the colour profile. After cleaning, the file is scanned again and you'll see the result.",
      q3: 'Are my photos uploaded?',
      a3: "No. All processing runs in JavaScript on your device. The page's security policy blocks all network connections, so it couldn't upload anything even if it tried. You can switch off Wi-Fi after the page has loaded and it will still work.",
      q4: "Don't WhatsApp, Instagram etc. remove this anyway?",
      a4: 'Many social networks strip it from what other people see, but not every app or service does. Email attachments, cloud links, marketplaces, "send as file/document" options and many forums often pass on the original file unchanged. Cleaning it yourself means you don\'t have to rely on that.',
      q5: 'Which formats work?',
      a5: 'JPEG, PNG and WebP can be cleaned without any quality loss. Other formats your browser can display, like HEIC on some iPhones and Macs, AVIF or GIF, can be converted with “make smaller”, which also drops all metadata (GIFs lose their animation). Tip: on iPhone, the share sheet\'s “Options → Location” switch also removes the location.',
      footer1: 'Free, no ads, no tracking.', footer2: 'If this helped, you can', footer3: 'buy me a coffee on Ko-fi',
      // dynamic
      working: 'Working…', download: 'Download clean copy',
      badgeGps: 'Location found', badgeNone: 'No metadata found', badgeCount: n => n + (n === 1 ? ' item found' : ' items found'),
      verified: 'Checked: the clean copy contains no metadata.',
      keptNote: k => ' Kept for correct display: ' + k + '.',
      notVerified: 'Warning: some metadata is still present: ',
      converted: 'This format can’t be cleaned losslessly, so it was converted to JPEG.',
      errRead: 'Couldn’t open this file. It may be damaged, or your browser can’t display this format. Try exporting it as JPEG first.',
      status: (n, g) => n + (n === 1 ? ' photo' : ' photos') + ' ready.' + (g ? ' Location data found in ' + g + '.' : ''),
      zipName: 'clean-photos.zip',
      f: {
        gps: 'Location (GPS)', make: 'Camera maker', model: 'Camera model', software: 'Software', artist: 'Author',
        copyright: 'Copyright', description: 'Description', datetime: 'Date taken', lens: 'Lens',
        serial: 'Device serial no.', owner: 'Owner name', uniqueid: 'Unique image ID', makernote: 'Manufacturer data',
        thumbnail: 'Embedded preview image', xmp: 'XMP metadata', history: 'Editing history', iptc: 'IPTC / Photoshop data',
        comment: 'Comment', text: 'Text field', modified: 'Last modified', mpf: 'Extra embedded images',
        trailer: 'Data after the image', other: 'Other metadata', orientation: 'rotation', icc: 'colour profile',
      },
    },
    de: {
      skip: 'Zum Inhalt springen', brand: 'Foto-Metadaten entfernen',
      h1: 'Versteckte Standort- und Kameradaten aus Fotos entfernen',
      lead: 'Fotos enthalten oft GPS-Koordinaten, Datum und Uhrzeit sowie das Handy- oder Kameramodell. Sieh nach, was in deinen Bildern steckt, und erstelle eine saubere Kopie, bevor du sie teilst.',
      private: 'Alles passiert in deinem Browser. Deine Fotos werden nie hochgeladen. Diese Seite kann nicht einmal Netzwerkanfragen stellen und funktioniert auch offline.',
      pickH: 'Fotos auswählen', dropMain: 'Fotos auswählen oder hierher ziehen', dropSub: 'JPEG, PNG und WebP · mehrere gleichzeitig · Einfügen geht auch',
      modeLegend: 'Wie soll die saubere Kopie erstellt werden?',
      modeStrip: 'Nur Metadaten entfernen', modeStripHelp: 'Gleiche Pixel, kein Qualitätsverlust. Drehung und Farbprofil bleiben erhalten.',
      modeResize: 'Metadaten entfernen und verkleinern', modeResizeHelp: 'Speichert das Bild neu. Gut für E-Mail, Chats und Uploads.',
      maxSize: 'Längste Seite', sizeOriginal: 'Originalgröße behalten', format: 'Format', formatPng: 'PNG (verlustfrei, groß)', quality: 'Qualität',
      resultsH: 'Deine Fotos', zipAll: 'Alle herunterladen (ZIP)', clear: 'Leeren',
      faqH: 'Fragen',
      q1: 'Was sind Foto-Metadaten?',
      a1: 'Handys und Kameras speichern in jedem Bild Zusatzinformationen: oft die genaue GPS-Position, Datum und Uhrzeit, das Gerätemodell und manchmal die Seriennummer, die Bearbeitungssoftware und ein kleines Vorschaubild. Beim Ansehen des Fotos sieht man davon nichts, aber wer die Originaldatei bekommt, kann alles auslesen.',
      q2: 'Was wird entfernt, was bleibt?',
      a2: 'Entfernt werden EXIF (inklusive GPS), XMP, IPTC, Kommentare, eingebettete Vorschaubilder, Herstellerdaten und alles, was hinter dem eigentlichen Bild angehängt ist. Erhalten bleibt nur, was für die richtige Anzeige nötig ist: die Drehung und das Farbprofil. Nach dem Bereinigen wird die Datei erneut geprüft und du siehst das Ergebnis.',
      q3: 'Werden meine Fotos hochgeladen?',
      a3: 'Nein. Die gesamte Verarbeitung läuft per JavaScript auf deinem Gerät. Die Sicherheitsrichtlinie der Seite blockiert alle Netzwerkverbindungen, sie könnte also gar nichts hochladen. Du kannst nach dem Laden der Seite das WLAN ausschalten und alles funktioniert weiter.',
      q4: 'Entfernen WhatsApp, Instagram usw. das nicht sowieso?',
      a4: 'Viele soziale Netzwerke entfernen die Daten für andere Nutzer, aber nicht jede App und jeder Dienst. E-Mail-Anhänge, Cloud-Links, Kleinanzeigen, „als Datei/Dokument senden“ und viele Foren geben oft die unveränderte Originaldatei weiter. Wenn du selbst bereinigst, musst du dich nicht darauf verlassen.',
      q5: 'Welche Formate funktionieren?',
      a5: 'JPEG, PNG und WebP lassen sich ohne Qualitätsverlust bereinigen. Andere Formate, die dein Browser anzeigen kann, z. B. HEIC auf manchen iPhones und Macs, AVIF oder GIF, lassen sich mit „verkleinern“ umwandeln; dabei fallen ebenfalls alle Metadaten weg (GIFs verlieren ihre Animation). Tipp: Auf dem iPhone entfernt auch der Schalter „Optionen → Standort“ im Teilen-Menü den Standort.',
      footer1: 'Kostenlos, ohne Werbung, ohne Tracking.', footer2: 'Wenn es dir geholfen hat, kannst du mir', footer3: 'auf Ko-fi einen Kaffee ausgeben',
      working: 'Wird bearbeitet …', download: 'Saubere Kopie herunterladen',
      badgeGps: 'Standort gefunden', badgeNone: 'Keine Metadaten gefunden', badgeCount: n => n + (n === 1 ? ' Eintrag gefunden' : ' Einträge gefunden'),
      verified: 'Geprüft: Die saubere Kopie enthält keine Metadaten.',
      keptNote: k => ' Für die richtige Anzeige erhalten: ' + k + '.',
      notVerified: 'Achtung: Einige Metadaten sind noch vorhanden: ',
      converted: 'Dieses Format lässt sich nicht verlustfrei bereinigen und wurde daher in JPEG umgewandelt.',
      errRead: 'Diese Datei konnte nicht geöffnet werden. Sie ist evtl. beschädigt, oder dein Browser kann das Format nicht anzeigen. Exportiere sie am besten zuerst als JPEG.',
      status: (n, g) => n + (n === 1 ? ' Foto' : ' Fotos') + ' fertig.' + (g ? ' Standortdaten in ' + g + ' gefunden.' : ''),
      zipName: 'saubere-fotos.zip',
      f: {
        gps: 'Standort (GPS)', make: 'Kamerahersteller', model: 'Kameramodell', software: 'Software', artist: 'Urheber',
        copyright: 'Copyright', description: 'Beschreibung', datetime: 'Aufnahmedatum', lens: 'Objektiv',
        serial: 'Seriennummer', owner: 'Name des Besitzers', uniqueid: 'Eindeutige Bild-ID', makernote: 'Herstellerdaten',
        thumbnail: 'Eingebettetes Vorschaubild', xmp: 'XMP-Metadaten', history: 'Bearbeitungsverlauf', iptc: 'IPTC-/Photoshop-Daten',
        comment: 'Kommentar', text: 'Textfeld', modified: 'Zuletzt geändert', mpf: 'Weitere eingebettete Bilder',
        trailer: 'Daten nach dem Bild', other: 'Sonstige Metadaten', orientation: 'Drehung', icc: 'Farbprofil',
      },
    },
  };

  const INFO_ONLY = new Set(['orientation', 'icc']); // needed for display, not privacy-relevant
  const DANGER = new Set(['gps', 'serial', 'owner', 'uniqueid']);
  const $ = sel => document.querySelector(sel);
  const PM = window.PhotoMeta;

  let lang = 'en';
  try { lang = localStorage.getItem('lang') || ''; } catch (e) { lang = ''; }
  if (!I18N[lang]) lang = (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  const t = key => I18N[lang][key];

  const items = [];
  let nextId = 1;

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.getAttribute('data-i18n'));
      if (typeof v === 'string') el.textContent = v;
    });
    document.title = lang === 'de'
      ? 'Foto-Metadaten entfernen: GPS-Standort & EXIF-Daten privat löschen'
      : 'Photo Metadata Remover: remove GPS location & EXIF data, privately';
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    items.forEach(render);
    updateStatus();
  }

  function fmtSize(n) {
    const loc = lang === 'de' ? 'de-DE' : 'en-GB';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toLocaleString(loc, { maximumFractionDigits: 0 }) + ' KB';
    return (n / 1024 / 1024).toLocaleString(loc, { maximumFractionDigits: 1 }) + ' MB';
  }

  function settings() {
    return {
      mode: document.querySelector('input[name=mode]:checked').value,
      max: parseInt($('#maxSize').value, 10),
      format: $('#format').value,
      quality: parseInt($('#quality').value, 10) / 100,
    };
  }

  const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  const TYPE_MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

  function outName(name, mime) {
    const stem = name.replace(/\.[^.]+$/, '') || 'photo';
    return stem + '-clean' + (EXT[mime] || '.jpg');
  }

  async function decode(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall back */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }

  async function reencode(file, opts) {
    const src = await decode(file);
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    const scale = opts.max && Math.max(w0, h0) > opts.max ? opts.max / Math.max(w0, h0) : 1;
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (opts.format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    const blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), opts.format, opts.quality));
    canvas.width = canvas.height = 0;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || opts.format, w, h };
  }

  async function process(item) {
    const token = (item.token = (item.token || 0) + 1);
    item.state = 'working';
    render(item);
    const s = settings();
    try {
      if (!item.bytes) item.bytes = new Uint8Array(await item.file.arrayBuffer());
      const info = PM.inspect(item.bytes);
      let out, mime, converted = false, dims = null, kept = [];
      if (s.mode === 'strip' && !info.error) {
        const r = PM.clean(item.bytes);
        out = r.bytes; mime = TYPE_MIME[r.type]; kept = r.kept || [];
      } else {
        const opts = s.mode === 'strip' ? { max: 0, format: 'image/jpeg', quality: 0.92 } : s;
        const r = await reencode(item.file, opts);
        out = r.bytes; mime = r.mime; dims = [r.w, r.h];
        converted = s.mode === 'strip';
      }
      if (token !== item.token) return;
      const check = PM.inspect(out);
      if (item.url) URL.revokeObjectURL(item.url);
      item.url = URL.createObjectURL(new Blob([out], { type: mime }));
      Object.assign(item, {
        state: 'done', info, out, mime, converted, dims,
        outName: outName(item.file.name, mime),
        remaining: (check.findings || []).filter(f => !INFO_ONLY.has(f.id)),
        kept,
      });
    } catch (e) {
      if (token !== item.token) return;
      item.state = 'error';
    }
    render(item);
    updateStatus();
  }

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    kids.forEach(c => c && n.append(c));
    return n;
  }

  function render(item) {
    const L = I18N[lang];
    const li = item.li;
    li.replaceChildren();
    const thumb = el('img', { class: 'thumb', alt: '', src: item.previewUrl, width: 88, height: 88, loading: 'lazy', decoding: 'async' });
    thumb.addEventListener('error', () => { thumb.removeAttribute('src'); });
    const body = el('div', { class: 'item-body' });
    body.append(el('p', { class: 'item-name', text: item.file.name }));
    if (item.state === 'working' || !item.state) {
      body.append(el('p', { class: 'item-meta', text: fmtSize(item.file.size) + ' · ' + L.working }));
    } else if (item.state === 'error') {
      body.append(el('p', { class: 'item-meta', text: fmtSize(item.file.size) }), el('p', { class: 'err', text: L.errRead }));
    } else {
      const found = item.info.findings.filter(f => !INFO_ONLY.has(f.id));
      let meta = fmtSize(item.file.size) + ' → ' + fmtSize(item.out.length);
      if (item.dims) meta += ' · ' + item.dims[0] + '×' + item.dims[1] + ' px';
      body.append(el('p', { class: 'item-meta', text: meta }));
      const badges = el('div', { class: 'badges' });
      if (found.some(f => f.id === 'gps')) badges.append(el('span', { class: 'badge danger', text: '⚠ ' + L.badgeGps }));
      badges.append(found.length
        ? el('span', { class: 'badge warn', text: L.badgeCount(found.length) })
        : el('span', { class: 'badge', text: L.badgeNone }));
      body.append(badges);
      if (found.length) {
        const ul = el('ul', { class: 'found', 'aria-label': L.badgeCount(found.length) });
        found.forEach(f => ul.append(el('li', { class: DANGER.has(f.id) ? 'danger' : '' },
          el('span', { class: 'k', text: L.f[f.id] || f.id }), el('span', { class: 'v', text: f.value || '✓' }))));
        body.append(ul);
      }
      if (item.converted) body.append(el('p', { class: 'item-meta', text: L.converted }));
      if (item.remaining.length) {
        body.append(el('p', { class: 'verify bad', role: 'alert', text: L.notVerified + item.remaining.map(f => L.f[f.id] || f.id).join(', ') }));
      } else {
        const kept = item.kept;
        body.append(el('p', { class: 'verify ok', text: '✓ ' + L.verified + (kept.length ? L.keptNote(kept.map(k => L.f[k]).join(', ')) : '') }));
      }
      const a = el('a', { class: 'btn primary', href: item.url, download: item.outName, text: '⬇ ' + L.download });
      a.setAttribute('aria-label', L.download + ': ' + item.outName);
      body.append(a);
    }
    li.append(thumb, body);
  }

  function updateStatus() {
    const done = items.filter(i => i.state === 'done');
    const working = items.some(i => i.state === 'working');
    $('#results').hidden = items.length === 0;
    $('#zipAll').disabled = working || done.length === 0;
    $('#status').textContent = working ? t('working')
      : items.length ? t('status')(done.length, done.filter(i => i.info.findings.some(f => f.id === 'gps')).length) : '';
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f && (f.type.startsWith('image/') || f.type === '' || /\.(jpe?g|png|webp|heic|heif|avif|gif)$/i.test(f.name)));
    if (!files.length) return;
    for (const file of files) {
      const li = el('li', { class: 'item' });
      const item = { id: nextId++, file, li, previewUrl: URL.createObjectURL(file) };
      items.push(item);
      $('#list').append(li);
      process(item);
    }
    updateStatus();
    $('#results').hidden = false;
  }

  let reprocessTimer;
  function reprocessAll() {
    clearTimeout(reprocessTimer);
    reprocessTimer = setTimeout(() => items.forEach(process), 150);
  }

  function uniqueNames(list) {
    const seen = new Map();
    return list.map(i => {
      let n = i.outName;
      const c = seen.get(n) || 0;
      seen.set(n, c + 1);
      if (c) n = n.replace(/(\.[^.]+)$/, '-' + (c + 1) + '$1');
      return { name: n, bytes: i.out };
    });
  }

  // ----- wiring -----
  const input = $('#file');
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); if (!drop.contains(e.target)) addFiles(e.dataTransfer.files); });
  window.addEventListener('paste', e => {
    const files = Array.from(e.clipboardData ? e.clipboardData.files : []);
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
    $('#resizeOpts').hidden = settings().mode !== 'resize';
    reprocessAll();
  }));
  ['#maxSize', '#format'].forEach(s => $(s).addEventListener('change', reprocessAll));
  $('#quality').addEventListener('input', () => { $('#qualityOut').textContent = $('#quality').value; });
  $('#quality').addEventListener('change', reprocessAll);

  $('#zipAll').addEventListener('click', () => {
    const done = items.filter(i => i.state === 'done');
    if (!done.length) return;
    const blob = window.makeZip(uniqueNames(done), PM.crc32);
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: t('zipName') });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  $('#clear').addEventListener('click', () => {
    items.forEach(i => { URL.revokeObjectURL(i.previewUrl); if (i.url) URL.revokeObjectURL(i.url); });
    items.length = 0;
    $('#list').replaceChildren();
    updateStatus();
    input.focus();
  });
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    try { localStorage.setItem('lang', lang); } catch (e) { /* private mode */ }
    applyLang();
  }));

  applyLang();
})();
