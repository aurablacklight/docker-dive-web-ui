const childProcess = require('child_process');
const diveUtils = require('../utils/dive');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

describe('Dive Utils input validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    childProcess.execFile.mockImplementation((file, args, callback) => {
      callback(null, 'dive 0.12.0', '');
    });
  });

  test('rejects malicious image names', async () => {
    await expect(diveUtils.executeDiveSync('alpine;rm -rf /'))
      .rejects.toThrow('Invalid image name');

    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('isDiveAvailable uses execFile argv array', async () => {
    await expect(diveUtils.isDiveAvailable()).resolves.toBe(true);

    expect(childProcess.execFile).toHaveBeenCalledWith('dive', ['--version'], expect.any(Function));
    expect(childProcess.exec).not.toHaveBeenCalled();
  });
});
