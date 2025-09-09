const { io } = require('socket.io-client');

jest.setTimeout(30000);

let server;

beforeAll((done) => {
  const serverModule = require('../server');
  server = serverModule.server;
  server.listen(3000, done);
});

afterAll((done) => {
  if (server && server.listening) {
    server.close(done);
  } else {
    done();
  }
});

test('PTY bridge echoes output and exits cleanly', (done) => {
  const socket = io('http://localhost:3000/ws/terminal', {
    query: { image: 'alpine:latest' },
    transports: ['websocket']
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
      socket.disconnect();
      done();
    } catch (err) {
      done(err);
    }
  });

  socket.on('error', (err) => done(err instanceof Error ? err : new Error(err)));
});
