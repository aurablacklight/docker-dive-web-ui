const { killAllPTYs, activePTYs } = require("../server");
const pty = require("node-pty");

jest.setTimeout(10000);

test("killAllPTYs terminates tracked PTYs", (done) => {
  const shell = pty.spawn("bash", ["-c", "sleep 1000"], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    env: process.env,
  });

  activePTYs.add(shell);
  const pid = shell.pid;

  killAllPTYs();

  setTimeout(() => {
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    expect(alive).toBe(false);
    done();
  }, 200);
});
