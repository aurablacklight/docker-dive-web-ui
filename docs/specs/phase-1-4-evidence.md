# Docker Dive hardening — Phases 1–4 acceptance evidence

Branch: `harden/cloudflare-lxc`  HEAD: `ccc8ca882a8cb44b139b3168335d651813c27217`
Base: `bef3cf2`  Diff: 22 files, +1299 / −1969   Pushed: NO (remote still at bef3cf2)

## Commits
```
e0ca519 test: repair frontend axios mock harness
6cf6cb6 feat: replace global image cleanup with targeted delete
3f5d217 feat: centralize image validation and remove shell interpolation
ccc8ca8 fix: report real docker availability in health endpoints
```

## Test results (run independently, not taken from the implementing agent)
| Suite | Baseline | After |
|---|---|---|
| Backend | 9 / 10 | 87 / 87 |
| Frontend | 24 / 41 | 36 / 40 |

Remaining 4 frontend failures are pre-existing rot, all present at baseline:
- App Component > loading states work correctly  (asserts on string "searching for images",
  which never existed in App.js — verified against `git show bef3cf2:frontend/src/App.js`)
- App Integration Tests > complete search and inspect workflow
- App Integration Tests > error handling throughout the workflow
- TerminalView Component > exit button calls onExit callback

## Mutation test (proof the tests have teeth)
Replaced `validateImageName` body with `return {valid:true}`:
  → 36 of 37 security/terminal tests FAILED. Restored; `git diff` clean.

## Phase 4 — live regression against built images
Built as `:harden-test` (NOT `:latest`) so the running deployment's images were never retagged.
Stack: compose project `diveharden`, ports 127.0.0.1:3100/3101, named volume for /app/temp.

Security, live:
```
POST /api/images/cleanup              -> 404  (endpoint removed)
DELETE /api/images/alpine:latest?force=true -> 400, image NOT deleted
pull "alpine;id"                      -> 400
pull "alpine && id"                   -> 400
pull "$(id)"                          -> 400
pull "`id`"                           -> 400
pull "--help"                         -> 400
pull "name with spaces"               -> 400
pull "Bad/Image:latest"               -> 400  (uppercase; OLD server.js regex accepted this)
```

Health (Phase 3 acceptance) inside the container with the real mounted socket:
```
GET /api/health  -> docker.available: true
GET /health      -> docker.available: true
```
For contrast, the OLD live deployment on :3001 still reports `docker.available: false` —
the bug §5 identified, now fixed.

Targeted delete (the Phase 4 gate):
```
BEFORE: alpine:latest 1991bd789d71 | busybox:latest e0e8b3cbfed6 | 4x dive-inspector
DELETE /api/images/alpine%3Alatest -> 200, "Untagged/Deleted: alpine" only
AFTER : busybox:latest e0e8b3cbfed6 (SAME ID) | 4x dive-inspector (ALL SAME IDs)
diff  : exactly one line removed (alpine)
builder du: 1.097GB BEFORE -> 1.097GB AFTER  (identical; no prune ran)
backend logs: no prune / bulk-rmi / cleanup invocation
```

Terminal WebSocket via the nginx proxy path (the path Cloudflare will traverse):
```
busybox:latest    -> PTY DATA OK ("Image Source: docker://busybox:latest")
Bad/Image:latest  -> rejected before PTY spawn
alpine;id         -> rejected before PTY spawn
```

Rollback anchors verified intact at the end:
```
https://dereks-mac-mini.tail6a8276.ts.net:8443/ -> 200
http://127.0.0.1:3001/                          -> 200
dive-inspector-{backend,frontend}:latest image IDs unchanged since session start
both live containers still healthy, uptime 3h (never restarted)
```

## Leftovers on the Mac
- `dive-inspector-backend:harden-test` a6c14d7f021e   (verified build artifact)
- `dive-inspector-frontend:harden-test` c7ec4abb6d5e  (verified build artifact)
- `busybox:latest` e0e8b3cbfed6                       (test fixture)
- Builder cache grew 647.3MB -> 1.097GB from the amd64 build.
Temp stack, its network and its volume were removed. `alpine:latest` was consumed by the test.
