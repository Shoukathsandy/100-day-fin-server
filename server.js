import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connect, disconnect, isConnected } from "./db.js";

import customers from "./routes/customers.js";
import loans from "./routes/loans.js";
import entries from "./routes/entries.js";
import dashboard from "./routes/dashboard.js";

dotenv.config();

const app = express();

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "https://69bd413a614b0026ebe23932--100-day-fin.netlify.app"
]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", app: "100 Days Finance Pro API", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", db: isConnected() ? "connected" : "disconnected" });
});

function requireDb(req, res, next) {
  if (!isConnected()) {
    return res.status(503).json({ status: "error", message: "Database not connected" });
  }
  return next();
}

app.use("/api", requireDb);
app.use("/api/customers", customers);
app.use("/api/loans", loans);
app.use("/api/entries", entries);
app.use("/api/dashboard", dashboard);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ status: "error", message });
});

const PORT = process.env.PORT || 8000;

async function connectWithRetry() {
  try {
    await connect();
  } catch (err) {
    console.error("MongoDB connection failed. Retrying in 10s...");
    setTimeout(connectWithRetry, 10000);
  }
}

async function start() {
  connectWithRetry();
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
    console.log(`API Health: http://localhost:${PORT}/health`);
  });
}

start();

process.on("SIGINT", async () => {
  await disconnect();
  process.exit(0);
});
