import { Bot } from "grammy";

export const bot = new Bot(process.env.BOT_TOKEN!);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

bot.callbackQuery(/.*/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.callbackQuery.message) return;
  await ctx.reply("Unknown button action. Try /help.");
});

export async function startBot(): Promise<void> {
  await bot.start({
    drop_pending_updates: true,
  });
}
