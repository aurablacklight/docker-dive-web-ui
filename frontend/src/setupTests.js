require('@testing-library/jest-dom');

// Mock Socket.IO
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Mock xterm
jest.mock('xterm', () => ({
  Terminal: jest.fn(() => ({
    open: jest.fn(),
    write: jest.fn(),
    onData: jest.fn(),
    dispose: jest.fn(),
    focus: jest.fn(),
    cols: 80,
    rows: 24,
    loadAddon: jest.fn(),
  })),
}));

// Mock xterm-addon-fit
jest.mock('xterm-addon-fit', () => ({
  FitAddon: jest.fn(() => ({
    fit: jest.fn(),
  })),
}));

// Mock CSS imports
global.CSS = { supports: jest.fn(() => false) };
