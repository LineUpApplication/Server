import app from "./server.js";
import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});

// Add graceful shutdown
process.on("SIGTERM", () => {
  server.close();
});

process.on("SIGINT", () => {
  server.close();
});
