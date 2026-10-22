// Full-stack Nextcloud proof: Core + Admin host + Postgres + Caddy + Nextcloud.
// Proves the DAV write path through the shared FastCGI translator.
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workspaceRoot = path.join(repoRoot, '.workspace', '08-nextcloud');
const servicesRoot = path.join(workspaceRoot, 'services');
const evidenceRoot = path.join(repoRoot, 'output', 'e2e-nextcloud');
const keep = process.argv.includes('--keep');
const keepRunning = process.argv.includes('--keep-running') || process.env.NEXTCLOUD_E2E_KEEP_RUNNING === '1';
const lessonSelector = '08';
const adminUser = 'admin';
const adminPassword = 'service-lasso';
const davHost = 'nextcloud.servicelasso.localhost';
const davFile = '/remote.php/dav/files/admin/lesson.txt';
const davBody = 'hello from caddy';

let host;
let hostLog = '';
let setupLog = '';
let adminToken = '';
const checks = [];

function log(message) {
  console.log(`[e2e-nextcloud] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runNode(args, env = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      const output = stdout + stderr;
      if (code === 0) resolve(output);
      else reject(new Error(`Command failed (${code}): node ${args.join(' ')}\n${output.slice(-8000)}`));
    });
  });
}

async function request(pathname, { method = 'GET', body, token, allowFailure = false } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(new URL(pathname, host.runtimeUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(900000),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!allowFailure && !response.ok) {
    throw new Error(`${method} ${pathname} -> HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return { status: response.status, ok: response.ok, payload, text };
}

async function waitFor(label, fn, timeoutMs = 120000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

function findLocalOrigin(value, preferredPath) {
  const origins = [];
  const visit = (candidate) => {
    if (typeof candidate === 'string') {
      if (/^https?:\/\/127\.0\.0\.1:\d+(?:\/|$)/.test(candidate)) origins.push(candidate);
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;
    for (const child of Object.values(candidate)) visit(child);
  };
  visit(value);
  const preferred = origins.find((origin) => origin.includes(preferredPath));
  const selected = preferred ?? origins[0];
  return selected ? new URL(selected).origin : null;
}

async function serviceOrigin(serviceId, fallbackPort, preferredPath = '/') {
  try {
    const response = await request(`/api/services/${encodeURIComponent(serviceId)}/network`);
    const origin = findLocalOrigin(response.payload, preferredPath);
    if (origin) return origin;
  } catch {
    // Fall back to the declared port below.
  }
  return `http://127.0.0.1:${fallbackPort}`;
}

function lifecycleOutcome(payload) {
  const nested = payload?.result;
  const outcome = nested && typeof nested === 'object' ? nested : payload;
  return {
    ok: payload?.ok ?? outcome?.ok,
    skippedReason: payload?.skippedReason ?? outcome?.skippedReason,
    state: payload?.state ?? outcome?.state,
    message: payload?.message ?? outcome?.message,
  };
}

async function lifecycle(serviceId, action, { token, allowFailure = false, allowSkip = false } = {}) {
  const response = await request(`/api/services/${encodeURIComponent(serviceId)}/${action}`, {
    method: 'POST',
    body: { confirm: true },
    token,
    allowFailure,
  });
  const outcome = lifecycleOutcome(response.payload);
  log(`${serviceId}.${action}: ok=${outcome.ok} skipped=${outcome.skippedReason ?? 'none'} running=${outcome.state?.running ?? 'unknown'}${outcome.message ? ` message=${outcome.message}` : ''}`);
  if (!allowFailure && !allowSkip && (outcome.ok === false || outcome.skippedReason)) {
    throw new Error(`${serviceId}.${action} failed: ${outcome.message ?? outcome.skippedReason ?? response.text.slice(0, 300)}`);
  }
  return { ...response, outcome, result: response.payload };
}

async function installAndConfigure(serviceId, token) {
  log(`installing ${serviceId}`);
  await lifecycle(serviceId, 'install', { token, allowSkip: true });
  log(`configuring ${serviceId}`);
  await lifecycle(serviceId, 'config', { token, allowSkip: true });
}

async function startService(serviceId, token) {
  log(`starting ${serviceId}`);
  const response = await lifecycle(serviceId, 'start', { token, allowFailure: true });
  if (response.outcome.ok !== true || response.outcome.state?.running !== true) {
    throw new Error(`${serviceId}.start failed: ${response.outcome.message ?? response.outcome.skippedReason ?? 'unknown lifecycle failure'}`);
  }
  checks.push({ serviceId, action: 'start', ok: true });
  return response.result;
}

async function stopService(serviceId, token) {
  log(`stopping ${serviceId}`);
  await lifecycle(serviceId, 'stop', { token, allowFailure: true });
}

function davRequest(port, method, pathname, { body, headers = {} } = {}) {
  const authorization = `Basic ${Buffer.from(`${adminUser}:${adminPassword}`).toString('base64')}`;
  return new Promise((resolve, reject) => {
    const requestHeaders = {
      host: davHost,
      authorization,
      ...(body === undefined ? {} : { 'content-length': Buffer.byteLength(body) }),
      ...headers,
    };
    const request = http.request({ host: '127.0.0.1', port, method, path: pathname, headers: requestHeaders, timeout: 300000 }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: text }));
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('WebDAV request timed out')));
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function parseReady(line) {
  const prefix = 'LESSON_READY:';
  const index = line.indexOf(prefix);
  if (index < 0) return null;
  try { return JSON.parse(line.slice(index + prefix.length)); } catch { return null; }
}

async function startHost() {
  host = spawn(process.execPath, ['scripts/lesson.mjs', 'run', lessonSelector, '--management'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LESSON_API_PORT: process.env.LESSON_API_PORT ?? '0',
      LESSON_HOST_PORT: process.env.LESSON_HOST_PORT ?? '0',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => reject(new Error('Lesson host did not become ready in time')), 240000);
    const finish = (error, ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(ready);
    };
    const lines = createInterface({ input: host.stdout });
    lines.on('line', (line) => {
      hostLog += `${line}\n`;
      const ready = parseReady(line);
      if (ready) {
        host.runtimeUrl = ready.runtimeUrl;
        log(`host ready at ${ready.runtimeUrl}`);
        finish(null, ready);
      }
    });
    host.stderr.on('data', (chunk) => { hostLog += chunk.toString(); });
    host.on('error', (error) => finish(error));
    host.on('exit', (code) => finish(new Error(`Lesson host exited before ready (${code})\n${hostLog.slice(-6000)}`)));
  });
}

async function stopHost() {
  if (!host) return;
  try { host.stdin.write('shutdown\n'); } catch { /* already closed */ }
  const exited = await Promise.race([
    new Promise((resolve) => host.once('exit', () => resolve(true))),
    sleep(30000).then(() => false),
  ]);
  if (!exited) {
    host.kill();
    await new Promise((resolve) => host.once('exit', resolve));
  }
}

function cleanupWorkspaceProcesses() {
  if (process.platform !== 'win32') return;
  const pattern = workspaceRoot.replace(/'/g, "''");
  try {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.CommandLine -like '*${pattern}*' -or $_.Name -like 'php-cgi*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', windowsHide: true });
  } catch {
    // Best-effort stale-process cleanup; the start checks still fail closed.
  }
}

async function main() {
  await mkdir(evidenceRoot, { recursive: true });
  cleanupWorkspaceProcesses();
  if (!keep) await rm(workspaceRoot, { recursive: true, force: true });

  log('preparing the isolated 08 snapshot');
  setupLog += await runNode(['scripts/lesson.mjs', 'setup', lessonSelector]);

  await startHost();
  let token = process.env.NEXTCLOUD_E2E_ADMIN_TOKEN ?? '';

  // Bootstrap the local Broker so first-run operator auth can issue a session.
  await installAndConfigure('@secretsbroker', token);
  const bootstrap = await request('/api/setup/bootstrap', { method: 'POST', body: {} });
  checks.push({ check: 'broker-bootstrap', state: bootstrap.payload?.bootstrap?.state, ok: true });

  if (!token) {
    const firstRun = await request('/api/runtime/auth/first-run');
    const envelope = firstRun.payload?.firstRun;
    if (!envelope?.token) throw new Error('First-run local operator credentials are unavailable');
    const local = await request('/api/runtime/auth/local', {
      method: 'POST',
      body: { method: 'token', token: envelope.token },
    });
    token = local.payload?.session?.token;
    if (!token) throw new Error('Core did not issue a local operator session token');
    await request('/api/runtime/auth/first-run/acknowledge', { method: 'POST', body: {} });
    checks.push({ check: 'local-operator-session', ok: true });
  }
  adminToken = token;

  await installAndConfigure('postgres', token);
  await startService('postgres', token);
  checks.push({ check: 'postgres-ready', ok: true });

  await installAndConfigure('@caddy', token);
  await startService('@caddy', token);

  await installAndConfigure('nextcloud', token);
  await startService('nextcloud', token);
  checks.push({ check: 'nextcloud-fastcgi-ready', ok: true });

  const caddyOrigin = await serviceOrigin('@caddy', 8080, '/health');
  const caddy = new URL(caddyOrigin);
  const caddyPort = Number(caddy.port || 80);
  log(`caddy origin ${caddyOrigin}`);

  const ncNetwork = await request('/api/services/nextcloud/network').catch((error) => ({ payload: { error: error.message } }));
  log(`nextcloud network: ${JSON.stringify(ncNetwork.payload).slice(0, 3000)}`);
  try {
    const admin = await fetch('http://127.0.0.1:2019/config/');
    log(`caddy config: ${(await admin.text()).slice(0, 5000)}`);
  } catch (error) {
    log(`caddy config unavailable: ${error.message}`);
  }
  const probe = await davRequest(caddyPort, 'GET', '/status.php').catch((error) => ({ error: error.message }));
  log(`status probe: ${JSON.stringify({ status: probe.status, body: probe.body?.slice(0, 300), error: probe.error })}`);

  await waitFor('caddy health', async () => {
    try {
      const response = await fetch(new URL('/health', caddy), { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }, 60000);

  await waitFor('nextcloud status.php through Caddy', async () => {
    try {
      const response = await davRequest(caddyPort, 'GET', '/status.php');
      return response.status === 200 && response.body.includes('"installed":true');
    } catch {
      return false;
    }
  }, 60000, 2000);
  checks.push({ check: 'nextcloud-status-through-caddy', ok: true });

  const put = await davRequest(caddyPort, 'PUT', davFile, { body: davBody });
  if (put.status !== 201) throw new Error(`WebDAV PUT returned ${put.status}: ${put.body.slice(0, 400)}`);
  checks.push({ check: 'webdav-put', status: put.status, ok: true });

  const get = await davRequest(caddyPort, 'GET', davFile);
  if (get.status !== 200 || get.body !== davBody) {
    throw new Error(`WebDAV GET returned ${get.status} with body ${JSON.stringify(get.body.slice(0, 200))}`);
  }
  checks.push({ check: 'webdav-get', status: get.status, bytes: Buffer.byteLength(get.body), ok: true });

  const propfind = await davRequest(caddyPort, 'PROPFIND', '/remote.php/dav/files/admin/', { headers: { depth: '1' } });
  if (propfind.status !== 207 || !propfind.body.includes('lesson.txt')) {
    throw new Error(`WebDAV PROPFIND returned ${propfind.status}`);
  }
  checks.push({ check: 'webdav-propfind', status: propfind.status, ok: true });

  await writeFile(path.join(evidenceRoot, 'receipt.json'), `${JSON.stringify({
    lesson: '08-nextcloud',
    caddyOrigin,
    webdavHost: davHost,
    file: davFile,
    checks,
    completedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
}

try {
  await main();
  log('PASS: Nextcloud served through Caddy with WebDAV PUT/GET/PROPFIND');
} catch (error) {
  log(`FAIL: ${error.message}`);
  await writeFile(path.join(evidenceRoot, 'failure.txt'), `${error.stack ?? error}\n`, 'utf8').catch(() => {});
  try {
    const runtime = await request('/api/runtime', { token: adminToken });
    log(`runtime: ${JSON.stringify(runtime.payload?.runtime?.services ?? runtime.payload?.services ?? {})}`.slice(0, 4000));
  } catch (diagnosticError) {
    log(`runtime diagnostic unavailable: ${diagnosticError.message}`);
  }
  process.exitCode = 1;
} finally {
  if (!keepRunning) await stopHost().catch(() => {});
  await writeFile(path.join(evidenceRoot, 'host.log'), hostLog, 'utf8').catch(() => {});
  await writeFile(path.join(evidenceRoot, 'setup.log'), setupLog, 'utf8').catch(() => {});
  if (!keep && !keepRunning && process.exitCode === 0) {
    cleanupWorkspaceProcesses();
    await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
  }
}
