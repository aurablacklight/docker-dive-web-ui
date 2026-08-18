const { io } = require('socket.io-client');
const pty = require('node-pty');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

jest.setTimeout(30000);

let server;
let ioServer;
let mockShell;
let baseUrl;

beforeAll((done) => {
  const serverModule = require('../server');
  server = serverModule.server;
  ioServer = serverModule.io;
  server.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  if (ioServer) {
    ioServer.close();
  }
  if (server && server.listening) {
    server.close(done);
  } else {
    done();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockShell = {
    killed: false,
    kill: jest.fn(function kill() {
      this.killed = true;
    }),
    write: jest.fn(),
    resize: jest.fn(),
    onData: jest.fn((callback) => {
      setImmediate(() => callback('mock dive output'));
    }),
    onExit: jest.fn((callback) => {
      setTimeout(() => callback({ exitCode: 0 }), 25);
    })
  };
  pty.spawn.mockReturnValue(mockShell);
});

test('PTY bridge echoes output and exits cleanly', (done) => {
  const socket = io(`${baseUrl}/ws/terminal`, {
    query: { image: 'alpine:latest' },
    transports: ['websocket'],
    reconnection: false
  });

  let received = false;

  socket.on('data', (data) => {
    if (!received && data) {
      received = true;
      socket.emit('data', 'q');
    }
  });

  socket.on('exit', (code) => {
    try {
      expect(received).toBe(true);
      expect(typeof code).toBe('number');
      expect(pty.spawn).toHaveBeenCalledWith('dive', ['alpine:latest'], expect.any(Object));
      expect(mockShell.write).toHaveBeenCalledWith('q');
      socket.disconnect();
      done();
    } catch (err) {
      done(err);
    }
  });

  socket.on('error', (err) => done(err instanceof Error ? err : new Error(err)));
});

test('invalid terminal image is rejected before PTY spawn', (done) => {
  const socket = io(`${baseUrl}/ws/terminal`, {
    query: { image: 'Bad/Image:latest' },
    transports: ['websocket'],
    reconnection: false
  });

  socket.on('disconnect', () => {
    try {
      expect(pty.spawn).not.toHaveBeenCalled();
      done();
    } catch (err) {
      done(err);
    }
  });

  socket.on('connect_error', (err) => done(err));
});
