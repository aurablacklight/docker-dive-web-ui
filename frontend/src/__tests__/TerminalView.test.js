import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockTerm = {
  open: jest.fn(),
  loadAddon: jest.fn(),
  focus: jest.fn(),
  dispose: jest.fn(),
  write: jest.fn(),
  reset: jest.fn(),
  onData: jest.fn(),
  onSelectionChange: jest.fn(),
  getSelection: jest.fn(() => ''),
  unicode: { activeVersion: '6' },
  cols: 100,
  rows: 35
};

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn(() => mockTerm)
}));
jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn(() => ({ fit: jest.fn(), dispose: jest.fn() }))
}));
jest.mock('@xterm/addon-webgl', () => ({
  WebglAddon: jest.fn(() => ({ dispose: jest.fn(), onContextLoss: jest.fn() }))
}));
jest.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: jest.fn(() => ({}))
}));
jest.mock('@xterm/xterm/css/xterm.css', () => ({}), { virtual: true });

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    this.closeCalls = [];
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = MockWebSocket.CLOSED;
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data });
  }

  simulateClose(code, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }
}
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSED = 3;
MockWebSocket.instances = [];

let TerminalView;

beforeAll(() => {
  global.WebSocket = MockWebSocket;
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // eslint-disable-next-line global-require
  TerminalView = require('../components/TerminalView').default;
});

beforeEach(() => {
  jest.clearAllMocks();
  MockWebSocket.instances = [];
  mockTerm.getSelection.mockReturnValue('');
});

const lastSocket = () => MockWebSocket.instances[MockWebSocket.instances.length - 1];

const renderTerminal = (props = {}) =>
  render(<TerminalView image="myapp:1.0" onExit={props.onExit || jest.fn()} {...props} />);

describe('TerminalView', () => {
  test('renders chrome with the image name and starts in connecting state', () => {
    renderTerminal();

    expect(screen.getByText(/dive — myapp:1.0/)).toBeInTheDocument();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  test('opens a WebSocket to /ws/terminal with encoded image and terminal size', () => {
    renderTerminal();

    const ws = lastSocket();
    expect(ws.url).toContain('/ws/terminal?');
    expect(ws.url).toContain('image=myapp%3A1.0');
    expect(ws.url).toContain('cols=100');
    expect(ws.url).toContain('rows=35');
    expect(ws.binaryType).toBe('arraybuffer');
  });

  test('ready message flips status to connected', () => {
    renderTerminal();
    const ws = lastSocket();

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage(JSON.stringify({ type: 'ready', cols: 100, rows: 35 }));
    });

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  test('binary frames are written to the terminal', () => {
    renderTerminal();
    const ws = lastSocket();
    const bytes = new TextEncoder().encode('layer output').buffer;

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage(bytes);
    });

    expect(mockTerm.write).toHaveBeenCalledWith(expect.any(Uint8Array));
    const written = mockTerm.write.mock.calls[0][0];
    expect(new TextDecoder().decode(written)).toBe('layer output');
  });

  test('exit message shows exited status with Restart, and Close calls onExit', () => {
    const onExit = jest.fn();
    renderTerminal({ onExit });
    const ws = lastSocket();

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage(JSON.stringify({ type: 'exit', code: 0 }));
    });

    expect(screen.getAllByText(/exited/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onExit).toHaveBeenCalledWith(0);
  });

  test('Restart opens a fresh WebSocket connection', () => {
    renderTerminal();
    const first = lastSocket();
    act(() => {
      first.simulateOpen();
      first.simulateMessage(JSON.stringify({ type: 'exit', code: 0 }));
    });

    fireEvent.click(screen.getByRole('button', { name: /restart/i }));

    expect(MockWebSocket.instances.length).toBe(2);
    expect(lastSocket()).not.toBe(first);
    expect(mockTerm.reset).toHaveBeenCalled();
  });

  test('Exit button sends the dive quit key as binary', () => {
    renderTerminal();
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    fireEvent.click(screen.getByRole('button', { name: /exit/i }));

    expect(ws.sent.length).toBe(1);
    expect(new TextDecoder().decode(ws.sent[0])).toBe('q');
  });

  test('abnormal close shows reconnecting status', () => {
    jest.useFakeTimers();
    try {
      renderTerminal();
      const ws = lastSocket();

      act(() => {
        ws.simulateOpen();
        ws.simulateClose(1006);
      });

      expect(screen.getAllByText(/reconnecting/i).length).toBeGreaterThan(0);

      act(() => {
        jest.advanceTimersByTime(1100);
      });
      expect(MockWebSocket.instances.length).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('server close 1000 without exit (idle timeout) shows exited state with Restart', () => {
    renderTerminal();
    const ws = lastSocket();

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage(JSON.stringify({ type: 'ready', cols: 100, rows: 35 }));
      ws.simulateClose(1000, 'Idle timeout');
    });

    expect(screen.getAllByText(/exited/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
  });

  test('close 1013 (session cap) becomes an error with the reason shown, without retrying', () => {
    jest.useFakeTimers();
    try {
      renderTerminal();
      const ws = lastSocket();

      act(() => {
        ws.simulateOpen();
        ws.simulateClose(1013, 'Too many terminal sessions');
      });

      expect(screen.getAllByText(/too many terminal sessions/i).length).toBeGreaterThan(0);
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      expect(MockWebSocket.instances.length).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a bare open does not reset the retry counter — only ready does', () => {
    jest.useFakeTimers();
    try {
      renderTerminal();
      const first = lastSocket();

      act(() => {
        first.simulateOpen();
        first.simulateClose(1006);
      });
      expect(screen.getAllByText(/reconnecting \(1\/5\)/i).length).toBeGreaterThan(0);

      act(() => {
        jest.advanceTimersByTime(1100);
      });
      const second = lastSocket();
      expect(second).not.toBe(first);

      act(() => {
        second.simulateOpen(); // upgrade completes but no ready (e.g. server closes next)
        second.simulateClose(1006);
      });
      expect(screen.getAllByText(/reconnecting \(2\/5\)/i).length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a stale socket close after an image switch does not reconnect the old image', () => {
    jest.useFakeTimers();
    try {
      const { rerender } = render(<TerminalView image="image-a:1" onExit={jest.fn()} />);
      const socketA = lastSocket();

      rerender(<TerminalView image="image-b:1" onExit={jest.fn()} />);
      const socketB = lastSocket();
      expect(socketB).not.toBe(socketA);

      act(() => {
        socketA.simulateClose(1006); // late close from the torn-down socket
        jest.advanceTimersByTime(5000);
      });

      expect(MockWebSocket.instances.length).toBe(2);
      expect(lastSocket()).toBe(socketB);
    } finally {
      jest.useRealTimers();
    }
  });

  test('ready re-syncs the PTY size when the grid changed during the handshake', () => {
    renderTerminal(); // socket opened with cols=100
    const ws = lastSocket();
    mockTerm.cols = 120; // grid changed while CONNECTING

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage(JSON.stringify({ type: 'ready', cols: 100, rows: 35 }));
    });

    const resizes = ws.sent
      .filter((s) => typeof s === 'string')
      .map((s) => JSON.parse(s))
      .filter((m) => m.type === 'resize');
    expect(resizes).toContainEqual({ type: 'resize', cols: 120, rows: 35 });
    mockTerm.cols = 100;
  });

  test('Copy uses the clipboard with the current selection', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    mockTerm.getSelection.mockReturnValue('selected text');

    renderTerminal();
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith('selected text');
  });

  test('unmount closes the socket cleanly and disposes the terminal', () => {
    const { unmount } = renderTerminal();
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    unmount();

    expect(ws.closeCalls).toContainEqual(expect.objectContaining({ code: 1000 }));
    expect(mockTerm.dispose).toHaveBeenCalled();
  });
});
