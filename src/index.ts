import { createBot } from "./toolkit.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = createBot(token);

bot.command("start", (ctx) => {
  ctx.reply("Welcome to HydrationHelper! Use the buttons below to track your water intake.");
});

bot.command("help", (ctx) => {
  ctx.reply("Commands: /drank <ml> /stats /goal <ml> /reminders on|off /balance");
});

bot.command("drank", (ctx) => {
  ctx.reply("Send me the amount in ml, e.g. /drank 250");
});

bot.command("stats", (ctx) => {
  ctx.reply("Stats coming soon!");
});

bot.command("goal", (ctx) => {
  ctx.reply("Set your daily goal, e.g. /goal 2000");
});

bot.command("reminders", (ctx) => {
  ctx.reply("Reminders: use on or off");
});

bot.command("balance", (ctx) => {
  ctx.reply("Balance coming soon!");
});

bot.callbackQuery(/^log:/, (ctx) => {
  ctx.answerCallbackQuery({ text: "Logging water..." });
  ctx.reply("Logged!");
});

bot.callbackQuery(/^stats:/, (ctx) => {
  ctx.answerCallbackQuery();
  ctx.reply("Stats coming soon!");
});

bot.callbackQuery(/^reminders:/, (ctx) => {
  ctx.answerCallbackQuery({ text: "Toggled reminders" });
});

bot.callbackQuery(/^tz:/, (ctx) => {
  ctx.answerCallbackQuery({ text: "Timezone set" });
});

bot.callbackQuery(/^menu:/, (ctx) => {
  ctx.answerCallbackQuery();
  ctx.reply("Main menu");
});

bot.on("message", (ctx) => {
  ctx.reply("Use /help to see available commands.");
});

bot.start({
  onStart: () => {
    console.log("Bot started, polling for updates...");
  },
});
