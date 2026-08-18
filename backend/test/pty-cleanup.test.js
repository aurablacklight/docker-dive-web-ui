const pty = require("node-pty");

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn()
}));

jest.mock("node-pty", () => ({
  spawn: jest.fn()
}));

const { killAllPTYs, activePTYs } = require("../server");

jest.setTimeout(10000);

test("killAllPTYs terminates tracked PTYs", () => {
  const shell = {
    killed: false,
    kill: jest.fn(function kill() {
      this.killed = true;
    })
  };
  pty.spawn.mockReturnValue(shell);

  const spawnedShell = pty.spawn("dive", ["alpine:latest"], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    env: process.env,
  });

  activePTYs.add(spawnedShell);

  killAllPTYs();

  expect(spawnedShell.kill).toHaveBeenCalled();
  expect(spawnedShell.killed).toBe(true);
  expect(activePTYs.size).toBe(0);
});
