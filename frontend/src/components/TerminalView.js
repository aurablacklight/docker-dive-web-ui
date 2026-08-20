// The production babel config (.babelrc) uses the classic JSX runtime, which
// requires React in scope; only the test env uses the automatic runtime.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const MAX_RECONNECT_ATTEMPTS = 5;
const encoder = new TextEncoder();

const terminalTheme = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#58a6ff',
  selectionBackground: 'rgba(88, 166, 255, 0.35)'
};

const buildSocketUrl = (image, cols, rows) => {
  const params = `image=${encodeURIComponent(image)}&cols=${cols}&rows=${rows}`;
  if (process.env.NODE_ENV === 'production') {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws/terminal?${params}`;
  }
  return `ws://localhost:3000/ws/terminal?${params}`;
};

const STATUS_LABELS = {
  connecting: 'connecting…',
  connected: 'connected',
  reconnecting: 'reconnecting',
  exited: 'exited',
  error: 'connection failed'
};

const TerminalView = ({ image, onExit }) => {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const attemptsRef = useRef(0);
  const userClosedRef = useRef(false);
  const exitedRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const resizeTimerRef = useRef(null);
  const hasConnectedOnceRef = useRef(false);

  const [status, setStatus] = useState('connecting');
  const [attempt, setAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const sendInput = useCallback((text) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(encoder.encode(text));
    }
  }, []);

  const sendResize = useCallback(() => {
    const ws = wsRef.current;
    const term = termRef.current;
    if (ws && term && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  }, []);

  const connect = useCallback(() => {
    const term = termRef.current;
    if (!term) {
      return;
    }

    setStatus(attemptsRef.current > 0 ? 'reconnecting' : 'connecting');
    setAttempt(attemptsRef.current);

    const ws = new WebSocket(buildSocketUrl(image, term.cols, term.rows));
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      // 'ready' confirms the PTY spawned; keep 'connecting' until then
    });

    ws.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }
        if (message.type === 'ready') {
          attemptsRef.current = 0;
          setAttempt(0);
          setStatus('connected');
          if (hasConnectedOnceRef.current) {
            term.write('\r\n[reconnected — new dive session]\r\n');
          }
          hasConnectedOnceRef.current = true;
          term.focus();
        } else if (message.type === 'exit') {
          exitedRef.current = true;
          setStatus('exited');
          term.write(`\r\n[dive exited with code ${message.code}]\r\n`);
        }
        return;
      }
      term.write(new Uint8Array(event.data));
    });

    ws.addEventListener('close', (event) => {
      if (userClosedRef.current || exitedRef.current) {
        return;
      }
      if (event.code === 1000) {
        setStatus('exited');
        return;
      }
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus('error');
        return;
      }
      const delay = RECONNECT_DELAYS_MS[Math.min(attemptsRef.current, RECONNECT_DELAYS_MS.length - 1)];
      attemptsRef.current += 1;
      setAttempt(attemptsRef.current);
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(connect, delay);
    });

    ws.addEventListener('error', () => {
      // close fires afterwards and drives the reconnect path
    });
  }, [image]);

  useEffect(() => {
    userClosedRef.current = false;
    exitedRef.current = false;
    attemptsRef.current = 0;
    hasConnectedOnceRef.current = false;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
      scrollback: 5000,
      theme: terminalTheme,
      allowProposedApi: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    try {
      term.loadAddon(new Unicode11Addon());
      term.unicode.activeVersion = '11';
    } catch (error) {
      // unicode addon is an enhancement, never a requirement
    }

    term.open(containerRef.current);

    // WebGL is a fast path, never a requirement: fall back to the default
    // renderer on load failure or context loss.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch (error) {
      console.warn('WebGL renderer unavailable, using default renderer');
    }

    fitAddon.fit();
    termRef.current = term;
    fitRef.current = fitAddon;

    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection && navigator.clipboard) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    // Debounced ResizeObserver; only report size changes that alter the grid
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const currentTerm = termRef.current;
        const currentFit = fitRef.current;
        if (!currentTerm || !currentFit) {
          return;
        }
        const before = { cols: currentTerm.cols, rows: currentTerm.rows };
        try {
          currentFit.fit();
        } catch (error) {
          return;
        }
        if (currentTerm.cols !== before.cols || currentTerm.rows !== before.rows) {
          sendResize();
        }
      }, 100);
    });
    observer.observe(containerRef.current);

    connect();

    return () => {
      userClosedRef.current = true;
      clearTimeout(reconnectTimerRef.current);
      clearTimeout(resizeTimerRef.current);
      observer.disconnect();
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, 'Client closed');
      }
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [image, connect, sendResize]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      // refit after the layout settles
      setTimeout(() => {
        if (fitRef.current) {
          try {
            fitRef.current.fit();
            sendResize();
          } catch (error) {
            // container mid-transition; the ResizeObserver will catch up
          }
        }
      }, 50);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [sendResize]);

  const handleCopy = () => {
    const term = termRef.current;
    if (!term || !navigator.clipboard) {
      return;
    }
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {});
    }
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (frameRef.current && frameRef.current.requestFullscreen) {
      frameRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleRestart = () => {
    clearTimeout(reconnectTimerRef.current);
    const ws = wsRef.current;
    userClosedRef.current = true;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, 'Restart');
    }
    userClosedRef.current = false;
    exitedRef.current = false;
    attemptsRef.current = 0;
    connect();
  };

  const handleExit = () => {
    sendInput('q');
  };

  const statusLabel =
    status === 'reconnecting'
      ? `reconnecting (${attempt}/${MAX_RECONNECT_ATTEMPTS})`
      : STATUS_LABELS[status];

  return (
    <div
      ref={frameRef}
      className={`terminal-frame ${isFullscreen ? 'fullscreen' : ''}`}
      data-testid="terminal-frame"
    >
      <div className="terminal-header">
        <div>
          <span className={`terminal-status-dot status-${status}`} title={statusLabel} />
          <span className="terminal-title">dive — {image}</span>
        </div>
        <div className="terminal-actions">
          <button type="button" className="terminal-action-btn" onClick={handleCopy}>
            Copy
          </button>
          <button type="button" className="terminal-action-btn" onClick={handleFullscreen}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          {(status === 'exited' || status === 'error') && (
            <button type="button" className="terminal-action-btn" onClick={handleRestart}>
              Restart
            </button>
          )}
          <button
            type="button"
            className="terminal-action-btn"
            onClick={handleExit}
            disabled={status !== 'connected'}
          >
            Exit
          </button>
          <button
            type="button"
            className="terminal-action-btn"
            onClick={() => setShowHelp(!showHelp)}
          >
            Help
          </button>
        </div>
      </div>
      <div className="terminal-statusline">{statusLabel}</div>
      <div ref={containerRef} className="terminal-body" />
      {showHelp && (
        <div className="terminal-statusline">
          Keys: q / Ctrl+C quit · Tab switch panes · ↑/↓ or j/k move · PgUp/PgDn scroll ·
          Ctrl+F filter files · Space collapse dir · Ctrl+A added · Ctrl+R removed ·
          Ctrl+M modified · Ctrl+U unmodified · Ctrl+B file attributes · Ctrl+L layer changes
        </div>
      )}
    </div>
  );
};

TerminalView.propTypes = {
  image: PropTypes.string.isRequired,
  onExit: PropTypes.func.isRequired
};

export default TerminalView;
