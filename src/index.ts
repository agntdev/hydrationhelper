import { startBot } from "./bot";

startBot().catch((err) => {
  console.error("Fatal bot error:", err);
  process.exit(1);
});
