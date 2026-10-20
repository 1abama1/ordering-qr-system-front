// Credentials arrive on hidden stdin and exist only in this process environment.
import process from 'node:process';
import { spawn } from 'node:child_process';
let buffer = '';
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write('Ready for test credentials JSON on stdin (hidden).\n');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (chunk.includes('\u0003')) process.exit(130);
  buffer += chunk;
  if (!buffer.includes('\n') && !buffer.includes('\r')) return;
  process.stdin.pause();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  try {
    const input = JSON.parse(
      buffer.slice(buffer.indexOf('{'), buffer.lastIndexOf('}') + 1),
    );
    buffer = '';
    if (!input.username || !input.password || input.devTest !== true)
      throw new Error();
    process.stdout.write(
      'Credentials accepted. Starting real browser tests.\n',
    );
    const child = spawn(
      process.execPath,
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        '--config',
        'playwright.real.config.ts',
        ...process.argv.slice(2),
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TEST_ADMIN_USERNAME: input.username,
          TEST_ADMIN_PASSWORD: input.password,
          REAL_E2E: '1',
        },
      },
    );
    input.password = '';
    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('error', () => {
      process.stderr.write('Unable to spawn test runner.\n');
      process.exit(1);
    });
    child.on('exit', (code) => {
      process.stdout.write('Real test runner exited: ' + code + '\n');
      process.exit(code ?? 1);
    });
  } catch {
    process.stderr.write('Invalid test credentials input.\n');
    process.exit(1);
  }
});
