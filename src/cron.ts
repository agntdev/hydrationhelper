import { Bot, InlineKeyboard } from "grammy";
import type { Database } from "sql.js";

const REMINDER_HOURS = new Set([8, 10, 12, 14, 16, 18, 20]);
const TICK_MS = 60_000;

export function startReminderScheduler(db: Database, bot: Bot): () => void {
  function toLocalDate(utcNow: Date, offsetMin: number): string {
    const localMs = utcNow.getTime() + offsetMin * 60_000;
    const d = new Date(localMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function localHour(utcNow: Date, offsetMin: number): number {
    const localMs = utcNow.getTime() + offsetMin * 60_000;
    return new Date(localMs).getUTCHours();
  }

  const reminderKeyboard = new InlineKeyboard()
    .text("💧 250 ml", "log:250")
    .text("💧 500 ml", "log:500")
    .text("🥤 Custom…", "log:custom");

  async function tick() {
    try {
      const now = new Date();

      const results = db.exec(
        "SELECT tg_id, tz_offset_min FROM users WHERE reminders_enabled = 1",
      );
      if (!results.length) return;

      const { values } = results[0];

      for (const row of values) {
        const tg_id = row[0] as number;
        const tz_offset_min = row[1] as number;

        const hour = localHour(now, tz_offset_min);
        if (!REMINDER_HOURS.has(hour)) continue;

        const localDate = toLocalDate(now, tz_offset_min);

        const isSent = db.exec(
          "SELECT 1 FROM reminders_sent WHERE user_tg_id = ? AND local_date = ? AND hour = ?",
          [tg_id, localDate, hour],
        );
        if (isSent.length && isSent[0].values.length) continue;

        db.run(
          "INSERT OR IGNORE INTO reminders_sent (user_tg_id, local_date, hour) VALUES (?, ?, ?)",
          [tg_id, localDate, hour],
        );

        bot.api.sendMessage(tg_id, "💧 Time for a sip! Tap to log:", {
          reply_markup: reminderKeyboard,
        }).catch(() => {
          /* delivery failure is not fatal */
        });
      }
    } catch (err) {
      console.error("Reminder scheduler tick error:", err);
    }
  }

  const timer = setInterval(tick, TICK_MS);
  tick();

  return () => clearInterval(timer);
}
