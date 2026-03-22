import { spawn, type ChildProcess } from 'child_process';

function run(name: string, args: string[]): ChildProcess {
  const child = spawn('npx', args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', code => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  console.log(`[dev] started ${name}`);
  return child;
}

const children = [
  run('agent', ['tsx', 'watch', 'src/agent/index.ts']),
  run('dashboard', ['tsx', 'watch', 'src/dashboard/server.ts']),
];

function shutdown(signal: NodeJS.Signals): void {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
