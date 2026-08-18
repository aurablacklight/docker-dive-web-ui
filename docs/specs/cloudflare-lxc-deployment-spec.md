# Docker Dive LXC + Cloudflare Deployment Specification

> **For Hermes or Claude Code:** implement this specification in phases. Do not create public/external resources, modify Proxmox, or change the current Mac deployment until Derek explicitly authorizes execution and supplies the required access inputs.

**Status:** Phases 0a–4 complete and verified. Phases 5–11 tabled pending Derek's §6 inputs.  
**Prepared:** 2026-08-18 CDT  
**Revised:** 2026-08-18 — corrections from execution folded in; see §5a.  
**Source checkout:** `/Users/derek/docker-dive`  
**Upstream:** `https://github.com/aurablacklight/docker-dive-web-ui`  
**Inspected commit:** `bef3cf2ac598055b2224bdacc9118202bd02f57e`  
**Hardening branch:** `harden/cloudflare-lxc` @ `ccc8ca8` (local only, not pushed)

## 1. Goal

Deploy Docker Dive Web UI in a dedicated, unprivileged Proxmox LXC and publish it through a Cloudflare Tunnel protected by Cloudflare Access. Preserve the current tailnet-only Mac deployment until the new deployment passes end-to-end acceptance tests.

## 2. Architecture

```text
Phone/browser
    |
    | HTTPS + Cloudflare Access authentication
    v
Cloudflare edge
    |
    | outbound-only Cloudflare Tunnel
    v
cloudflared (native systemd service inside LXC)
    |
    | http://127.0.0.1:3001
    v
Frontend container (nginx)
    |
    | Docker network: backend:3000
    v
Backend container (Node/Express + dive + Docker CLI)
    |
    | /var/run/docker.sock from the LXC's nested Docker daemon
    v
Nested Docker daemon inside the unprivileged LXC
```

Cloudflare Tunnel maps a public hostname to a local service over an outbound connector.[1] Cloudflare Access is deny-by-default unless a user matches an Allow policy and can require the tunnel to validate the Access token before forwarding traffic.[2] Cloudflare supports proxied WebSockets, which are required by the interactive terminal.[3]

## 3. Scope

### In scope

- Harden the application before broader exposure.
- Create one dedicated Proxmox LXC.
- Install Docker Engine inside that LXC.
- Build and run the frontend/backend stack.
- Install `cloudflared` natively as a systemd service.
- Create a Cloudflare Tunnel, DNS hostname, and Access application.
- Verify search, pull, inspect, targeted delete, API, health checks, and terminal WebSockets.
- Add LXC backup coverage.
- Keep the current Tailscale deployment as rollback until Derek approves retirement.

### Out of scope

- A Cloudflare Workers/Sandbox rewrite.
- Anonymous/public access without authentication.
- Running unrelated Docker workloads in this LXC.
- High availability, multi-region deployment, Kubernetes, or Terraform.
- Modifying router port forwards.
- Removing the current Mac deployment before final approval.

## 4. Non-negotiable safety requirements

1. The LXC must be **unprivileged**.
2. Enable only the LXC features required for nested Docker: `nesting=1,keyctl=1`.
3. Do not mount Proxmox host paths, devices, or the host Docker socket into the LXC.
4. Docker Dive must be the LXC's only Docker application.
5. Install `cloudflared` natively, not as a Docker container.
6. Bind frontend/backend host ports to `127.0.0.1`, not `0.0.0.0`.
7. No WAN port forward may be created.
8. The Cloudflare hostname must be protected by a deny-by-default Access policy.
9. Secrets and tunnel tokens must not be committed to Git or written into this specification.
10. Remove the global cleanup behavior before the Cloudflare hostname is enabled.
11. Docker commands must use argument arrays (`execFile`/`spawn`), not shell-interpolated command strings.
12. Keep the Mac/Tailscale deployment available until acceptance and rollback checks pass.
13. The targeted delete API must not accept or honor any force-delete option.
14. Invalid image references must fail closed with HTTP `400`; they must not trigger fallback content or a subprocess.
15. If nested Docker fails in the standard unprivileged LXC, stop and use a VM fallback. Do not weaken LXC isolation with privileged mode, host mounts, `lxc.apparmor.profile=unconfined`, or broad device passthrough.

## 5. Current-state findings

- The app builds successfully as `dive-inspector-backend:latest` and `dive-inspector-frontend:latest`.
- The current Mac deployment is available through Tailscale Serve on HTTPS port `8443`.
- Pull and inspect worked for `nginx:latest`; inspection reported 98.87% efficiency.
- `POST /api/images/cleanup` deleted `nginx:latest`, also deleted unrelated `gotenberg/gotenberg:8`, and ran `docker system prune -f`.
- `backend/routes/images.js` already has a targeted endpoint: `DELETE /api/images/:imageName`.
- `frontend/src/services/api.js` already has `removeImage(imageName)`, but the main UI calls `cleanupAllImages()` instead.
- `backend/utils/docker.js` uses shell-interpolated Docker commands in several methods.
- `backend/server.js` incorrectly instantiates `require('./utils/docker')` even though that module exports an instance, causing health output to report `docker.available: false` while Docker works.
- The upstream worktree was clean before this specification was added.

### 5a. Additional findings discovered during Phase 1–4 execution (2026-08-18)

These were not in the original draft. Each was verified against the code at `bef3cf2`.

- **`npm ci` per-package is impossible.** There is no `backend/package-lock.json` or
  `frontend/package-lock.json` — this is an npm workspaces repo with a single root lockfile. The
  spec's `cd backend && npm ci` commands fail outright. See the corrected commands in Phase 1.
- **`node-pty` will not build on Derek's Mac without an explicit SDK.** `xcode-select -p` points at
  `Xcode-beta.app` and node-gyp fails to pass `-isysroot`, so the build dies on
  `fatal error: 'stdio.h' file not found`. Both SDKs contain the headers; the fix is redirecting
  `SDKROOT`, not installing anything.
- **`dive` is not installed natively on the Mac.** Any test that spawns a real `dive` binary cannot
  pass locally and must mock `node-pty`. `backend/test/terminal.test.js` was failing at baseline for
  this reason.
- **The frontend test suite was already 17/41 red**, and the `api.test.js` / `App.test.js` /
  `integration.test.js` failures shared one root cause: the axios mock never attaches, because
  `src/services/api.js` creates its instance at module load before the mock is installed. Phase 1's
  required frontend tests are meaningless until this is repaired — hence the added Phase 0a below.
- **`backend/routes/inspect.js` contained TWO cat fallbacks, not one.** Besides the invalid-input
  fallback, a second fired when the inspection itself *failed*, returning HTTP `200` with fabricated
  layer and efficiency data. For an internet-exposed service this is the more dangerous of the two:
  a failed pull or dive run silently reported success. Phase 2 now removes both.
- **`backend/server.js` carried its own private `isValidImageName` regex** guarding the
  `/ws/terminal` socket, more permissive than the HTTP paths (accepted uppercase, rejected digests).
  Phase 2 now names it explicitly for replacement.
- **`docker buildx bake` defaults to `TAG=latest`**, which retags
  `dive-inspector-{backend,frontend}:latest` — the exact tags the running Mac deployment uses,
  leaving those containers on dangling images. Phase 4 now requires a tag override.

## 6. Inputs required from Derek

The implementer must stop and obtain these values before making external changes.

| Input | Required value | Recommended default | Handling |
|---|---|---|---|
| Proxmox management endpoint | IP or resolvable hostname | Cluster management IP | Non-secret |
| Proxmox authorization | API token or authenticated management path | Scoped API token stored locally | Never paste token into chat or commit it |
| Proxmox node | `pve` or `pve-node2` | Select after live capacity/storage check | Auto-select if authorized |
| CT ID | Unused numeric ID | `pvesh get /cluster/nextid` | Auto-select |
| Proxmox storage | Root disk storage | Storage covered by normal backups | Auto-select after inspection |
| Network bridge/VLAN | Bridge and optional VLAN tag | Existing server LAN bridge | Auto-detect/confirm |
| IP assignment | DHCP or static/reservation | DHCP plus UniFi reservation | User preference |
| Cloudflare zone | Managed domain | Required | Non-secret |
| App hostname | FQDN | `dive.<zone>` | User decision |
| Access identity | Allowed email/IdP identity | Derek only | Private configuration |
| Cloudflare authorization | Dashboard session or scoped API token | Browser/dashboard for first deployment | Token stays local |
| Git destination | Fork/branch or local-only patch | Derek-controlled fork and feature branch | Do not push without approval |
| Backup target | Proxmox backup job/storage | Existing weekly NFS job, keep 4 | Confirm before editing job |

## 7. Recommended LXC specification

| Setting | Value |
|---|---|
| Hostname | `docker-dive` |
| OS | Debian 13 standard template |
| Type | Unprivileged LXC |
| Features | `nesting=1,keyctl=1` |
| CPU | 2 cores |
| RAM | 4096 MiB |
| Swap | 512 MiB |
| Root disk | 40 GiB |
| Network | Existing server bridge, DHCP initially |
| Firewall | Enabled |
| Startup | `onboot=1`, ordered after networking |
| Tags | `docker`, `cloudflare`, `utility` |
| Backup | Weekly `vzdump`, retain 4, after acceptance |

Proxmox documents that LXC shares the host kernel and that unprivileged containers map root inside the container to an unprivileged host user. It also identifies nesting as the feature that exposes the required procfs/sysfs interfaces.[4]

## 8. Implementation phases

### Phase 0 — Preflight and rollback anchors

**Objective:** prove the existing environment is safe to modify and establish rollback points.

1. Verify the local checkout and record the exact commit:

   ```bash
   cd /Users/derek/docker-dive
   git status --short --branch
   git rev-parse HEAD
   git remote -v
   ```

   Expected: only this specification is untracked/modified; no unknown application changes.

2. Create a working branch only after Derek chooses the Git destination:

   ```bash
   git switch -c harden/cloudflare-lxc
   ```

3. Verify the current Mac fallback before touching infrastructure:

   ```bash
   curl -fsS -o /dev/null -w '%{http_code}\n' \
     https://dereks-mac-mini.tail6a8276.ts.net:8443/
   ```

   Expected: `200`.

4. Read-only Proxmox preflight:
   - Verify cluster quorum.
   - List nodes, guests, storage, free resources, and backup jobs.
   - Select an unused CT ID.
   - Verify the Debian 13 LXC template is present or downloadable.
   - Confirm the chosen node and storage have enough capacity.

5. Record rollback anchors:
   - Current Git commit.
   - Current Tailscale Serve status.
   - Existing Mac container/image status.
   - Selected LXC CT ID and storage.

**Gate:** no Proxmox or Cloudflare write until this phase is green.

### Phase 1 — Remove destructive cleanup behavior

**Objective:** make Delete remove only the explicitly selected image and never run global prune.

**Files:**

- Modify: `backend/routes/images.js`
- Modify: `backend/utils/docker.js`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/__tests__/api.test.js`
- Modify: `frontend/src/__tests__/App.test.js`
- Modify: `frontend/src/__tests__/integration.test.js`
- Create or modify backend route/unit tests under `backend/test/`

**Required behavior:**

1. Remove `POST /api/images/cleanup` from `backend/routes/images.js`, or make it return `410 Gone` with a non-destructive migration message. Preferred: remove it entirely.
2. Remove `cleanupAllImages()` from `backend/utils/docker.js`.
3. Remove `cleanupAllImages()` from `frontend/src/services/api.js`.
4. Replace the global header cleanup button with a delete action tied to `currentImage` after a successful inspection.
5. Confirmation text must name the exact image:

   ```text
   Delete nginx:latest from this Docker Dive host?
   This does not prune any other images or build cache.
   ```

6. Call `removeImage(currentImage)` and display the exact deleted image in the success message.
7. Remove query parsing for `force`. `DELETE ...?force=true` must return HTTP `400` and perform no Docker command.
8. Always call plain `docker rmi <exact image>` without `-f`. If an image is in use, report the Docker error without escalation.
9. Never invoke `docker system prune`, `docker image prune`, or bulk `docker rmi`.

**Required tests:**

- The targeted delete API calls `docker rmi <exact image>` once.
- A second unrelated image remains present.
- The two service images cannot be selected through the normal UI cleanup flow.
- The removed global endpoint returns `404` or `410` and performs no Docker commands.
- `?force=true` returns `400` and performs no Docker command.
- Cancellation performs no API call.
- Namespaced/tagged image names are encoded and decoded correctly.

**TDD commands:**

Install once, at the repo root. This is an npm workspaces repo with a single root lockfile, so
`cd backend && npm ci` fails. On Derek's Mac the `SDKROOT` override is also required or `node-pty`'s
gyp build dies on a missing `stdio.h`.

```bash
cd /Users/derek/docker-dive
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk npm ci

cd /Users/derek/docker-dive/backend
npx jest --detectOpenHandles --forceExit

cd /Users/derek/docker-dive/frontend
npx jest
```

### Phase 0a — Repair the frontend test harness

**Objective:** make Phase 1's required frontend assertions meaningful.

The axios mock in `frontend/src/__tests__/` never attaches, so `axios.create` is never called and
every `api.js`-dependent test fails regardless of behavior. Repair the mock before writing any
Phase 1 test. Do not change `src/services/api.js`'s public behavior to achieve it.

**Gate:** the pre-existing `searchImages` and `inspectImage` tests must pass before Phase 1 begins.

### Phase 2 — Eliminate shell interpolation and centralize image validation

**Objective:** prevent command injection and keep image-name rules consistent across pull, inspect, delete, and terminal paths.

**Files:**

- Create: `backend/utils/image-name.js`
- Modify: `backend/utils/docker.js`
- Modify: `backend/utils/dive.js`
- Modify: `backend/routes/images.js`
- Modify: `backend/routes/inspect.js`
- Modify: `backend/server.js`
- Create: `backend/test/image-name.test.js`
- Modify/add tests under `backend/test/`
- Delete after confirming they are unreferenced: `backend/routes/inspect_backup.js`
- Delete after confirming they are unreferenced: `backend/routes/inspect_new.js`

**Required implementation:**

1. Export one validator for Docker image references, maximum 255 characters. Reject leading/trailing whitespace rather than silently trimming it.
2. Support this explicit policy: `[registry[:port]/]repository[/path...][:tag][@sha256:<64 lowercase hex>]`.
3. Repository and registry components must be lowercase. Tags may contain letters, digits, `_`, `.`, and `-`, must start with a letter/digit/underscore, and are limited to 128 characters. Registry ports must be numeric. Local image IDs such as `sha256:<id>` are not accepted as public API inputs.
4. Preserve supported names such as:
   - `nginx`
   - `nginx:latest`
   - `library/nginx:latest`
   - `ghcr.io/owner/repo:tag`
   - `registry.example.com:5000/owner/repo:tag`
   - `alpine@sha256:<64 lowercase hex>`
5. Reject uppercase repository/registry components, malformed digests, shell metacharacters, whitespace, newlines, leading dashes, URL schemes, and empty names.
6. Replace `child_process.exec` command strings with `execFile` or `spawn` argument arrays in `pullImage`, `listImages`, `removeImage`, `getImageInfo`, `isDockerAvailable`, `getDockerVersion`, `imageExists`, `getImageHistory`, and `isDiveAvailable`.
7. Apply validation before every Docker or dive operation.
8. Keep PTY spawning as `pty.spawn('dive', [image])` only after centralized validation. Delete the
   private `isValidImageName` regex in `backend/server.js` that currently guards the `/ws/terminal`
   socket and replace it with the shared validator. It is more permissive than the HTTP paths — it
   accepts uppercase references and rejects digests — and that divergence is the bug.
9. Remove **both** cat fallbacks from `backend/routes/inspect.js`:
   - (a) the invalid-input fallback. Invalid references must return HTTP `400` and must not call
     Docker, dive, cat utilities, `execFile`, `spawn`, or `pty.spawn`.
   - (b) the inspection-**failure** fallback, which returns HTTP `200` with fabricated layer and
     efficiency data when a pull or dive run genuinely fails. It must return a real status — `404`
     when the image does not exist, `502` for a downstream Docker/dive failure — and the real error
     message. No fabricated layer data, ever.
   Leave the cat easter egg in `backend/routes/search.js` and `backend/utils/cat.js` intact; only the
   inspect paths are in scope.
10. Confirm `inspect_backup.js` and `inspect_new.js` are not imported, then delete them to prevent stale alternate implementations from bypassing future audits.

**Security test cases:**

```text
alpine;id
alpine && id
$(id)
`id`
--help
name with spaces
name\nother
```

Expected: HTTP `400` or utility rejection; no subprocess starts.

**Required subprocess/PTY assertions:**

- Mock `execFile`, `spawn`, and `pty.spawn`.
- For every invalid reference, assert all three mocks have zero calls.
- For valid pull/inspect/delete/history/info requests, assert the executable and exact argument array; no shell string is permitted.
- Connect to `/ws/terminal` with an invalid image reference and assert the socket is rejected/disconnected before `pty.spawn` is called.

### Phase 3 — Fix health reporting

**Objective:** make health endpoints reflect actual Docker/dive availability.

**Files:**

- Modify: `backend/server.js`
- Modify: `backend/test/api.test.js`

**Required change:**

Replace the invalid construction pattern:

```js
const dockerUtils = new (require('./utils/docker'))();
```

with the exported instance:

```js
const dockerUtils = require('./utils/docker');
```

Prefer extracting the duplicated `/health` and `/api/health` response builder into one function.

Remove the `NODE_ENV === 'test'` shortcut that forces Docker availability to `true`. Unit tests must mock the exported `dockerUtils.isDockerAvailable()` method and prove both health routes call that exported instance. Keep a container integration test that checks the real mounted socket.

**Acceptance:** both health paths report `docker.available: true` in the deployed container when the nested Docker socket is mounted and accessible.

### Phase 4 — Build and regression-test the hardened application

**Objective:** prove the code patch works before creating infrastructure.

1. Run all backend tests.
2. Run all frontend tests.
3. Run lint if the existing configuration is functional.
4. Build the production images **under a throwaway tag**:

   ```bash
   cd /Users/derek/docker-dive
   TAG=harden-test docker buildx bake --pull --load
   ```

   The tag override is mandatory when building on the Mac. `docker-bake.hcl` defaults to
   `TAG=latest`, and `dive-inspector-{backend,frontend}:latest` are the exact tags the *running* Mac
   deployment uses — a default build silently retags them and leaves the live containers on dangling
   images. Confirm the resolved tags with `TAG=harden-test docker buildx bake --print` before
   building. Note that the build is `linux/amd64` and the Mac is arm64, so it runs under emulation;
   this is correct (the backend Dockerfile pins the amd64 `dive` binary) but slow, and it means a
   local terminal check is not perfectly representative of the LXC.

5. Start a temporary local stack with a unique Compose project name, deployment-only named volume,
   and **loopback ports that do not collide with the live stack** (it holds `127.0.0.1:3000` and
   `127.0.0.1:3001`; use e.g. `3100`/`3101`). Keep the backend service named `backend` — the frontend
   nginx config proxies to `http://backend:3000` by name. Do not reuse unrelated containers or volumes.
6. Pull and inspect a small fixture image such as `alpine:latest`.
7. Add a second unrelated fixture image.
8. Delete only `alpine:latest` through the UI/API.
9. Verify the unrelated fixture and both service images remain.
10. Record pre/post fixture image IDs with `docker image inspect` and pre/post build-cache state with `docker builder du`; verify targeted delete changes neither unrelated image IDs nor build-cache usage.
11. Verify frontend, backend, health, and terminal.
12. Stop only the temporary fixture stack; do not remove unrelated images.

**Gate:** no infrastructure deployment until the destructive regression test passes.

### Phase 5 — Create the LXC

**Objective:** create the isolated runtime without privileged access or host mounts.

The exact command must be generated from live Proxmox discovery. Expected shape:

```bash
pct create <CTID> <DEBIAN13_TEMPLATE> \
  --hostname docker-dive \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --cores 2 \
  --memory 4096 \
  --swap 512 \
  --rootfs <STORAGE>:40 \
  --net0 name=eth0,bridge=<BRIDGE>,ip=dhcp,firewall=1 \
  --onboot 1 \
  --tags docker,cloudflare,utility
```

**Verification:**

```bash
pct config <CTID>
pct start <CTID>
pct exec <CTID> -- systemctl is-system-running --wait
pct exec <CTID> -- ip address show
pct exec <CTID> -- getent hosts github.com
```

Expected:
- `unprivileged: 1`
- `features: keyctl=1,nesting=1`
- No host bind mounts
- Working DNS and outbound HTTPS

### Phase 6 — Configure the LXC base OS and nested Docker

**Objective:** install the minimum runtime required by Docker Dive.

1. Update Debian packages.
2. Install CA certificates, curl, Git, and Docker Engine from Docker's official Debian repository.
3. Enable Docker at boot.
4. Verify nested Docker storage and cgroups.
5. Create a non-root deployment user if practical; Docker access remains privileged within the LXC.
6. Do not install `cloudflared` in Docker.

**Verification:**

```bash
systemctl is-enabled docker
systemctl is-active docker
docker version
docker info
docker info --format 'driver={{.Driver}} cgroup={{.CgroupVersion}}'
docker run --rm hello-world
```

Expected: Docker server reachable, storage driver is `overlay2` or `fuse-overlayfs`, cgroup reporting is functional, and the test container exits successfully. If this gate fails under the standard unprivileged configuration, stop and switch the design to a small VM; do not make the LXC privileged or unconfined.

### Phase 7 — Deploy Docker Dive inside the LXC

**Objective:** run the hardened stack with local-only listeners and persistent temp storage.

**Target paths:**

```text
/opt/docker-dive/app/                 # Git checkout
/opt/docker-dive/compose.override.yml # Deployment-only override
/var/lib/docker/                      # Nested Docker state
```

**Deployment requirements:**

1. Clone Derek's approved fork/branch or transfer the reviewed source.
2. Pin the deployed Git commit in the deployment record.
3. Use a named volume for `/app/temp`; do not create writable generated paths in the Git checkout.
4. Preserve loopback bindings:
   - `127.0.0.1:3000 -> backend:3000`
   - `127.0.0.1:3001 -> frontend:80`
5. Mount only the LXC's nested `/var/run/docker.sock` into the backend container.
6. Use `restart: unless-stopped`.
7. Build and start with Compose.

**Verification:**

```bash
docker compose ps
docker inspect dive-inspector-backend --format '{{.State.Health.Status}}'
docker inspect dive-inspector-frontend --format '{{.State.Health.Status}}'
curl -fsS http://127.0.0.1:3001/
curl -fsS http://127.0.0.1:3001/api/health
docker exec dive-inspector-backend docker version
```

Expected: both containers healthy, HTTP `200`, and Docker available.

### Phase 8 — Install native cloudflared

**Objective:** create an outbound-only connector independent of the nested Docker daemon.

1. Install `cloudflared` from Cloudflare's supported package/repository.
2. Create the tunnel through the Cloudflare dashboard or scoped API.
3. Install the tunnel token as a systemd service secret; never put it in Compose or Git.
4. Route `<APP_HOSTNAME>` to `http://127.0.0.1:3001`.
5. Enable and start the native `cloudflared` service.

**Verification:**

```bash
cloudflared --version
systemctl is-enabled cloudflared
systemctl is-active cloudflared
journalctl -u cloudflared --since '10 minutes ago' --no-pager
```

Expected: connector reports healthy in Cloudflare and no restart loop exists.

### Phase 9 — Configure Cloudflare DNS and Access

**Objective:** expose the hostname only after authentication.

1. Create the tunnel-backed DNS hostname.
2. Create a Cloudflare Access self-hosted application for the exact hostname.
3. Add one Allow policy for Derek's approved identity/IdP.
4. Leave unmatched users denied.
5. Do not create a Bypass policy, alternate unprotected hostname, broad email-domain allow, or service-token exception unless separately specified and tested.
6. Enable “Protect with Access” token validation at the tunnel/origin boundary.
7. Use a reasonable session duration, recommended 24 hours.
8. Confirm WebSockets are enabled for the zone.
9. Do not enable Cloudflare Funnel-equivalent public bypasses or alternate unprotected hostnames.

**Negative tests:**

- Unauthenticated/incognito request is redirected to Access or denied.
- An unapproved identity is denied.
- Direct requests to the LXC LAN address cannot reach ports 3000/3001 because services bind to loopback.
- The `/socket.io/` and `/ws/terminal` upgrade paths work only after Access authentication.

### Phase 10 — End-to-end acceptance testing

**Objective:** prove the Cloudflare deployment works from Derek's phone without weakening isolation.

Run these tests in order:

1. Authenticate through Cloudflare Access from the phone.
2. Load the frontend over HTTPS.
3. Search Docker Hub.
4. Pull `alpine:latest`.
5. Inspect it and validate layer/efficiency output.
6. Open the interactive terminal and verify WebSocket/PTY input and output.
7. Pull a second fixture image.
8. Delete only `alpine:latest`.
9. Verify the second image remains.
10. Verify service images remain.
11. Verify no `docker system prune` appeared in backend logs.
12. Verify both containers remain healthy with zero unexpected restarts.
13. Verify `cloudflared` remains active.
14. Verify the existing Tailscale endpoint still returns `200`.

**Acceptance evidence to save:**

- Deployed commit SHA
- LXC CT ID/node/IP
- Cloudflare hostname
- Redacted Access policy summary
- `docker compose ps`
- Backend/frontend health results
- Targeted-delete proof
- WebSocket terminal result
- Backup job result

Do not save tunnel tokens, API tokens, cookies, or raw credential-bearing logs.

### Phase 11 — Backup and operational handoff

**Objective:** make recovery obvious.

1. Add the LXC to the approved Proxmox backup job.
2. Trigger one attended backup after deployment.
3. Verify backup completion and archive presence.
4. Document:
   - LXC ID, node, IP, hostname
   - Cloudflare hostname
   - Source repo/branch/commit
   - Start/stop/update/check commands
   - Backup/restore procedure
   - Rollback procedure
5. Add a service entry to:

   ```text
   /Users/derek/hermes-markdown-notes/homelab/services.md
   ```

6. Create a deployment runbook at:

   ```text
   /Users/derek/hermes-markdown-notes/homelab/runbooks/docker-dive-cloudflare.md
   ```

## 9. Rollback plan

### Application rollback

1. Disable the Cloudflare published hostname or Access application.
2. Keep the LXC running for log inspection if safe.
3. Revert to the previous known-good Git commit.
4. Rebuild only the Docker Dive images.
5. Restart the Compose stack.
6. Re-run local health checks before re-enabling the hostname.

### Infrastructure rollback

1. Disable the Cloudflare tunnel route.
2. Stop `cloudflared` inside the LXC.
3. Preserve the LXC unless it is actively harmful.
4. Restore from the verified Proxmox backup if required.
5. Use the existing Mac Tailscale endpoint as the fallback.

### Full abandonment

Only after Derek explicitly approves deletion:

1. Export final logs/config without secrets.
2. Remove the Cloudflare Access app, hostname, and tunnel.
3. Remove the LXC from backup jobs.
4. Destroy the LXC by exact CT ID.
5. Leave the Mac deployment unchanged unless separately approved.

## 10. Definition of done

The project is complete only when all items are true:

- [x] Hardened code is reviewed and tested. *(branch `harden/cloudflare-lxc`, HEAD `ccc8ca8`)*
- [x] Global cleanup/prune behavior is gone.
- [x] No shell-interpolated Docker image commands remain.
- [x] Force-delete query handling is removed and tested.
- [x] Invalid inspect input returns `400`; no cat fallback or subprocess starts.
- [x] Inspection **failure** returns a real `404`/`502`, never `200` with fabricated layer data.
- [x] The `/ws/terminal` socket uses the shared validator, not its own regex.
- [x] Stale alternate inspect route files are removed after import verification.
- [x] Health accurately reports Docker availability. *(verified `docker.available: true` in-container
      against the real mounted socket)*
- [x] Unrelated fixture image survives targeted delete. *(Phase 4: only `alpine:latest` removed;
      `busybox` and all service image IDs unchanged; `docker builder du` identical before/after)*
- [x] No global prune occurs.
- [ ] Frontend test debt cleared — 4 pre-existing failures remain (see §5a); they are the only
      automated coverage of the UI flows and should be green before Phase 10 acceptance.
- [ ] Dedicated LXC is unprivileged with only nesting/keyctl enabled.
- [ ] No host paths or host Docker socket are mounted.
- [ ] Docker Dive is the LXC's only Docker stack.
- [ ] `cloudflared` runs natively and survives restart.
- [ ] Cloudflare Access denies unauthenticated/unapproved users.
- [ ] Search, pull, inspect, targeted delete, and terminal all work from the phone.
- [ ] LXC backup completes successfully.
- [ ] Rollback to the Mac/Tailscale deployment is documented and tested.
- [ ] Durable service inventory and runbook are updated.
- [ ] Derek explicitly approves any retirement of the Mac deployment.

## 11. Handoff checklist for Claude Code

Claude should begin with code hardening only. It must not touch Proxmox or Cloudflare until Derek separately authorizes infrastructure execution.

Suggested initial Claude prompt:

```text
Read docs/specs/cloudflare-lxc-deployment-spec.md and AGENTS.md. Implement only Phases 1–4 on a new branch. Use TDD. Do not deploy, push, create Cloudflare resources, modify Proxmox, or alter the running Mac containers/Tailscale Serve. Fix the destructive cleanup path, eliminate shell-interpolated Docker commands, centralize image validation, and fix health reporting. Run the complete backend/frontend test suites and Docker smoke tests. Return the branch name, commit SHA(s), test results, and any deviations from the spec.
```

## Sources

[1] https://developers.cloudflare.com/tunnel/setup
[2] https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app
[3] https://developers.cloudflare.com/network/websockets
[4] https://pve.proxmox.com/wiki/Linux_Container
