const express = require('express');
const request = require('supertest');
const childProcess = require('child_process');
const pty = require('node-pty');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

const imagesRoutes = require('../routes/images');
const inspectRoutes = require('../routes/inspect');

const app = express();
app.use(express.json());
app.set('inspectionSockets', new Map());
app.set('io', { emit: jest.fn() });
app.use('/images', imagesRoutes);
app.use('/inspect', inspectRoutes);

const invalidImageNames = [
  'alpine;id',
  'alpine && id',
  '$(id)',
  '`id`',
  '--help',
  'name with spaces',
  'name\nother'
];

const expectNoSubprocess = () => {
  expect(childProcess.exec).not.toHaveBeenCalled();
  expect(childProcess.execFile).not.toHaveBeenCalled();
  expect(childProcess.spawn).not.toHaveBeenCalled();
  expect(pty.spawn).not.toHaveBeenCalled();
};

describe('Image operation security validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    childProcess.exec.mockImplementation((command, callback) => {
      callback(null, 'ok', '');
    });
    childProcess.execFile.mockImplementation((file, args, callback) => {
      callback(null, 'ok', '');
    });
  });

  test.each(invalidImageNames)('pull rejects %j before subprocess', async (imageName) => {
    await request(app)
      .post('/images/pull')
      .send({ imageName })
      .expect(400);

    expectNoSubprocess();
  });

  test.each(invalidImageNames)('inspect rejects %j before subprocess', async (imageName) => {
    await request(app)
      .post(`/inspect/${encodeURIComponent(imageName)}`)
      .expect(400);

    expectNoSubprocess();
  });

  test.each(invalidImageNames)('delete rejects %j before subprocess', async (imageName) => {
    await request(app)
      .delete(`/images/${encodeURIComponent(imageName)}`)
      .expect(400);

    expectNoSubprocess();
  });

  test.each(invalidImageNames)('info rejects %j before subprocess', async (imageName) => {
    await request(app)
      .get(`/images/${encodeURIComponent(imageName)}/info`)
      .expect(400);

    expectNoSubprocess();
  });

  test.each(invalidImageNames)('history rejects %j before subprocess', async (imageName) => {
    await request(app)
      .get(`/images/${encodeURIComponent(imageName)}/history`)
      .expect(400);

    expectNoSubprocess();
  });
});
