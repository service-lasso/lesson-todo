// Full-stack OpenBao proof: Core + Admin host + Broker + OpenBao + Echo consumer.
// Secrets stay in process memory and are never written to the receipt or logs.
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonRoot = path.join(repoRoot, 'lessons', '07-openbao');
const workspaceRoot = path.join(repoRoot, '.workspace', '07-openbao');
const servicesRoot = path.join(workspaceRoot, 'services');
const runtimeRoot = path.join(workspaceRoot, 'runtime');
const evidenceRoot = path.join(repoRoot, 'output', 'e2e-openbao');
const keep = process.argv.includes('--keep');
const expectedValue = process.env.OPENBAO_LESSON_VALUE ?? 'openbao-lesson-secret';
const preferredOpenBaoPort = Number(process.env.OPENBAO_LESSON_PORT ?? 18200);
const preferredCheckPort = Number(process.env.OPENBAO_CHECK_PORT ?? 4020);
const ref = 'todo/openbao/openbao.DEMO_VALUE';

let host;
let hostLog = '';
let setupLog = '';
let adminToken = '';
const checks = [];

function log(message) {
  console.log(`[e2e-openbao] ${message}`);
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
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!allowFailure && !response.ok) {
    throw new Error(`${method} ${pathname} -> HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return { status: response.status, ok: response.ok, payload, text };
}

async function waitFor(label, fn, timeoutMs = 120000, intervalMs = 500) {
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
    // Fall back to the lesson's declared port below.
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

async function lifecycle(serviceId, action, { token, allowFailure = false } = {}) {
  const response = await request(`/api/services/${encodeURIComponent(serviceId)}/${action}`, {
    method: 'POST',
    body: { confirm: true },
    token,
    allowFailure,
  });
  const outcome = lifecycleOutcome(response.payload);
  log(`${serviceId}.${action}: ok=${outcome.ok} skipped=${outcome.skippedReason ?? 'none'} running=${outcome.state?.running ?? 'unknown'}${outcome.message ? ` message=${outcome.message}` : ''}`);
  if (!allowFailure && (outcome.ok === false || outcome.skippedReason)) {
    throw new Error(`${serviceId}.${action} failed: ${outcome.message ?? outcome.skippedReason ?? response.text.slice(0, 300)}`);
  }
  return { ...response, outcome, result: response.payload };
}

async function installAndConfigure(serviceId, token) {
  log(`installing ${serviceId}`);
  await lifecycle(serviceId, 'install', { token });
  log(`configuring ${serviceId}`);
  await lifecycle(serviceId, 'config', { token });
}

async function startService(serviceId, token) {
  log(`starting ${serviceId}`);
  const response = await lifecycle(serviceId, 'start', { token, allowFailure: true });
  if (response.outcome.ok !== true || response.outcome.skippedReason || response.outcome.state?.running !== true) {
    throw new Error(`${serviceId}.start failed: ${response.outcome.message ?? response.outcome.skippedReason ?? 'unknown lifecycle failure'}`);
  }
  checks.push({ serviceId, action: 'start', ok: true });
  return response.result;
}

async function stopService(serviceId, token) {
  log(`stopping ${serviceId}`);
  await lifecycle(serviceId, 'stop', { token });
}

async function waitForOpenBao(origin, caPath) {
  const ca = await readFile(caPath);
  await waitFor('OpenBao health', async () => {
    return await new Promise((resolve) => {
      const request = https.get(new URL('/v1/sys/health', origin), { ca, rejectUnauthorized: true }, (response) => {
        response.resume();
        resolve(response.statusCode < 500);
      });
      request.on('error', () => resolve(false));
      request.setTimeout(3000, () => request.destroy());
    });
  }, 90000);
}

async function configureOpenBao(origin, caPath) {
  const output = await runNode([
    'lessons/07-openbao/scripts/configure-openbao.mjs',
    servicesRoot,
    '--address', origin,
    '--ca', caPath,
    '--force',
  ]);
  setupLog += output;
  log(`configured Broker TLS source for ${origin}`);
}

async function seedOpenBao(origin, caPath) {
  await runNode(['lessons/07-openbao/scripts/seed-openbao.mjs'], {
    BAO_ADDR: origin,
    BAO_CACERT: caPath,
    BAO_TOKEN: 'lesson-root',
    OPENBAO_LESSON_VALUE: expectedValue,
  });
  log('seeded OpenBao KV v2 value');
}

async function checkConsumer(origin) {
  const response = await fetch(new URL('/env', origin), { redirect: 'error' });
  if (!response.ok) throw new Error(`Echo /env returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.env?.ECHO_OPENBAO_SECRET !== expectedValue) {
    throw new Error('Echo did not receive the OpenBao-backed Broker value');
  }
  log('consumer received the OpenBao-backed value');
}

function parseReady(line) {
  const prefix = 'LESSON_READY:';
  const index = line.indexOf(prefix);
  if (index < 0) return null;
  try { return JSON.parse(line.slice(index + prefix.length)); } catch { return null; }
}

async function startHost() {
  host = spawn(process.execPath, ['scripts/lesson.mjs', 'run', '07', '--management'], {
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
    const timer = setTimeout(() => reject(new Error('Lesson host did not become ready in time')), 180000);
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

function killListeningPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const lines = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    const pids = [...new Set(lines.split(/\r?\n/)
      .filter((line) => line.includes(`:${port}`) && /LISTENING/i.test(line))
      .map((line) => line.trim().split(/\s+/).at(-1))
      .filter((pid) => /^\d+$/.test(pid)))];
    for (const pid of pids) {
      log(`stopping stale listener on port ${port} (pid ${pid})`);
      execFileSync('taskkill.exe', ['/PID', pid, '/F', '/T'], { stdio: 'ignore', windowsHide: true });
    }
  } catch {
    // Best effort; a missing listener is the normal case.
  }
}

function portDiagnostics(port) {
  if (process.platform !== 'win32') return;
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"; "$($_.OwningProcess) $($p.Name) $($p.CommandLine)" }`,
    ], { encoding: 'utf8', windowsHide: true });
    log(`port ${port} owner: ${output.trim() || 'none'}`);
  } catch (error) {
    log(`port ${port} diagnostic failed: ${error.message}`);
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
      `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.CommandLine -like '*${pattern}*' -or $_.Name -like 'echo-service*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-NetTCPConnection -LocalPort 4011,4020 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', windowsHide: true });
  } catch {
    // Best-effort stale-process cleanup; the start checks still fail closed.
  }
}

async function main() {
  await mkdir(evidenceRoot, { recursive: true });
  cleanupWorkspaceProcesses();
  killListeningPort(4011);
  killListeningPort(preferredCheckPort);
  if (!keep) await rm(workspaceRoot, { recursive: true, force: true });

  log('preparing the isolated 07 snapshot');
  setupLog += await runNode(['scripts/lesson.mjs', 'setup', '07']);

  await startHost();
  let token = process.env.OPENBAO_E2E_ADMIN_TOKEN ?? '';

  // The Broker must be installed and configured before Core's first-run bootstrap.
  await installAndConfigure('@openbao', token);
  await startService('@openbao', token);
  const openBaoOrigin = await serviceOrigin('@openbao', preferredOpenBaoPort, '/v1/sys/health');
  const openBaoCaPath = path.join(servicesRoot, '@openbao', 'runtime', 'tls', 'vault-ca.pem');
  await waitFor('OpenBao TLS CA', async () => {
    try { await readFile(openBaoCaPath); return true; } catch { return false; }
  }, 60000);
  await waitForOpenBao(openBaoOrigin, openBaoCaPath);
  checks.push({ check: 'openbao-tls-health', origin: openBaoOrigin, ok: true });
  await configureOpenBao(openBaoOrigin, openBaoCaPath);

  await installAndConfigure('@secretsbroker', token);

  log('running first-run Broker bootstrap');
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

  await seedOpenBao(openBaoOrigin, openBaoCaPath);
  checks.push({ check: 'openbao-seed', ref, ok: true });

  await installAndConfigure('openbao-check', token);
  killListeningPort(preferredCheckPort);
  await lifecycle('openbao-check', 'stop', { token, allowFailure: true });
  await startService('openbao-check', token);
  const checkOrigin = await serviceOrigin('openbao-check', preferredCheckPort, '/env');
  await waitFor('consumer readiness', async () => {
    const response = await fetch(new URL('/health', checkOrigin), { redirect: 'error' }).catch(() => null);
    return response?.ok === true;
  }, 60000);
  await checkConsumer(checkOrigin);
  checks.push({ check: 'openbao-resolution', ref, consumer: checkOrigin, ok: true });

  log('proving fail-closed when the source is stopped');
  await stopService('openbao-check', token);
  await stopService('@openbao', token);
  await writeFile(path.join(evidenceRoot, 'pre-failure-checks.json'), `${JSON.stringify(checks, null, 2)}\n`, 'utf8');
  const failedStart = await lifecycle('openbao-check', 'start', { token, allowFailure: true });
  const failed = failedStart.status >= 400 || failedStart.outcome.ok === false || Boolean(failedStart.outcome.skippedReason);
  if (!failed) throw new Error('Consumer started while the mapped OpenBao source was unavailable');
  checks.push({ check: 'openbao-source-down-fail-closed', ok: true });
  log('required import failed closed');

  log('restarting the source and re-proving resolution');
  await startService('@openbao', token);
  await waitForOpenBao(openBaoOrigin, openBaoCaPath);
  await configureOpenBao(openBaoOrigin, openBaoCaPath);
  const brokerRestart = await lifecycle('@secretsbroker', 'restart', { token, allowFailure: true });
  if (brokerRestart.outcome.ok !== true || brokerRestart.outcome.state?.running !== true) {
    throw new Error(`Broker restart after OpenBao CA rotation failed: ${brokerRestart.outcome.message ?? 'unknown lifecycle failure'}`);
  }
  await seedOpenBao(openBaoOrigin, openBaoCaPath);
  await startService('openbao-check', token);
  await checkConsumer(checkOrigin);
  checks.push({ check: 'openbao-resolution-after-restart', ref, ok: true });

  const runtime = await request('/api/runtime');
  await writeFile(path.join(evidenceRoot, 'receipt.json'), `${JSON.stringify({
    lesson: '07-openbao',
    ref,
    openbaoOrigin: openBaoOrigin,
    consumerOrigin: checkOrigin,
    expectedValueBytes: Buffer.byteLength(expectedValue),
    bootstrapState: bootstrap.payload?.bootstrap?.state,
    services: runtime.payload?.runtime?.services ?? undefined,
    checks,
    completedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
}

try {
  await main();
  log('PASS: OpenBao full-stack resolution and fail-closed behavior');
} catch (error) {
  log(`FAIL: ${error.message}`);
  await writeFile(path.join(evidenceRoot, 'failure.txt'), `${error.stack ?? error}\n`, 'utf8').catch(() => {});
  try {
    const status = await request('/api/services/@secretsbroker/proxy/v1/sources/status', { token: adminToken });
    const sources = Array.isArray(status.payload?.sources) ? status.payload.sources : [];
    log(`broker source status: ${JSON.stringify(sources.map((source) => ({
      sourceId: source.sourceId,
      kind: source.kind,
      enabled: source.enabled,
      state: source.state ?? source.lifecycle?.state,
      outcome: source.outcome ?? source.lifecycle?.outcome,
    })))}`);
  } catch (diagnosticError) {
    log(`broker source status unavailable: ${diagnosticError.message}`);
  }
  process.exitCode = 1;
} finally {
  await stopHost().catch(() => {});
  await writeFile(path.join(evidenceRoot, 'host.log'), hostLog, 'utf8').catch(() => {});
  await writeFile(path.join(evidenceRoot, 'setup.log'), setupLog, 'utf8').catch(() => {});
  if (!keep && process.exitCode === 0) await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
}
