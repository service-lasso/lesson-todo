import { startApiServer } from '@service-lasso/service-lasso';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { createAdminServer } from './admin-server.js';

async function close(server) {
  if (!server?.listening) return;
  const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed;
}
export async function runLessonHost(config, { management = false } = {}) {
  process.env.SERVICE_LASSO_INSTANCE_REGISTRY_PATH = config.registryPath;
  process.env.SERVICE_LASSO_HOST_PORT_REGISTRY_PATH = config.portRegistryPath;
  let runtime, shell, admin, shutdownPromise;
  const shutdown = reason => shutdownPromise ??= (async () => {
    console.log(`Stopping owned ${config.id} host: ${reason}`);
    await close(shell); await close(admin); if (runtime) await runtime.stop();
  })();
  try {
    runtime = await startApiServer({ host: '127.0.0.1', port: Number(process.env.LESSON_API_PORT ?? 0),
      servicesRoot: config.servicesRoot, workspaceRoot: config.workspaceRoot,
      noAutostart: management, baselineBootstrap: { serviceIds: ['@secretsbroker', '@node', '@python', '@java'] } });
    config.runtimeUrl = runtime.url;
    admin = createAdminServer(config); admin.listen(0, '127.0.0.1'); await once(admin, 'listening');
    config.adminUrl = `http://127.0.0.1:${admin.address().port}/`;
    shell = createServer(async (request, response) => {
      if (request.url === '/admin') { response.writeHead(302, {location: config.adminUrl}); response.end(); return; }
      if (request.url === '/api/host-status') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ ...config, management })); return; }
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(`<title>Todo ${config.id}</title><h1>Todo ${config.id}</h1><p><a href="${config.adminUrl}">Open Service Admin</a></p><p>Install, configure and start Todo there. Its allocated web endpoint opens the app.</p><p>Type shutdown here to stop this owned stack.</p>`);
    });
    shell.listen(Number(process.env.LESSON_HOST_PORT ?? 0), '127.0.0.1'); await once(shell, 'listening');
    console.log(`LESSON_READY:${JSON.stringify({ id: config.id, hostUrl: `http://127.0.0.1:${shell.address().port}`, adminUrl: config.adminUrl, runtimeUrl: runtime.url, servicesRoot: config.servicesRoot, workspaceRoot: config.workspaceRoot })}`);
    const input = createInterface({ input: process.stdin });
    const stop = reason => void shutdown(reason).then(() => { input.close(); process.exit(0); }, () => { console.error('Owned shutdown failed; preserve state for diagnosis.'); process.exitCode = 1; });
    input.on('line', line => { if (line === 'shutdown') stop('stdin'); });
    input.on('close', () => stop('owner pipe closed'));
    process.on('SIGINT', () => stop('Ctrl+C')); process.on('SIGTERM', () => stop('termination'));
    return { runtime, shell, admin, shutdown };
  } catch (error) { await shutdown('startup failed'); throw error; }
}
