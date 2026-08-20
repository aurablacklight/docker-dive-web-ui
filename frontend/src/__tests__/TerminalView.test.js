import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockTermInstances = [];
jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(function Terminal(options) {
    this.options = options;
    this.cols = 80;
    this.rows = 30;
    this.unicode = { activeVersion: '6' };
    this.open = jest.fn();
    this.focus = jest.fn();
    this.write = jest.fn();
    this.dispose = jest.fn();
    this.loadAddon = jest.fn();
    this.onData = jest.fn((cb) => {
      this.dataCallback = cb;
      return { dispose: jest.fn() };
    });
    this.onSelectionChange = jest.fn((cb) => {
      this.selectionCallback = cb;
      return { dispose: jest.fn() };
    });
    this.getSelection = jest.fn(() => '');
    mockTermInstances.push(this);
  })
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(function FitAddon() {
    this.fit = jest.fn();
    this.dispose = jest.fn();
  })
}));

jest.mock('@xterm/addon-webgl', () => ({
  WebglAddon: jest.fn().mockImplementation(function WebglAddon() {
    this.onContextLoss = jest.fn();
    this.dispose = jest.fn();
  })
}));

jest.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: jest.fn().mockImplementation(function Unicode11Addon() {})
}));

import TerminalView from '../components/TerminalView';

const sockets = [];

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.binaryType = 'blob';
    this.listeners = {};
    this.send = jest.fn();
    this.close = jest.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
    });
    sockets.push(this);
  }

  addEventListener(type, cb) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(cb);
  }

  removeEventListener(type, cb) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== cb);
  }

  emit(type, event = {}) {
    if (type === 'open') this.readyState = MockWebSocket.OPEN;
    if (type === 'close') this.readyState = MockWebSocket.CLOSED;
    (this.listeners[type] || []).forEach((cb) => cb(event));
  }
}
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

let observerInstances;

beforeEach(() => {
  sockets.length = 0;
  mockTermInstances.length = 0;
  observerInstances = [];
  global.WebSocket = MockWebSocket;
  global.ResizeObserver = jest.fn().mockImplementation(function ResizeObserver(cb) {
    this.callback = cb;
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    observerInstances.push(this);
  });
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue() }
  });
  jest.clearAllMocks();
});

const lastSocket = () => sockets[sockets.length - 1];
const lastTerm = () => mockTermInstances[mockTermInstances.length - 1];

const openAndReady = () => {
  act(() => {
    lastSocket().emit('open');
    lastSocket().emit('message', { data: JSON.stringify({ type: 'ready', cols: 80, rows: 30 }) });
  });
};

describe('TerminalView', () => {
  test('renders chrome with image name and starts connecting', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    expect(screen.getByText(/dive — alpine:latest/)).toBeInTheDocument();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  test('opens a WebSocket to /ws/terminal with encoded image and size', () => {
    render(<TerminalView image="my/image:1.0" onExit={jest.fn()} />);
    const socket = lastSocket();
    expect(socket.url).toContain('/ws/terminal?');
    expect(socket.url).toContain(`image=${encodeURIComponent('my/image:1.0')}`);
    expect(socket.url).toContain('cols=80');
    expect(socket.url).toContain('rows=30');
    expect(socket.binaryType).toBe('arraybuffer');
  });

  test('ready message moves status to connected', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  test('binary frames are written to the terminal', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    const bytes = new TextEncoder().encode('layer data').buffer;
    act(() => {
      lastSocket().emit('message', { data: bytes });
    });
    const written = lastTerm().write.mock.calls.map(([arg]) => arg);
    expect(
      written.some(
        (arg) => arg instanceof Uint8Array && new TextDecoder().decode(arg) === 'layer data'
      )
    ).toBe(true);
  });

  test('keyboard input is sent as binary when the socket is open', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    act(() => {
      lastTerm().dataCallback('j');
    });
    const sent = lastSocket().send.mock.calls.map(([arg]) => arg);
    // ArrayBuffer.isView instead of instanceof: the TextEncoder polyfill
    // produces Uint8Arrays from Node's realm, not jsdom's
    expect(
      sent.some((arg) => ArrayBuffer.isView(arg) && new TextDecoder().decode(arg) === 'j')
    ).toBe(true);
  });

  test('exit message shows exited status and a Restart action', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    act(() => {
      lastSocket().emit('message', { data: JSON.stringify({ type: 'exit', code: 0 }) });
    });
    expect(screen.getByText(/exited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
  });

  test('Exit button sends q', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    const sent = lastSocket().send.mock.calls.map(([arg]) => arg);
    expect(
      sent.some((arg) => ArrayBuffer.isView(arg) && new TextDecoder().decode(arg) === 'q')
    ).toBe(true);
  });

  test('abnormal close shows reconnecting status', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    act(() => {
      lastSocket().emit('close', { code: 1006 });
    });
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  test('Copy button copies the selection', () => {
    render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    lastTerm().getSelection.mockReturnValue('selected text');
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('selected text');
  });

  test('unmount closes the socket, disposes the terminal, disconnects the observer', () => {
    const { unmount } = render(<TerminalView image="alpine:latest" onExit={jest.fn()} />);
    openAndReady();
    const socket = lastSocket();
    const term = lastTerm();
    unmount();
    expect(socket.close).toHaveBeenCalledWith(1000, expect.any(String));
    expect(term.dispose).toHaveBeenCalled();
    expect(observerInstances[0].disconnect).toHaveBeenCalled();
  });
});
