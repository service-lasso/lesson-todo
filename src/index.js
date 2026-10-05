import { startApiServer } from "@service-lasso/service-lasso";
import { once } from "node:events";
import { createHostServer } from "./server.js";
import { resolveAppNodeConfig, validateAppNodeConfig } from "./config.js";
import { prepareStarterServicesRoot } from "./services-root.js";

async function closeServer(server) {
  server.close();
  await once(server, "close");
}

async function main() {
  const config = await validateAppNodeConfig(resolveAppNodeConfig());

  console.log(`[app-node] booting Service Lasso runtime on ${config.runtimeUrl}`);
  console.log(`[app-node] servicesRoot=${config.servicesRoot}`);
  console.log(`[app-node] workspaceRoot=${config.workspaceRoot}`);
  const preparedServices = await prepareStarterServicesRoot(config);
  console.log(`[app-node] prepared tracked services inventory at ${preparedServices.servicesRoot}`);

  const runtime = await startApiServer({
    port: config.runtimePort,
    servicesRoot: config.servicesRoot,
    workspaceRoot: config.workspaceRoot,
  });

  const hostServer = createHostServer(config);
  hostServer.listen(config.hostPort, "127.0.0.1");
  await once(hostServer, "listening");

  console.log(`[app-node] host shell ready at ${config.hostUrl}`);
  console.log(`[app-node] admin UI ready at ${config.adminUrl}`);
  console.log(`[app-node] runtime API ready at ${runtime.url}`);

  let stopping = false;

  async function shutdown(signal) {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log(`[app-node] shutting down after ${signal}`);

    await closeServer(hostServer);
    await runtime.stop();
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT").finally(() => {
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM").finally(() => {
      process.exit(0);
    });
  });
}

await main();
