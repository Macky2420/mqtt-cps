const dotenv = require("dotenv");
const express = require("express");

// Load environment variables FIRST
dotenv.config({ path: ".env.local" });

console.log("Environment loaded. PAYMONGO_SECRETKEY:", process.env.PAYMONGO_SECRETKEY ? "✓ Set" : "✗ Missing");

const app = express();
const PORT = 3001;

app.use(express.json());

// Import API handlers AFTER dotenv is loaded
const topupHandler = require("./api/topup.js");
const verifyHandler = require("./api/verify.js");

// API Routes
app.post("/api/topup", topupHandler);
app.post("/api/verify", verifyHandler);

app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});
