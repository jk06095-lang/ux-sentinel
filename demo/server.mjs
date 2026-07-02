import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4173);

const routes = new Map([
  ["/", "fixed.html"],
  ["/broken", "broken.html"],
  ["/fixed", "fixed.html"],
  ["/feedback-recovery-broken", "feedback-recovery-broken.html"],
  ["/feedback-recovery-fixed", "feedback-recovery-fixed.html"],
  ["/high-priority-broken", "high-priority-broken.html"],
  ["/high-priority-fixed", "high-priority-fixed.html"],
  ["/interactive-agentic-states", "interactive-agentic-states.html"],
  ["/interactive-hover-block", "interactive-hover-block.html"],
  ["/interactive-navigation-allow", "interactive-navigation-allow.html"],
  ["/interactive-navigation-allow-next", "interactive-navigation-allow-next.html"],
  ["/interactive-motion", "interactive-motion.html"],
  ["/interactive-navigation-stop", "interactive-navigation-stop.html"],
  ["/interactive-skip", "interactive-skip.html"],
  ["/dashboard", "broken.html"]
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const file = routes.get(url.pathname);
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }

    const html = await readFile(path.join(__dirname, file), "utf8");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ux-sentinel demo server listening on http://127.0.0.1:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
