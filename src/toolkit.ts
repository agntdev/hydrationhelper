import { Bot } from "grammy";

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
