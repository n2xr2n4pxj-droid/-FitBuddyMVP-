// ==========================================
// 環境變量加載和驗證（必須在最開始執行）
// ==========================================
import { config, validateConfig, getConfigSummary } from "./config/env";

// 驗證環境變量配置
try {
  validateConfig();
  console.log('📋 Configuration Summary:', JSON.stringify(getConfigSummary(), null, 2));
} catch (error) {
  console.error('❌ Failed to validate environment variables:', error);
  process.exit(1);
}

import express, { type Request, Response, NextFunction } from "express";
import { createRequire } from "module";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const require = createRequire(import.meta.url);
const cors = require("cors");

const app = express();

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));

app.use(express.json({
  limit: "100kb",
  verify: (req: express.Request, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});




app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.app.port;
  server.listen(port, "0.0.0.0", () => {
    log(`🚀 FitBuddy server started on port ${port}`);
    log(`📝 Environment: ${config.app.env}`);
    log(`🌐 Client URL: ${config.app.clientUrl}`);
  });
})();
