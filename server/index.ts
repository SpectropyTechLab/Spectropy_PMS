import "dotenv/config"

import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

type RouteHandler = RequestHandler | ErrorRequestHandler;

function wrapAsyncHandler(handler: RouteHandler): RouteHandler {
  if (handler.length === 4) {
    const errorHandler = handler as ErrorRequestHandler;
    return ((err, req, res, next) => {
      Promise.resolve(errorHandler(err, req, res, next)).catch(next);
    }) as ErrorRequestHandler;
  }

  const requestHandler = handler as RequestHandler;
  return ((req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch(next);
  }) as RequestHandler;
}

function wrapHandlerEntry(entry: unknown): unknown {
  if (Array.isArray(entry)) {
    return entry.map((item) => wrapHandlerEntry(item));
  }
  if (typeof entry !== "function") {
    return entry;
  }

  return wrapAsyncHandler(entry as RouteHandler);
}

function enableAsyncErrorForwarding(expressApp: Express) {
  const methods = ["use", "get", "post", "put", "patch", "delete"] as const;

  for (const method of methods) {
    const original = (expressApp[method] as (...args: any[]) => unknown).bind(
      expressApp,
    );

    (expressApp as any)[method] = (...args: any[]) => {
      const [first, ...rest] = args;
      const hasExplicitPath =
        typeof first === "string" ||
        first instanceof RegExp ||
        (Array.isArray(first) &&
          first.every(
            (value) => typeof value === "string" || value instanceof RegExp,
          ));

      if (hasExplicitPath) {
        return original(first, ...rest.map((entry) => wrapHandlerEntry(entry)));
      }

      return original(...args.map((entry) => wrapHandlerEntry(entry)));
    };
  }
}

enableAsyncErrorForwarding(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://YOUR-FRONTEND.onrender.com"
    ],
    credentials: true,
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  //console.log(`${formattedTime} [${source}] ${message}\n`);
}

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

      log(logLine);
    }
  });

  next();
});
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

(async () => {
  await registerRoutes(httpServer, app);

  const cleanupDeletedRecords = async () => {
    try {
      const result = await storage.purgeDeletedRecords(30);
      if (result.deletedProjects > 0 || result.deletedTasks > 0) {
        log(
          `purged ${result.deletedProjects} deleted projects and ${result.deletedTasks} deleted tasks`,
          "cleanup",
        );
      }
    } catch (err) {
      console.error("Failed to purge deleted records:", err);
    }
  };

  cleanupDeletedRecords();
  setInterval(cleanupDeletedRecords, 1000 * 60 * 60 * 12);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Unhandled application error:", err);

    if (res.headersSent) {
      return next(err);
    }

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      ...(process.platform !== "win32" ? { reusePort: true } : {}),
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
