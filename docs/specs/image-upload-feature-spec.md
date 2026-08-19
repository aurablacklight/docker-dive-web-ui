# Image Upload Feature — Frozen Spec (2026-08-19)

## Goal

A user can upload a locally built Docker image (a `docker save` tarball) from their
computer through the Docker Dive web UI. The backend loads it into the host's Docker
daemon (`docker load`), and the image appears prominently in the UI, ready to inspect.

## Context

- Repo: `docker-dive-web-ui` (npm workspaces: `backend/`, `frontend/`).
- Backend: Express, all Docker invocations via `execFile` argv arrays in
  `backend/utils/docker.js`, image-name validation centralized in
  `backend/utils/image-name.js`. Routes mounted at both `/images` and `/api/images`
  (nginx strips `/api`).
- Frontend: React SPA (`frontend/src/App.js`), axios layer `frontend/src/services/api.js`
  (already exports an unused `getLocalImages()`), styles in `frontend/src/styles/simple.css`.
- nginx (`frontend/nginx.conf`) proxies `/api/` → backend. It currently has NO
  `client_max_body_size`, so the 1 MB default would reject uploads.
- Deployment target is an unprivileged LXC behind Cloudflare Access; Cloudflare Free
  caps request bodies at ~100 MB. The app-side limit is still larger (LAN/fallback
  deployments have no such cap); the UI notes the Cloudflare constraint.

## Backend

### New dependency

- `multer` (^2.0.0 — 1.x has known CVEs) added to `backend/package.json` dependencies.

### `dockerUtils.loadImage(filePath)` in `backend/utils/docker.js`

- Executes `execFile('docker', ['load', '-i', filePath])` via the existing
  `execFileAsync` helper. No shell interpolation anywhere.
- Parses stdout lines:
  - `Loaded image: <ref>` → collected into `loadedImages` (array of refs)
  - `Loaded image ID: <id>` → collected into `loadedImageIds`
- Returns `{ success: true, loadedImages, loadedImageIds, output: stdout }`.
- On failure throws `Error('Failed to load image: <underlying message>')` (matching
  the style of the other methods).
- Does NOT delete the file (the route owns the temp file lifecycle).

### New route: `POST /upload` in `backend/routes/images.js`

Multipart form upload, single file, field name `image`.

- Multer `diskStorage` into `path.join(__dirname, '..', 'temp', 'uploads')`
  (directory ensured at module load with `fs-extra`'s `ensureDirSync`). Filename is
  server-generated: `upload-<uuid>.tar` via the existing `uuid` dependency. The
  client-supplied filename is never used for paths or argv.
- Size limit: `limits.fileSize` from `parseInt(process.env.UPLOAD_MAX_BYTES)` when
  set and a positive integer, else default `1024 * 1024 * 1024` (1 GiB). Read at
  module load.
- Request handling order:
  1. Multer errors: `LIMIT_FILE_SIZE` → `413 { error: 'File too large', ... }`;
     other multer errors → 400.
  2. No file present → `400 { error: 'No image file uploaded', message: 'Attach a docker save tarball as multipart field "image"' }`.
  3. Magic-byte validation (read first 262 bytes of the stored file):
     - gzip `1f 8b`, bzip2 `42 5a 68` ("BZh"), xz `fd 37 7a 58 5a 00`,
       zstd `28 b5 2f fd`, or POSIX tar (`ustar` at offset 257).
     - No match → `400 { error: 'Invalid file type', message: 'File is not a tar archive or compressed tar archive' }`. No subprocess is spawned.
  4. `dockerUtils.isDockerAvailable()` false → `503 { error: 'Docker is not available or not accessible' }` (same shape as existing routes).
  5. `dockerUtils.loadImage(tempPath)`:
     - success → `200 { success: true, loadedImages, loadedImageIds, output, uploadedAt: ISO }`
     - failure → `502 { error: 'Failed to load image', message: <real error> }`.
       Real failures must surface as failures — no fabricated success (house rule).
- The stored temp file is deleted in a `finally` (via `fs-extra` `remove`,
  best-effort, errors logged not thrown) on every path where it was written,
  including validation failures and load failures.
- Route must be registered BEFORE `/:imageName` param routes so `upload` is not
  captured as an image name (Express matches in order; `POST /upload` vs
  `DELETE /:imageName` differ by method, but keep ordering explicit anyway).
- Log with `console.log`/`console.error` in the same style as existing routes.

### `server.js`

- Add `upload: '/api/images/upload'` to the development root endpoint listing.
- No other changes. (Body-parser JSON limits do not apply to multipart.)

## nginx (`frontend/nginx.conf`)

In the `location /api/` block add:

```
client_max_body_size 1g;
proxy_request_buffering off;
proxy_send_timeout 600s;
```

## Frontend

### `services/api.js`

New export:

```js
export const uploadImage = async (file, onProgress) => { ... }
```

- Builds `FormData` with field `image`.
- `api.post('/images/upload', formData, { timeout: 600000, onUploadProgress })`
  where `onUploadProgress` maps the axios event to a 0–100 integer percent and
  invokes `onProgress(percent)` when provided.
- Do NOT set Content-Type manually (axios/browser set the multipart boundary).
- Returns `response.data`; errors flow through the existing response interceptor.

### New component: `frontend/src/components/ImageUpload.js`

Props: `onUploaded(loadedImages: string[])`, `onInspect(imageName)`.

- A collapsed-by-default panel is NOT wanted; render a visible card titled
  "📤 Upload Local Image".
- File input (styled as a button, "Choose file…") accepting
  `.tar,.tar.gz,.tgz,.tar.bz2,.tar.xz,.tar.zst`, plus drag-and-drop onto the card.
- Shows the selected file name and human-readable size; a helper line:
  "Build locally, then `docker save myimage:tag -o myimage.tar` — max 1 GB
  (uploads over ~100 MB may fail through Cloudflare)."
- Upload button → calls `uploadImage(file, setProgress)`; shows a progress bar
  (percent) while uploading, then "Loading into Docker…" while awaiting the
  response after progress hits 100.
- Success: shows "Loaded: <refs joined>" (or the image ID when `loadedImages` is
  empty but `loadedImageIds` is not) and an "Inspect" button per loaded ref that
  calls `onInspect(ref)`; calls `onUploaded(loadedImages)`; clears the file
  selection.
- Failure: shows the error message from the thrown Error; keeps the file selected
  so the user can retry.
- Client-side pre-check: reject files over the 1 GiB limit with a local error,
  no request sent.

### `App.js` (search view)

- Render `<ImageUpload onUploaded={...} onInspect={handleInspect} />` directly
  below the search container, above Popular Images.
- New "💾 Local Images" section between the upload card and Popular Images:
  - State `localImages` fetched via `getLocalImages()` on mount (useEffect) and
    re-fetched after a successful upload. Fetch failures set the section to a
    quiet empty state (log to console; do NOT surface a page-level error, since
    the section is informational).
  - Each image renders as an existing-style `image-card` showing name, size and
    created; clicking (or Enter/Space, same a11y pattern as the other cards)
    calls `handleInspect(image.name)`; button label "Inspect".
  - Images whose name is in `recentlyUploaded` (state: refs from the last
    successful upload) are sorted to the front and get a "Just uploaded" badge.
  - Hide the whole section when the fetch returned zero images.
- Filter out `<none>`-named/dangling entries (listImages already maps them to a
  bare ID; hide entries whose repository is `<none>`).

### Styles (`frontend/src/styles/simple.css`)

Add classes for the upload card, progress bar, badge — visually consistent with the
existing cards (reuse `.image-card` / glassy styles where possible, minimal new CSS).

## Tests — ALL subprocess interactions mocked. Never run real `docker` commands.

### Backend (jest + supertest, follow `backend/test/images.test.js` patterns:
`jest.mock('child_process')` with `execFile` mock)

New `backend/test/upload.test.js` (+ additions to `docker-utils.test.js` for
`loadImage`):

1. `loadImage` invokes exactly `docker load -i <path>` (argv array asserted), parses
   `Loaded image:` and `Loaded image ID:` lines into arrays.
2. POST a small in-memory gzip-magic buffer (`.attach('image', buffer, 'x.tar.gz')`)
   → 200, response contains parsed `loadedImages`; exactly one `docker load` call;
   temp uploads dir is empty afterward (file cleaned up).
3. POST a valid ustar-magic buffer (262+ bytes with `ustar` at offset 257) → 200.
4. No file attached → 400, zero subprocess calls.
5. Buffer with garbage magic → 400 `Invalid file type`, zero subprocess calls,
   uploads dir empty afterward.
6. Oversize: with `UPLOAD_MAX_BYTES=1024` (set via env before requiring the route,
   use `jest.isolateModules` or a fresh require) a 2 KB upload → 413, zero
   subprocess calls.
7. `docker load` failure (execFile mock calls back with error) → 502 with the real
   message, uploads dir empty afterward.
8. Docker unavailable (mock `--version` failing, load never called) → 503.

Note: the existing shared `mockExecSuccess` makes every execFile succeed including
`docker --version`; structure mocks per-argv (inspect `args[0]`) where needed.

### Frontend (existing jest setup, axios mocked per `__mocks__` harness)

1. `api.test.js`: `uploadImage` POSTs FormData to `/images/upload`, returns data,
   and reports progress via the `onUploadProgress` option.
2. New `ImageUpload.test.js`: renders; selecting a file shows its name; successful
   upload calls `onUploaded` with the loaded refs and renders the loaded ref with
   an Inspect button that fires `onInspect`; failed upload renders the error.

## Non-goals

- Chunked/resumable uploads, multi-file upload, retagging on upload, registry push,
  auth changes, any change to delete/prune behavior, compose file changes.

## Constraints (hard)

- NO state-mutating Docker command may be executed during development or tests —
  the dev Mac hosts a live deployment. All tests mock `child_process`.
- No shell string interpolation; `execFile`/argv only.
- Do not touch `search.js` cat easter egg, terminal/PTY code, or delete flow.
- Follow existing code style (CommonJS backend, React function components,
  console logging style, error JSON shapes).

## Proof expected

- `cd backend && npx jest` — full backend suite green (87 existing + new).
- `cd frontend && npx jest` — no new failures (4 known pre-existing App.test.js
  failures are acceptable and unrelated).
- Report: files changed + test output summary.
