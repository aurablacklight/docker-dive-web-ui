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

const dockerUtils = require('../utils/docker');

const mockExecFileSuccess = (stdout = '', stderr = '') => {
  childProcess.execFile.mockImplementation((file, args, callback) => {
    callback(null, stdout, stderr);
  });
};

describe('Docker utils subprocess hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecFileSuccess('[]');
  });

  test('pullImage uses execFile argv array for valid images', async () => {
    await dockerUtils.pullImage('nginx:latest');

    expect(childProcess.execFile).toHaveBeenCalledWith('docker', ['pull', 'nginx:latest'], expect.any(Function));
    expect(childProcess.exec).not.toHaveBeenCalled();
  });

  test('getImageInfo uses execFile argv array for valid images', async () => {
    mockExecFileSuccess(JSON.stringify([{ Id: 'sha256:1', Config: {}, RootFS: {} }]));

    await dockerUtils.getImageInfo('nginx:latest');

    expect(childProcess.execFile).toHaveBeenCalledWith('docker', ['inspect', 'nginx:latest'], expect.any(Function));
    expect(childProcess.exec).not.toHaveBeenCalled();
  });

  test('getImageHistory uses execFile argv array for valid images', async () => {
    mockExecFileSuccess('layer|RUN echo ok|1B|now\n');

    await dockerUtils.getImageHistory('nginx:latest');

    expect(childProcess.execFile).toHaveBeenCalledWith(
      'docker',
      ['history', 'nginx:latest', '--format', '{{.ID}}|{{.CreatedBy}}|{{.Size}}|{{.CreatedAt}}', '--no-trunc'],
      expect.any(Function)
    );
    expect(childProcess.exec).not.toHaveBeenCalled();
  });

  test('loadImage uses execFile argv array with the given file path', async () => {
    mockExecFileSuccess('Loaded image: myapp:1.0\n');

    await dockerUtils.loadImage('/app/temp/uploads/upload-abc.tar');

    expect(childProcess.execFile).toHaveBeenCalledWith(
      'docker',
      ['load', '-i', '/app/temp/uploads/upload-abc.tar'],
      expect.any(Function)
    );
    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  test('loadImage parses loaded image refs and IDs from stdout', async () => {
    mockExecFileSuccess(
      'Loaded image: myapp:1.0\nLoaded image: myapp:latest\nLoaded image ID: sha256:abcdef1234\n'
    );

    const result = await dockerUtils.loadImage('/tmp/x.tar');

    expect(result.success).toBe(true);
    expect(result.loadedImages).toEqual(['myapp:1.0', 'myapp:latest']);
    expect(result.loadedImageIds).toEqual(['sha256:abcdef1234']);
  });

  test('loadImage surfaces docker failure as an error', async () => {
    childProcess.execFile.mockImplementation((file, args, callback) => {
      callback(new Error('invalid tar header'), '', '');
    });

    await expect(dockerUtils.loadImage('/tmp/bad.tar')).rejects.toThrow(
      'Failed to load image: invalid tar header'
    );
  });

  test.each(['alpine;id', 'alpine && id', '$(id)', '`id`', '--help', 'name with spaces', 'name\nother'])(
    'rejects invalid image %j before subprocess',
    async (imageName) => {
      await expect(dockerUtils.pullImage(imageName)).rejects.toThrow('Invalid image name');
      await expect(dockerUtils.removeImage(imageName)).rejects.toThrow('Invalid image name');
      await expect(dockerUtils.getImageInfo(imageName)).rejects.toThrow('Invalid image name');
      await expect(dockerUtils.imageExists(imageName)).rejects.toThrow('Invalid image name');
      await expect(dockerUtils.getImageHistory(imageName)).rejects.toThrow('Invalid image name');

      expect(childProcess.exec).not.toHaveBeenCalled();
      expect(childProcess.execFile).not.toHaveBeenCalled();
      expect(childProcess.spawn).not.toHaveBeenCalled();
      expect(pty.spawn).not.toHaveBeenCalled();
    }
  );
});
