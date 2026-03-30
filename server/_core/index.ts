import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { default as fetch } from "node-fetch";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Proxy /api/* → heating backend at 117.50.44.35:5000
  // Excludes /api/trpc and /api/oauth which are handled locally
  const HEATING_BACKEND = process.env.HEATING_BACKEND_URL || "http://117.50.44.35:5000";
  // Manual fetch-based proxy for heating backend APIs
  // Uses node-fetch to reliably set Accept: application/json header
  // (Flask backend returns HTML without this header)
  const heatingApiHandler = async (req: express.Request, res: express.Response) => {
    const targetUrl = `${HEATING_BACKEND}${req.originalUrl}`;
    try {
      const options: any = {
        method: req.method,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      };
      if (req.method === "POST" && req.body) {
        options.body = JSON.stringify(req.body);
      }
      const backendRes = await fetch(targetUrl, options);
      const data = await backendRes.json();
      res.status(backendRes.status).json(data);
    } catch (err: any) {
      console.error("[HeatingProxy] Error:", err.message);
      res.status(502).json({ error: "Backend unavailable", detail: err.message });
    }
  };
  app.get("/api/status", heatingApiHandler);
  app.get("/api/model_eval", heatingApiHandler);
  app.post("/api/optimize_global", heatingApiHandler);
  app.post("/api/global_optimize_run", heatingApiHandler);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
