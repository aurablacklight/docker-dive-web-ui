// The production babel config (.babelrc) uses the classic JSX runtime, which
// requires React in scope; only the test env uses the automatic runtime.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const encoder = new TextEncoder();

const terminalTheme = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#58a6ff',
  selectionBackground: 'rgba(88, 166, 255, 0.35)'
};

const wsBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws/terminal`;
  }
  return 'ws://localhost:3000/ws/terminal';
};

const TerminalView = ({ image, onExit }) => {
  const frameRef = useRef(null);
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const attemptsRef = useRef(0);
  const userClosedRef = useRef(false);
  const exitedRef = useRef(false);
  const lastSizeRef = useRef({ cols: 0, rows: 0 });

  const [status, setStatus] = useState('connecting');
  const [statusDetail, setStatusDetail] = useState('');
  const [exitCode, setExitCode] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const sendResizeIfChanged = useCallback(() => {
    const term = termRef.current;
    const ws = wsRef.current;
    if (!term || !fitRef.current) {
      return;
    }
    try {
      fitRef.current.fit();
    } catch (error) {
      return;
    }
    const { cols, rows } = term;
    const last = lastSizeRef.current;
    if (cols === last.cols && rows === last.rows) {
      return; // guard: no-op resizes are what caused the old observer loop
    }
    // Record the size only when it is actually delivered — otherwise a refit
    // during CONNECTING would permanently desync the PTY grid
    if (ws && ws.readyState === WebSocket.OPEN) {
      lastSizeRef.current = { cols, rows };
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  const connect = useCallback(() => {
    const term = termRef.current;
    if (!term) {
      return;
    }

    userClosedRef.current = false;
    const cols = term.cols || 80;
    const rows = term.rows || 30;
    lastSizeRef.current = { cols, rows };

    const ws = new WebSocket(
      `${wsBaseUrl()}?image=${encodeURIComponent(image)}&cols=${cols}&rows=${rows}`
    );
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    // Deliberately no attempts reset in onopen: a server that completes the
    // upgrade and immediately closes (1013 session cap) would otherwise loop
    // forever. Only 'ready' proves a live PTY.

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        term.write(new Uint8Array(event.data));
        return;
      }
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (message.type === 'ready') {
        const wasReconnect = attemptsRef.current > 0;
        attemptsRef.current = 0;
        setStatus('connected');
        setStatusDetail('');
        if (wasReconnect) {
          term.write('\r\n[reconnected — new dive session]\r\n');
        }
        // Re-sync the PTY grid if it changed during the handshake
        if (term.cols !== message.cols || term.rows !== message.rows) {
          lastSizeRef.current = { cols: term.cols, rows: term.rows };
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } else if (message.type === 'exit') {
        exitedRef.current = true;
        setExitCode(message.code);
        setStatus('exited');
        setStatusDetail('');
        term.write(`\r\n[dive exited with code ${message.code}]\r\n`);
      }
    };

    ws.onclose = (event) => {
      if (ws !== wsRef.current) {
        return; // stale socket from a previous image/effect cycle
      }
      if (userClosedRef.current || exitedRef.current) {
        return;
      }
      if (event.code === 1000) {
        // Server-side clean close without an exit message: idle timeout
        setStatus('exited');
        setStatusDetail(event.reason || 'session closed by server');
        return;
      }
      if (event.code === 1013 || event.code === 1011 || event.code === 1008) {
        // Deterministic server rejection — retrying would just hammer it
        setStatus('error');
        setStatusDetail(event.reason || 'server rejected the session');
        return;
      }
      const attempt = attemptsRef.current;
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        setStatus('error');
        setStatusDetail('connection lost — reconnect attempts exhausted');
        return;
      }
      attemptsRef.current = attempt + 1;
      setStatus('reconnecting');
      setStatusDetail(`reconnecting (${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAYS_MS[attempt]);
    };
  }, [image]);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
      scrollback: 5000,
      theme: terminalTheme
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    try {
      term.loadAddon(new Unicode11Addon());
      term.unicode.activeVersion = '11';
    } catch (error) {
      // unicode addon is an enhancement, never a blocker
    }

    term.open(containerRef.current);

    // WebGL renderer with graceful fallback: never let it break the terminal
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch (error) {
      console.warn('WebGL renderer unavailable, using fallback renderer');
    }

    termRef.current = term;
    fitRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch (error) {
      // container not measurable yet; the observer will fit on first layout
    }
    term.focus();

    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    // Copy-on-select, debounced: xterm fires selection events continuously
    // while the mouse drags; only the settled selection matters
    let selectionDebounce = null;
    term.onSelectionChange(() => {
      clearTimeout(selectionDebounce);
      selectionDebounce = setTimeout(() => {
        const selection = term.getSelection();
        if (selection && navigator.clipboard) {
          navigator.clipboard.writeText(selection).catch(() => {});
        }
      }, 200);
    });

    let resizeDebounce = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(sendResizeIfChanged, 100);
    });
    observer.observe(containerRef.current);

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(sendResizeIfChanged, 50);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    exitedRef.current = false;
    attemptsRef.current = 0;
    setStatus('connecting');
    connect();

    return () => {
      userClosedRef.current = true;
      clearTimeout(resizeDebounce);
      clearTimeout(selectionDebounce);
      clearTimeout(reconnectTimerRef.current);
      observer.disconnect();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Component unmounted');
      }
      wsRef.current = null;
      try {
        term.dispose();
      } catch (error) {
        // already disposed
      }
      termRef.current = null;
      fitRef.current = null;
    };
  }, [image, connect, sendResizeIfChanged]);

  const sendKey = (key) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(encoder.encode(key));
    }
  };

  const handleRestart = () => {
    clearTimeout(reconnectTimerRef.current);
    userClosedRef.current = true;
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close(1000, 'Restart');
    }
    exitedRef.current = false;
    attemptsRef.current = 0;
    setExitCode(null);
    setStatus('connecting');
    setStatusDetail('');
    if (termRef.current) {
      termRef.current.reset();
    }
    connect();
  };

  const handleCopy = () => {
    const term = termRef.current;
    if (!term || !navigator.clipboard) {
      return;
    }
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {});
      return;
    }
    // No selection: copy the visible buffer
    try {
      const buffer = term.buffer.active;
      const lines = [];
      for (let i = 0; i < buffer.length; i += 1) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }
      navigator.clipboard.writeText(lines.join('\n').trimEnd()).catch(() => {});
    } catch (error) {
      // buffer serialization is best-effort
    }
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (frameRef.current && frameRef.current.requestFullscreen) {
      frameRef.current.requestFullscreen().catch(() => {});
    }
  };

  const statusLabel =
    status === 'exited' && exitCode !== null ? `exited (${exitCode})` : status;

  return (
    <div
      ref={frameRef}
      className={`terminal-frame ${isFullscreen ? 'fullscreen' : ''}`}
    >
      <div className="terminal-header">
        <div>
          <span className={`terminal-status-dot status-${status}`} aria-hidden="true" />
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
          {status === 'exited' ? (
            <button
              type="button"
              className="terminal-action-btn"
              onClick={() => onExit(exitCode)}
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              className="terminal-action-btn"
              onClick={() => sendKey('q')}
              title="Send dive's quit key"
            >
              Exit
            </button>
          )}
          <button
            type="button"
            className="terminal-action-btn"
            onClick={() => setShowHelp(!showHelp)}
          >
            Help
          </button>
        </div>
      </div>
      <div className="terminal-statusline">
        <span>{statusLabel}</span>
        {statusDetail && <span> — {statusDetail}</span>}
      </div>
      <div ref={containerRef} className="terminal-body" />
      {showHelp && (
        <div className="terminal-help glass-card">
          <h3>Dive keyboard shortcuts</h3>
          <ul>
            <li><kbd>Q</kbd> or <kbd>Ctrl+C</kbd> — exit dive</li>
            <li><kbd>Tab</kbd> — switch between layer and filetree views</li>
            <li><kbd>↑</kbd>/<kbd>↓</kbd> — move one line</li>
            <li><kbd>PgUp</kbd>/<kbd>PgDn</kbd> — scroll a page</li>
            <li><kbd>Ctrl+F</kbd> — filter files, <kbd>Esc</kbd> closes the filter</li>
            <li><kbd>Space</kbd> — collapse/expand directory, <kbd>Ctrl+Space</kbd> all</li>
            <li><kbd>Ctrl+A</kbd>/<kbd>Ctrl+R</kbd>/<kbd>Ctrl+M</kbd>/<kbd>Ctrl+U</kbd> — toggle added/removed/modified/unmodified files</li>
            <li><kbd>Ctrl+B</kbd> — toggle file attributes</li>
          </ul>
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
