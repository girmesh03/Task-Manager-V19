// backend/server.js
import http from "http";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import app from "./app.js";

// Configure dayjs with UTC and timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Set server timezone to UTC
process.env.TZ = "UTC";

let PORT = parseInt(process.env.PORT || "4000", 10);

const server = http.createServer(app);

// Validate required environment variables
const validateEnvironment = () => {
  const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  console.log("✅ Environment variables validated");
};

const startServer = async () => {
  try {
    // Validate environment
    validateEnvironment();

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`⚙️  Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📅 Server Time: ${new Date().toISOString()}`);
    });
  } catch (err) {
    console.error("🚨 Server startup failed:", err.message);
    // Don't exit process on startup failure, let the retry mechanism handle it
    console.log("Attempting to recover from startup failure...");
  }
};

startServer();
