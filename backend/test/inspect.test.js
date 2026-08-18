const express = require('express');
const request = require('supertest');
const childProcess = require('child_process');
const pty = require('node-pty');
const dockerUtils = require('../utils/docker.js');
const diveUtils = require('../utils/dive.js');
const catUtils = require('../utils/cat.js');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

jest.mock('../utils/docker.js', () => ({
  isDockerAvailable: jest.fn(),
  getDockerVersion: jest.fn(),
  imageExists: jest.fn(),
  pullImage: jest.fn()
}));

jest.mock('../utils/dive.js', () => ({
  isDiveAvailable: jest.fn(),
  executeDive: jest.fn()
}));

jest.mock('../utils/cat.js', () => ({
  generateCatResults: jest.fn()
}));

const inspectRoutes = require('../routes/inspect');

const app = express();
app.use(express.json());
app.set('inspectionSockets', new Map());
app.set('io', { emit: jest.fn() });
app.use('/inspect', inspectRoutes);

describe('Inspect route fail-closed behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dockerUtils.isDockerAvailable.mockResolvedValue(true);
    dockerUtils.imageExists.mockResolvedValue(true);
    dockerUtils.pullImage.mockResolvedValue({ success: true });
    diveUtils.isDiveAvailable.mockResolvedValue(true);
    diveUtils.executeDive.mockResolvedValue({ layers: [], analysis: { totalLayers: 0 } });
    catUtils.generateCatResults.mockResolvedValue({ results: [], cat_stats: {} });
  });

  test('invalid image name returns 400 without cat fallback or subprocess', async () => {
    await request(app)
      .post('/inspect/alpine%3Bid')
      .expect(400);

    expect(catUtils.generateCatResults).not.toHaveBeenCalled();
    expect(dockerUtils.isDockerAvailable).not.toHaveBeenCalled();
    expect(diveUtils.executeDive).not.toHaveBeenCalled();
    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(pty.spawn).not.toHaveBeenCalled();
  });

  test('dive failure returns 502 with no fabricated cat analysis', async () => {
    diveUtils.executeDive.mockRejectedValue(new Error('Dive exploded'));

    const response = await request(app)
      .post('/inspect/nginx%3Alatest')
      .expect(502);

    expect(response.body.success).not.toBe(true);
    expect(response.body.analysis).toBeUndefined();
    expect(response.body.message).toContain('Dive exploded');
    expect(catUtils.generateCatResults).not.toHaveBeenCalled();
  });
});
