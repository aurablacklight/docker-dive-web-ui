require('@testing-library/jest-dom');

// jsdom does not provide TextEncoder/TextDecoder (browsers do)
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// Mock CSS imports
global.CSS = { supports: jest.fn(() => false) };

// jsdom gaps for components using ResizeObserver
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Never let a test open a real network WebSocket; individual suites install
// richer mocks over this inert default.
class InertWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
  }
  send() {}
  close() {}
}
InertWebSocket.CONNECTING = 0;
InertWebSocket.OPEN = 1;
InertWebSocket.CLOSING = 2;
InertWebSocket.CLOSED = 3;
global.WebSocket = InertWebSocket;
