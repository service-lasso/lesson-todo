import { createServer, request as httpRequest } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const mime = {".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".json":"application/json"};
export function createAdminServer(config) {
  const core = new URL(config.runtimeUrl);
  if (core.protocol !== "http:" || core.hostname !== "127.0.0.1" || core.pathname !== "/") throw Error("Admin upstream must be owned loopback Core");
  const server = createServer(async (request,response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) {
      response.writeHead(403); response.end("origin refused"); return;
    }
    try {
      const url = new URL(request.url,origin);
      if (url.pathname.startsWith("/api/")) {
        const headers = {...request.headers};
        delete headers.host; delete headers.connection;
        const upstream = httpRequest(new URL(url.pathname+url.search,core),{method:request.method,headers},incoming => {
          const out = {...incoming.headers}; delete out.connection;
          response.writeHead(incoming.statusCode,out); incoming.pipe(response);
        });
        upstream.on("error",()=> { if (!response.headersSent) response.writeHead(502); response.end("Core unavailable"); });
        response.on("close",()=>upstream.destroy());
        request.on("aborted",()=>upstream.destroy()); request.pipe(upstream); return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
      const root = path.resolve(config.adminDistRoot);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/,"");
      let file = path.resolve(root,relative || "index.html");
      if (!file.startsWith(root+path.sep)) { response.writeHead(404); response.end(); return; }
      try { if (!(await stat(file)).isFile()) throw Error(); } catch {
        if (relative.startsWith("assets/") || relative.startsWith("images/") || path.extname(relative)) { response.writeHead(404); response.end(); return; }
        file = path.join(root,"index.html");
      }
      response.writeHead(200,{"content-type":mime[path.extname(file)] || "application/octet-stream"});
      if (request.method === "HEAD") response.end(); else createReadStream(file).pipe(response);
    } catch { if (!response.headersSent) response.writeHead(500); response.end("Admin unavailable"); }
  });
  return server;
}
