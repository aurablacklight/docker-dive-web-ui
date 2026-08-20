# Terminal Overhaul — Frozen Spec (2026-08-19)

## Goal

Replace the terminal pipeline (frontend rendering, transport, and PTY bridge) with
a modern 2026 stack: `@xterm/xterm` + WebGL rendering in a polished terminal
chrome, over a raw binary WebSocket with flow control, heartbeats, reconnect,
and hardened PTY lifecycle on the backend. Desktop-first; mobile stays
best-effort.

## Current state (what's being replaced)

- Frontend: deprecated `xterm@5.3` + `xterm-addon-fit`, DOM renderer, disabled
  ResizeObserver ("infinite loops"), rAF/setTimeout init hacks, socket.io
  transport (`frontend/src/components/TerminalView.js`).
- Backend: socket.io namespace `/ws/terminal` in `server.js` (lines ~173–212):
  validates image name, `pty.spawn('dive', [image])` at fixed 80×30, no
  heartbeat, no flow control, no session cap, no idle timeout.
- nginx `/ws/` location already proxies WebSocket upgrades with 3600 s timeouts —
  unchanged.

## Backend

### New dependency

- `ws` (^8) in `backend/package.json`.

### New module: `backend/ws/terminal.js`

Exports `attachTerminalServer(httpServer, { activePTYs })` — called once from
`server.js`. Uses `new WebSocketServer({ noServer: true })` plus an `upgrade`
listener on the HTTP server that only claims `pathname === '/ws/terminal'`
(other upgrades — socket.io — must be left alone: only handle the upgrade when
the pathname matches).

**Handshake.** Query params: `image` (required), `cols`, `rows` (optional
initial size). Validate with the existing `validateImageName`. Invalid image →
respond on the raw socket with `HTTP/1.1 400 Bad Request` and destroy — no PTY,
no WebSocket. Session cap reached → complete the upgrade, then close with code
`1013` and reason `Too many terminal sessions` — no PTY.

**Limits (env-tunable, read at module load):**
- `TERMINAL_MAX_SESSIONS` (default 8) — concurrent WebSocket terminal sessions.
- `TERMINAL_IDLE_TIMEOUT_MS` (default 900000, 15 min) — no client *input* for
  this long → write a `\r\n[session closed after inactivity]\r\n` binary frame,
  kill the PTY, close with code 1000.

**PTY.** `pty.spawn('dive', [image], { name: 'xterm-256color', cols, rows, env: process.env })`
with cols/rows from the query clamped to [2, 500] (fallback 80×30, non-numeric →
fallback). Add to the shared `activePTYs` set (same set `server.js` owns —
`killAllPTYs` and `pty-cleanup.test.js` keep working); remove on exit/cleanup.

**Protocol.**
- Server → client binary frames: raw PTY output (`Buffer`).
- Server → client text frames (JSON): `{"type":"ready","cols":N,"rows":N}` once
  after spawn; `{"type":"exit","code":N}` on PTY exit (then close 1000).
- Client → server binary frames: keyboard input, UTF-8; written to the PTY.
- Client → server text frames (JSON): `{"type":"resize","cols":N,"rows":N}` →
  `shell.resize(clampedCols, clampedRows)`. Unknown/malformed JSON is ignored
  (never crashes the session).

**Heartbeat.** Server pings every 30 s (`ws.ping()`); a connection that misses
two consecutive pongs is terminated (and its PTY killed). Keeps Cloudflare's
idle timeout from silently killing quiet sessions.

**Flow control (backpressure).** On PTY output, after `ws.send(data)`: if
`ws.bufferedAmount > 1 MiB`, call `shell.pause()`; a 250 ms interval resumes
(`shell.resume()`) once `bufferedAmount < 256 KiB`. Interval is cleared on
cleanup. (node-pty `pause()`/`resume()`; guard with `typeof` checks so mocks
without them don't throw.)

**Cleanup.** One idempotent cleanup path: kill PTY if alive, remove from
`activePTYs`, clear timers/intervals, close ws if open. Wired to ws `close`,
ws `error`, and PTY `onExit`.

### `server.js` changes

- Delete the socket.io `/ws/terminal` namespace block entirely (`node-pty`
  import and `pty.spawn` leave server.js; `activePTYs`/`killAllPTYs` stay).
- `require('./ws/terminal').attachTerminalServer(server, { activePTYs })` after
  the HTTP server is created.
- socket.io main namespace (inspect updates) untouched.

## Frontend

### Dependencies

Remove: `xterm`, `xterm-addon-fit`, `socket.io-client` (nothing else imports it).
Add: `@xterm/xterm` (^5.5), `@xterm/addon-fit`, `@xterm/addon-webgl`,
`@xterm/addon-unicode11`.

### `frontend/public/index.html`

Add Google Fonts preconnect + stylesheet for **JetBrains Mono** (400, 700).
(nginx serves the frontend; no CSP blocks this. The backend helmet CSP already
allows fonts.googleapis.com/fonts.gstatic.com for its own responses.)

### Rewrite `frontend/src/components/TerminalView.js`

Props unchanged: `image` (required), `onExit` (required) — App.js stays as-is.

**Terminal construction:**
- Options: `cursorBlink: true`, `fontSize: 14`,
  `fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace'`,
  `scrollback: 5000`, `theme` matching the app's dark glass palette (solid
  background — no `allowTransparency`, it kills WebGL perf).
- Addons: fit, unicode11 (`term.unicode.activeVersion = '11'`), and WebGL —
  loaded in try/catch; on failure or on the addon's `onContextLoss`, dispose the
  WebGL addon and fall back to the default renderer. Never let a WebGL failure
  break the terminal.
- Open into the container, `fit()`, focus. No rAF polling loops: the container
  is guaranteed visible (component renders it directly).

**Resize:** one debounced (100 ms) `ResizeObserver` on the container:
`fit()`, then send the resize JSON **only when cols/rows actually changed**
(this guard is what prevents the old infinite loop). Disconnect the observer on
cleanup. No window resize listener, no manual Resize button.

**Transport:** native WebSocket to
`(location.protocol === 'https:' ? 'wss' : 'ws')://${location.host}/ws/terminal?image=...&cols=...&rows=...`
in production; `ws://localhost:3000/ws/terminal?...` in development.
`binaryType = 'arraybuffer'`.
- `term.onData` → `TextEncoder` → binary send (only when socket OPEN).
- Binary message → `term.write(new Uint8Array(data))`.
- Text message → JSON parse: `ready` → status connected; `exit` → status
  exited, write `\r\n[dive exited with code N]\r\n`, call `onExit(code)` is NOT
  automatic — show the exited state with Restart instead (the parent's Exit
  path remains the back-button / Exit button).

**Reconnect:** on abnormal close (code ≠ 1000 and not user-initiated and not
after `exit`), auto-reconnect with backoff 1 s → 2 s → 4 s → 8 s → 15 s, max 5
attempts, status `reconnecting (n/5)`; a fresh PTY session results (dive state
is lost — that's acceptable and shown: `[reconnected — new dive session]`).
After max attempts → status `error` with a Reconnect button.

**Status model:** `connecting | connected | reconnecting | exited | error` —
drives the status dot and label in the chrome.

**Chrome (desktop-first):** a `terminal-frame` card:
- Header: status dot (color by status) + title `dive — <image>` + actions:
  **Copy** (copies current selection, else whole buffer, via
  `navigator.clipboard.writeText`), **Fullscreen** (Fullscreen API on the
  frame, listens to `fullscreenchange`, refits), **Restart** (close current
  socket with code 1000 + flag as user-initiated, fresh connection),
  **Exit** (sends `q` — dive's quit key), **Help** (toggles the existing
  shortcuts panel, content preserved, restyled to match).
- Copy-on-select: `term.onSelectionChange` → if selection non-empty, silently
  `clipboard.writeText(selection)` (wrapped in try/catch; clipboard may be
  unavailable).
- Body: the xterm container, `min-height: 480px`, fills the frame width;
  fullscreen mode stretches it to viewport.
- Footer removed (old Exit/Resize/Help button row replaced by header actions).

### Styles (`frontend/src/styles/simple.css`)

New `terminal-frame` block: glass-consistent dark card, header bar, status dot
colors (connecting/reconnecting amber, connected green, exited gray, error red),
action buttons consistent with existing `.glass` buttons, fullscreen styles.
Import of `@xterm/xterm/css/xterm.css` moves with the package rename.

## Tests — subprocess/PTY always mocked; never run real docker or dive.

### Backend: replace `test/terminal.test.js` with `test/terminal-ws.test.js`

Real HTTP server on an ephemeral port + real `ws` clients against it;
`node-pty` mocked (same mockShell shape as today: write/resize/kill/onData/
onExit). Cases:
1. Valid image: upgrade succeeds, PTY spawned with `dive [image]` and clamped
   query cols/rows; `ready` JSON received.
2. PTY output arrives as binary frames with the exact bytes.
3. Binary client frame → `shell.write` with the decoded string.
4. Resize JSON → `shell.resize(cols, rows)`; out-of-range values clamped;
   malformed JSON ignored (no throw, session stays open).
5. Invalid image (`Bad/Image:latest`) → HTTP 400 upgrade rejection, `pty.spawn`
   never called.
6. PTY exit → `{"type":"exit","code":N}` then close 1000, PTY removed from
   activePTYs.
7. Client disconnect → shell killed, removed from activePTYs.
8. Session cap: with `TERMINAL_MAX_SESSIONS=1` (isolateModules or direct module
   state), second connection closes with 1013 and spawns nothing.
9. `pty-cleanup.test.js` keeps passing unchanged (shared activePTYs contract).

### Frontend: replace `src/__tests__/TerminalView.test.js`

Mock `@xterm/xterm` + addons (factory mocks) and a scripted global WebSocket
mock; `ResizeObserver` mock. Cases: renders chrome with image name; opens WS
with encoded image + size params; binary frame → term.write; `exit` message →
exited status + Restart button; Exit button sends `q`; abnormal close →
reconnecting status; unmount closes socket and disposes terminal. The one
pre-existing red TerminalView test disappears with the rewrite (net: known
failures drop from 4 to 3 — App.test.js 1 + integration 2 remain, untouched).

## Non-goals

- Mobile touch key bar / soft-keyboard handling (explicitly deferred).
- Session persistence/reattach across reconnects (new PTY per connection).
- Multi-tab terminals, shell access (PTY stays `dive <image>` only — house rule).
- Changing the inspect-progress socket.io channel or nginx config.

## Constraints (hard)

- NO state-mutating docker/dive execution during dev or tests; PTY and
  subprocesses always mocked. The dev Mac hosts a live deployment.
- Image validation stays centralized (`utils/image-name.js`), applied before
  any PTY spawn — exactly one validation path, same as HTTP routes.
- `activePTYs`/`killAllPTYs` shutdown semantics preserved.
- Follow existing code style; CommonJS backend, function components frontend.

## Amendments after code review (2026-08-20)

A high-effort review confirmed 10 findings; the contract changed as follows:

1. **Upgrade reaping widened.** With `destroyUpgrade: false`, the terminal
   module is now the reaper for EVERY unclaimed upgrade (anything that is not
   `/ws/terminal` or `/socket.io/*` is destroyed) — the original "only claim
   /ws/terminal" wording left non-/ws/ upgrades hanging (fd-leak DoS).
2. **Spawn hardening.** `pty.spawn` failures close the socket with 1011 and
   free the session-cap slot; the PTY runs with `encoding: null` (Buffers
   pass through un-re-encoded) and an env allowlist (PATH/HOME/TERM/LANG/
   DOCKER_*) — never full `process.env`, which leaked secrets and CI=true
   (from .env.example) would have forced dive into non-interactive mode.
3. **Client close-code semantics.** 1000 without a prior exit message (server
   idle timeout) → exited state with Restart; 1008/1011/1013 → error with the
   server's reason shown, no retries; the retry counter resets only on
   `ready` (a bare open no longer resets it — prevents an infinite reconnect
   storm against a full server); `onclose` ignores sockets that are no longer
   current (image-switch/StrictMode ghost reconnects); the reconnect banner
   moved into the `ready` handler; a resize during CONNECTING no longer
   poisons the grid guard, and `ready` re-syncs the PTY size.
4. **Terraform deployment path.** `terraform/nginx.conf.tpl` gained a `/ws/`
   upgrade-proxy location and CSP allowances for Google Fonts (that edge
   previously made the raw-WS terminal and JetBrains Mono unreachable).
5. Copy-on-select debounced (200 ms); legacy `.terminal` CSS card rule
   deleted; dead backend `socket.io-client` devDependency removed; jsdom
   test env gained inert WebSocket + ResizeObserver defaults.

## Proof expected

- `cd backend && npm test` — green (99 existing minus 2 replaced socket.io
  terminal tests + new ws suite).
- `cd frontend && npm run test` — new TerminalView suite green; known failures
  shrink to 3 (App.test.js 1, integration.test.js 2).
- `cd frontend && npm run build` — compiles clean.
- Real end-to-end (PTY over ws through nginx + tunnel + Access) verified on
  LXC 107 after deploy, from browser.
