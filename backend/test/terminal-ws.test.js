const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

jest.setTimeout(15000);

let server;
let baseUrl;
let mockShell;
let dataCallback;
let exitCallback;
let serverModule;

const makeMockShell = () => ({
  killed: false,
  kill: jest.fn(function kill() {
    this.killed = true;
  }),
  write: jest.fn(),
  resize: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  onData: jest.fn((cb) => {
    dataCallback = cb;
  }),
  onExit: jest.fn((cb) => {
    exitCallback = cb;
  })
});

// Messages are buffered from the moment the socket is created: the server
// sends its 'ready' frame immediately after the handshake, which can beat a
// listener attached only after connect() resolves.
const connect = (query) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl}/ws/terminal?${query}`);
    ws.inbox = [];
    ws.inboxWaiters = [];
    ws.on('message', (data, isBinary) => {
      const message = { data, isBinary };
      const waiter = ws.inboxWaiters.shift();
      if (waiter) {
        waiter(message);
      } else {
        ws.inbox.push(message);
      }
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('unexpected-response', (req, res) => {
      const err = new Error(`unexpected response ${res.statusCode}`);
      err.statusCode = res.statusCode;
      reject(err);
    });
  });

const nextMessage = (ws) =>
  new Promise((resolve) => {
    if (ws.inbox.length > 0) {
      resolve(ws.inbox.shift());
      return;
    }
    ws.inboxWaiters.push(resolve);
  });

const closed = (ws) =>
  new Promise((resolve) => {
    ws.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
  });

const waitFor = async (predicate, timeoutMs = 3000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await new Promise((r) => setTimeout(r, 20));
  }
};

beforeAll((done) => {
  serverModule = require('../server');
  server = serverModule.server;
  server.listen(0, () => {
    baseUrl = `ws://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  serverModule.io.close();
  if (server && server.listening) {
    server.close(done);
  } else {
    done();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  serverModule.activePTYs.clear();
  dataCallback = null;
  exitCallback = null;
  mockShell = makeMockShell();
  pty.spawn.mockReturnValue(mockShell);
});

describe('WebSocket terminal bridge', () => {
  test('valid image spawns dive with clamped query size and sends ready', async () => {
    const ws = await connect('image=alpine%3Alatest&cols=120&rows=40');
    const { data, isBinary } = await nextMessage(ws);

    expect(isBinary).toBe(false);
    expect(JSON.parse(data.toString())).toEqual({ type: 'ready', cols: 120, rows: 40 });
    expect(pty.spawn).toHaveBeenCalledTimes(1);
    expect(pty.spawn).toHaveBeenCalledWith(
      'dive',
      ['alpine:latest'],
      expect.objectContaining({ cols: 120, rows: 40, name: 'xterm-256color' })
    );
    expect(serverModule.activePTYs.size).toBe(1);

    ws.close(1000);
    await waitFor(() => serverModule.activePTYs.size === 0);
  });

  test('non-numeric size falls back to 80x30 and huge size is clamped to 500', async () => {
    const ws1 = await connect('image=alpine%3Alatest&cols=abc&rows=');
    await nextMessage(ws1);
    expect(pty.spawn).toHaveBeenLastCalledWith(
      'dive',
      ['alpine:latest'],
      expect.objectContaining({ cols: 80, rows: 30 })
    );
    ws1.close(1000);

    const ws2 = await connect('image=alpine%3Alatest&cols=9999&rows=1');
    await nextMessage(ws2);
    expect(pty.spawn).toHaveBeenLastCalledWith(
      'dive',
      ['alpine:latest'],
      expect.objectContaining({ cols: 500, rows: 2 })
    );
    ws2.close(1000);
    await waitFor(() => serverModule.activePTYs.size === 0);
  });

  test('PTY output reaches the client as binary frames', async () => {
    const ws = await connect('image=alpine%3Alatest');
    await nextMessage(ws); // ready

    const messagePromise = nextMessage(ws);
    dataCallback('hello from dive');
    const { data, isBinary } = await messagePromise;

    expect(isBinary).toBe(true);
    expect(data.toString('utf8')).toBe('hello from dive');

    ws.close(1000);
    await waitFor(() => serverModule.activePTYs.size === 0);
  });

  test('binary client frames are written to the PTY as UTF-8', async () => {
    const ws = await connect('image=alpine%3Alatest');
    await nextMessage(ws); // ready

    ws.send(Buffer.from('q', 'utf8'));
    await waitFor(() => mockShell.write.mock.calls.length === 1);
    expect(mockShell.write).toHaveBeenCalledWith('q');

    ws.close(1000);
    await waitFor(() => serverModule.activePTYs.size === 0);
  });

  test('resize JSON resizes the PTY with clamping; malformed JSON is ignored', async () => {
    const ws = await connect('image=alpine%3Alatest');
    await nextMessage(ws); // ready

    ws.send(JSON.stringify({ type: 'resize', cols: 100, rows: 9999 }));
    await waitFor(() => mockShell.resize.mock.calls.length === 1);
    expect(mockShell.resize).toHaveBeenCalledWith(100, 500);

    ws.send('this is not json {');
    ws.send(JSON.stringify({ type: 'unknown-type' }));

    // session still alive: another resize works
    ws.send(JSON.stringify({ type: 'resize', cols: 81, rows: 31 }));
    await waitFor(() => mockShell.resize.mock.calls.length === 2);
    expect(mockShell.resize).toHaveBeenLastCalledWith(81, 31);

    ws.close(1000);
    await waitFor(() => serverModule.activePTYs.size === 0);
  });

  test('invalid image is rejected with HTTP 400 before any PTY spawn', async () => {
    await expect(connect('image=Bad%2FImage%3Alatest')).rejects.toMatchObject({
      statusCode: 400
    });
    expect(pty.spawn).not.toHaveBeenCalled();
    expect(serverModule.activePTYs.size).toBe(0);
  });

  test('missing image is rejected with HTTP 400', async () => {
    await expect(connect('cols=80&rows=30')).rejects.toMatchObject({ statusCode: 400 });
    expect(pty.spawn).not.toHaveBeenCalled();
  });

  test('PTY exit sends exit JSON, closes 1000, and untracks the PTY', async () => {
    const ws = await connect('image=alpine%3Alatest');
    await nextMessage(ws); // ready

    const messagePromise = nextMessage(ws);
    const closePromise = closed(ws);
    exitCallback({ exitCode: 0 });

    const { data, isBinary } = await messagePromise;
    expect(isBinary).toBe(false);
    expect(JSON.parse(data.toString())).toEqual({ type: 'exit', code: 0 });

    const { code } = await closePromise;
    expect(code).toBe(1000);
    expect(serverModule.activePTYs.size).toBe(0);
  });

  test('client disconnect kills the PTY and untracks it', async () => {
    const ws = await connect('image=alpine%3Alatest');
    await nextMessage(ws); // ready
    expect(serverModule.activePTYs.size).toBe(1);

    ws.close(1000);
    await waitFor(() => mockShell.kill.mock.calls.length >= 1);
    expect(serverModule.activePTYs.size).toBe(0);
  });
});

describe('session cap', () => {
  test('connections beyond TERMINAL_MAX_SESSIONS close with 1013 and spawn nothing', async () => {
    let attachTerminalServer;
    jest.isolateModules(() => {
      process.env.TERMINAL_MAX_SESSIONS = '1';
      attachTerminalServer = require('../ws/terminal').attachTerminalServer;
      delete process.env.TERMINAL_MAX_SESSIONS;
    });

    const capPTYs = new Set();
    const capServer = http.createServer();
    attachTerminalServer(capServer, { activePTYs: capPTYs });
    await new Promise((resolve) => capServer.listen(0, resolve));
    const capUrl = `ws://127.0.0.1:${capServer.address().port}`;

    try {
      const first = await new Promise((resolve, reject) => {
        const s = new WebSocket(`${capUrl}/ws/terminal?image=alpine%3Alatest`);
        s.on('open', () => resolve(s));
        s.on('error', reject);
      });
      await waitFor(() => capPTYs.size === 1);
      const spawnsAfterFirst = pty.spawn.mock.calls.length;

      const second = new WebSocket(`${capUrl}/ws/terminal?image=alpine%3Alatest`);
      const { code, reason } = await new Promise((resolve) => {
        second.on('close', (c, r) => resolve({ code: c, reason: r.toString() }));
      });

      expect(code).toBe(1013);
      expect(reason).toMatch(/too many/i);
      expect(pty.spawn.mock.calls.length).toBe(spawnsAfterFirst);

      first.close(1000);
      await waitFor(() => capPTYs.size === 0);
    } finally {
      await new Promise((resolve) => capServer.close(resolve));
    }
  });
});
