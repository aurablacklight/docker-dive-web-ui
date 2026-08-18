const express = require('express');
const request = require('supertest');
const childProcess = require('child_process');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

const imagesRoutes = require('../routes/images');

const app = express();
app.use(express.json());
app.use('/images', imagesRoutes);

const mockExecSuccess = (stdout = '', stderr = '') => {
  childProcess.exec.mockImplementation((command, callback) => {
    callback(null, { stdout, stderr });
  });
  childProcess.execFile.mockImplementation((file, args, callback) => {
    callback(null, stdout, stderr);
  });
};

describe('Images routes destructive cleanup hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecSuccess('ok');
  });

  test('targeted delete invokes docker rmi exactly once with exact image argv and no force', async () => {
    const imageName = 'nginx:latest';

    await request(app)
      .delete(`/images/${encodeURIComponent(imageName)}`)
      .expect(200);

    const rmiCalls = childProcess.execFile.mock.calls.filter(
      ([file, args]) => file === 'docker' && args[0] === 'rmi'
    );
    expect(rmiCalls).toHaveLength(1);
    expect(rmiCalls[0][1]).toEqual(['rmi', imageName]);
    expect(rmiCalls[0][1]).not.toContain('-f');
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('force query returns 400 and performs zero subprocess calls', async () => {
    await request(app)
      .delete('/images/nginx%3Alatest?force=true')
      .expect(400);

    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('namespaced tagged image names survive encode/decode round-trip', async () => {
    const imageName = 'ghcr.io/owner/repo:tag';

    await request(app)
      .delete(`/images/${encodeURIComponent(imageName)}`)
      .expect(200);

    const rmiCall = childProcess.execFile.mock.calls.find(
      ([file, args]) => file === 'docker' && args[0] === 'rmi'
    );
    expect(rmiCall[1]).toEqual(['rmi', imageName]);
  });

  test('removed cleanup endpoint returns 404 and performs zero subprocess calls', async () => {
    await request(app)
      .post('/images/cleanup')
      .expect(404);

    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });
});
