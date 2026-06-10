import http from "http";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { Server } from "socket.io";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { coreRouter } from "./routes/core.routes";
import { swaggerSpec } from "./docs/swagger";
import { errorHandler, notFound } from "./middleware/error";
import { csrfProtection } from "./middleware/csrf";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.CORS_ORIGIN } });

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(csrfProtection);
app.use(compression());
app.use(morgan("combined"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "drrcs-api" }));
app.get("/csrf-token", (_req, res) => res.json({ csrfToken: "stateless-jwt-api" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRouter);
app.use("/api", coreRouter);
app.use(notFound);
app.use(errorHandler);

io.on("connection", (socket) => {
  socket.emit("connected", { message: "DRRCS realtime channel ready" });
});

setInterval(() => {
  io.emit("heartbeat", { at: new Date().toISOString() });
}, 30000);

server.listen(env.PORT, () => {
  console.log(`DRRCS API listening on ${env.PORT}`);
});
