const path = require('path');
const fs = require('fs-extra');
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

const uploadsDir = path.join(__dirname, '..', 'temp', 'uploads');

const gzipBuffer = () => {
  const buf = Buffer.alloc(64);
  buf[0] = 0x1f;
  buf[1] = 0x8b;
  buf[2] = 0x08;
  return buf;
};

const ustarBuffer = () => {
  const buf = Buffer.alloc(512);
  buf.write('ustar', 257);
  return buf;
};

// Route by argv: docker --version succeeds, docker load returns given stdout
const mockDockerLoad = (stdout, loadError = null) => {
  childProcess.execFile.mockImplementation((file, args, callback) => {
    if (args[0] === 'load') {
      callback(loadError, loadError ? '' : stdout, '');
      return;
    }
    callback(null, 'Docker version 29.0.0', '');
  });
};

const loadCalls = () =>
  childProcess.execFile.mock.calls.filter(([file, args]) => file === 'docker' && args[0] === 'load');

describe('POST /images/upload', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await fs.emptyDir(uploadsDir);
  });

  afterAll(async () => {
    await fs.emptyDir(uploadsDir);
  });

  test('loads a gzip tarball and reports parsed refs, cleaning up the temp file', async () => {
    mockDockerLoad('Loaded image: myapp:1.0\n');

    const res = await request(app)
      .post('/images/upload')
      .attach('image', gzipBuffer(), 'myapp.tar.gz')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.loadedImages).toEqual(['myapp:1.0']);
    expect(res.body.uploadedAt).toBeTruthy();

    const calls = loadCalls();
    expect(calls).toHaveLength(1);
    // Server-generated filename, never the client-supplied one
    expect(calls[0][1][2]).toMatch(/upload-[0-9a-f-]+\.tar$/);
    expect(calls[0][1][2]).not.toContain('myapp.tar.gz');

    expect(await fs.readdir(uploadsDir)).toEqual([]);
  });

  test('accepts a plain ustar tarball', async () => {
    mockDockerLoad('Loaded image ID: sha256:deadbeef\n');

    const res = await request(app)
      .post('/images/upload')
      .attach('image', ustarBuffer(), 'image.tar')
      .expect(200);

    expect(res.body.loadedImageIds).toEqual(['sha256:deadbeef']);
  });

  test('rejects a request with no file and spawns nothing', async () => {
    await request(app).post('/images/upload').expect(400);

    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('rejects a non-tar file with 400, spawns nothing, and cleans up', async () => {
    await request(app)
      .post('/images/upload')
      .attach('image', Buffer.from('definitely not a tar archive'), 'fake.tar')
      .expect(400)
      .expect((res) => {
        if (res.body.error !== 'Invalid file type') {
          throw new Error(`unexpected error: ${res.body.error}`);
        }
      });

    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(await fs.readdir(uploadsDir)).toEqual([]);
  });

  test('returns 503 when docker is unavailable and cleans up', async () => {
    childProcess.execFile.mockImplementation((file, args, callback) => {
      callback(new Error('docker: command not found'), '', '');
    });

    await request(app)
      .post('/images/upload')
      .attach('image', gzipBuffer(), 'x.tar.gz')
      .expect(503);

    expect(loadCalls()).toHaveLength(0);
    expect(await fs.readdir(uploadsDir)).toEqual([]);
  });

  test('surfaces docker load failure as 502 with the real message and cleans up', async () => {
    mockDockerLoad('', new Error('archive/tar: invalid tar header'));

    const res = await request(app)
      .post('/images/upload')
      .attach('image', ustarBuffer(), 'broken.tar')
      .expect(502);

    expect(res.body.error).toBe('Failed to load image');
    expect(res.body.message).toContain('invalid tar header');
    expect(await fs.readdir(uploadsDir)).toEqual([]);
  });
});

describe('POST /images/upload size limit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects a file over UPLOAD_MAX_BYTES with 413, spawns nothing, and cleans up', async () => {
    let freshChildProcess;
    let smallLimitApp;

    jest.isolateModules(() => {
      process.env.UPLOAD_MAX_BYTES = '1024';
      freshChildProcess = require('child_process');
      const freshRoutes = require('../routes/images');
      smallLimitApp = express();
      smallLimitApp.use(express.json());
      smallLimitApp.use('/images', freshRoutes);
      delete process.env.UPLOAD_MAX_BYTES;
    });

    const big = Buffer.alloc(2048);
    big[0] = 0x1f;
    big[1] = 0x8b;

    await request(smallLimitApp)
      .post('/images/upload')
      .attach('image', big, 'big.tar.gz')
      .expect(413);

    expect(freshChildProcess.execFile).not.toHaveBeenCalled();
    expect(await fs.readdir(uploadsDir)).toEqual([]);
  });
});
