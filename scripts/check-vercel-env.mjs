import process from 'node:process';
import { URL } from 'node:url';
export function validateDeploymentEnv(env) {
  const issues = [];
  for (const [key, protocol] of [
    ['VITE_API_URL', 'https:'],
    ['VITE_WS_URL', 'wss:'],
  ]) {
    const value = env[key]?.trim();
    if (!value) {
      issues.push(key + ' is required on Vercel.');
      continue;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== protocol) issues.push(key + ' must use ' + protocol);
      if (/^(localhost|127\\..*|\\[::1\\]|0\\.0\\.0\\.0)$/.test(url.hostname))
        issues.push(key + ' must point to the public backend.');
      if (url.username || url.password || url.search || url.hash)
        issues.push(
          key + ' must not contain credentials, query parameters or fragments.',
        );
      if (key === 'VITE_API_URL' && url.pathname !== '/')
        issues.push(key + ' must be the backend origin without /api.');
      if (key === 'VITE_WS_URL' && url.pathname !== '/ws')
        issues.push(key + ' must point to the backend /ws endpoint.');
    } catch {
      issues.push(key + ' must be an absolute URL.');
    }
  }
  return issues;
}
const issues = validateDeploymentEnv(process.env);
if (issues.length) {
  process.stderr.write(
    'Vercel environment is incomplete:\n' +
      issues.map((i) => '- ' + i).join('\n') +
      '\nSee docs/VERCEL.md. No credentials were logged.\n',
  );
  process.exitCode = 1;
}
