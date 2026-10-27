const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '  Life Awakening Fullstack Development Server');
console.log('\x1b[36m%s\x1b[0m', '  - Backend:  http://localhost:5181');
console.log('\x1b[36m%s\x1b[0m', '  - Frontend: http://localhost:5180');
console.log('\x1b[36m%s\x1b[0m', '==================================================\n');

// Start backend
const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'backend'),
  stdio: 'inherit',
  shell: true,
});

// Start frontend
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'frontend'),
  stdio: 'inherit',
  shell: true,
});

const cleanExit = () => {
  console.log('\n[Shutdown] Stopping servers...');
  if (backend && backend.pid) {
    try {
      if (isWin) {
        spawn('taskkill', ['/pid', backend.pid.toString(), '/f', '/t']);
      } else {
        backend.kill();
      }
    } catch (_) {}
  }
  if (frontend && frontend.pid) {
    try {
      if (isWin) {
        spawn('taskkill', ['/pid', frontend.pid.toString(), '/f', '/t']);
      } else {
        frontend.kill();
      }
    } catch (_) {}
  }
  process.exit();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

backend.on('error', (err) => console.error('[Backend error]:', err));
frontend.on('error', (err) => console.error('[Frontend error]:', err));
