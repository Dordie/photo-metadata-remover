# Photo Metadata Remover

A small, free web tool that shows you the hidden data in your photos (GPS location, date and time, camera or phone model, serial number, editing software, embedded previews) and gives you a clean copy before you share them.

**Everything runs in your browser.** Photos are never uploaded. The page's Content-Security-Policy sets `connect-src 'none'`, so it can't make network requests at all, and it keeps working offline once loaded (or when opened straight from disk).

Free, no ads, no tracking, no cookies, no build step, no dependencies. English and German UI.

![Screenshot](screenshot.png)

## Features

- **Look before you share.** Lists what's in each photo and highlights location and identifying data (GPS, device serial number, owner name).
- **Lossless cleaning** for JPEG, PNG and WebP. The image data is copied byte for byte and only the metadata blocks are dropped, so there's no re-compression and no quality loss.
  - Removed: EXIF (incl. GPS and maker notes), XMP (incl. editing history), IPTC/Photoshop blocks, comments, PNG text and time chunks, embedded thumbnails and MPF images, and any data appended after the image (for example motion-photo video).
  - Kept, because the picture needs them to display correctly: the rotation flag (re-written as a minimal EXIF block that holds only the orientation) and the ICC colour profile.
- **Verification.** Each cleaned file is scanned again and the result is shown ("Checked: the clean copy contains no metadata").
- **Optional "make smaller" mode.** Re-encodes to JPEG, WebP or PNG with a maximum size and quality you choose. Rotation is baked into the pixels. This also converts formats the browser can display but that can't be cleaned losslessly (HEIC in Safari, AVIF, GIF).
- Several files at once, drag & drop, paste, "Download all" as a ZIP.
- Mobile friendly, dark mode, keyboard accessible, labelled controls, respects reduced motion.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page markup, CSP, FAQ, footer |
| `style.css` | Styles (light and dark) |
| `metadata.js` | Format parsers and cleaners (JPEG, PNG, WebP, TIFF/EXIF, XMP). No DOM, so it also runs in Node |
| `zip.js` | Minimal ZIP writer (stored entries) |
| `app.js` | UI, translations, re-encoding via canvas |
| `favicon.svg` | Icon |
| `tests/` | Fixture generator, Node unit tests, Pillow output check, headless Chrome E2E test |

## Run locally

Open `index.html` in a browser, or serve the folder with any static server:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy (GitHub Pages)

Push these files to a repository, then go to Settings → Pages → "Deploy from a branch" → `main` / root. The `tests/` folder can stay; it isn't loaded by the page.

## Tests

```sh
python3 tests/make_fixtures.py            # (run inside tests/) builds images with known EXIF/GPS/XMP/ICC/trailers (needs Pillow)
node tests/unit.test.js                   # parser and cleaner unit tests
(cd tests && python3 verify_outputs.py)   # Pillow: cleaned files decode to identical pixels, no metadata left
npm i puppeteer-core && node tests/e2e.test.js   # headless Chrome: full UI flow, offline, CSP, downloads, DE/EN, mobile, file://
```

## Limitations

- Lossless cleaning supports JPEG, PNG and WebP. HEIC/AVIF/GIF only work through "make smaller" (re-encoding), and only in browsers that can decode them. GIF animations become a single frame.
- "Make smaller" output has no colour profile, so wide-gamut (Display P3) photos can look slightly less saturated. Lossless mode keeps the profile.
- WebP rotation metadata isn't preserved (browsers generally ignore it anyway).
- Video files and RAW camera formats aren't supported.
- The file name itself isn't changed apart from adding `-clean`. If the name contains personal information, rename the file.
- Removing metadata doesn't hide what's *in* the picture (street signs, faces, reflections).
