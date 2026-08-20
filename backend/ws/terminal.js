const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const { validateImageName } = require('../utils/image-name');

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_SESSIONS = parsePositiveInt(process.env.TERMINAL_MAX_SESSIONS, 8);
const IDLE_TIMEOUT_MS = parsePositiveInt(process.env.TERMINAL_IDLE_TIMEOUT_MS, 15 * 60 * 1000);
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const SEND_HIGH_WATER_BYTES = 1024 * 1024;
const SEND_LOW_WATER_BYTES = 256 * 1024;
const MIN_DIM = 2;
const MAX_DIM = 500;

const clampDimension = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(MAX_DIM, Math.max(MIN_DIM, parsed));
};

/**
 * Attach the raw-WebSocket dive terminal bridge to an HTTP server.
 * Protocol: binary frames carry PTY bytes both ways; JSON text frames carry
 * control messages ({type:'ready'|'exit'} server->client, {type:'resize'}
 * client->server).
 */
const attachTerminalServer = (httpServer, { activePTYs }) => {
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Set();

  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch (error) {
      socket.destroy();
      return;
    }

    if (url.pathname !== '/ws/terminal') {
      // Legacy /ws/* paths have no handler; close them instead of hanging.
      // Anything else (e.g. /socket.io/) belongs to other upgrade listeners.
      if (url.pathname.startsWith('/ws/')) {
        socket.destroy();
      }
      return;
    }

    const image = url.searchParams.get('image');
    if (!image || !validateImageName(image).valid) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    if (sessions.size >= MAX_SESSIONS) {
      ws.close(1013, 'Too many terminal sessions');
      return;
    }
    sessions.add(ws);

    const url = new URL(req.url, 'http://localhost');
    const image = url.searchParams.get('image');
    const cols = clampDimension(url.searchParams.get('cols'), 80);
    const rows = clampDimension(url.searchParams.get('rows'), 30);

    const shell = pty.spawn('dive', [image], {
      name: 'xterm-256color',
      cols,
      rows,
      env: process.env
    });
    activePTYs.add(shell);

    let finished = false;
    let missedPongs = 0;
    let drainInterval = null;

    const idleTimer = setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(Buffer.from('\r\n[session closed after inactivity]\r\n', 'utf8'));
      }
      cleanup();
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'Idle timeout');
      }
    }, IDLE_TIMEOUT_MS);

    const heartbeat = setInterval(() => {
      if (missedPongs >= 2) {
        cleanup();
        ws.terminate();
        return;
      }
      missedPongs += 1;
      try {
        ws.ping();
      } catch (error) {
        // socket already going away; cleanup happens via close/error
      }
    }, HEARTBEAT_INTERVAL_MS);

    function cleanup() {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(idleTimer);
      clearInterval(heartbeat);
      if (drainInterval) {
        clearInterval(drainInterval);
        drainInterval = null;
      }
      sessions.delete(ws);
      activePTYs.delete(shell);
      if (shell && !shell.killed) {
        try {
          shell.kill();
        } catch (error) {
          // PTY may already be gone
        }
      }
    }

    ws.on('pong', () => {
      missedPongs = 0;
    });

    shell.onData((data) => {
      if (ws.readyState !== ws.OPEN) {
        return;
      }
      ws.send(Buffer.from(data, 'utf8'));

      // Backpressure: pause the PTY while the socket send buffer is saturated
      if (ws.bufferedAmount > SEND_HIGH_WATER_BYTES && typeof shell.pause === 'function') {
        shell.pause();
        if (!drainInterval) {
          drainInterval = setInterval(() => {
            if (ws.bufferedAmount < SEND_LOW_WATER_BYTES) {
              clearInterval(drainInterval);
              drainInterval = null;
              if (!finished && typeof shell.resume === 'function') {
                shell.resume();
              }
            }
          }, 250);
        }
      }
    });

    shell.onExit(({ exitCode }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      }
      cleanup();
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'Process exited');
      }
    });

    ws.on('message', (data, isBinary) => {
      idleTimer.refresh();
      if (finished) {
        return;
      }

      if (isBinary) {
        shell.write(data.toString('utf8'));
        return;
      }

      let message;
      try {
        message = JSON.parse(data.toString('utf8'));
      } catch (error) {
        return; // malformed control frames never crash the session
      }

      if (message && message.type === 'resize') {
        const nextCols = clampDimension(message.cols, cols);
        const nextRows = clampDimension(message.rows, rows);
        try {
          shell.resize(nextCols, nextRows);
        } catch (error) {
          console.warn('Terminal resize failed:', error.message);
        }
      }
    });

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    ws.send(JSON.stringify({ type: 'ready', cols, rows }));
  });

  return wss;
};

module.exports = { attachTerminalServer };
