# DESIGN — HydrationHelper

Architecture, command set and conversation flows for the HydrationHelper
Telegram bot. Satisfies every entity, dependency and feature in
`docs/general.md`.

## 1. Architecture

```
Telegram ⇄ grammY bot (long polling)
              │
              ├─ command router  (/start /drank /stats /help)
              ├─ callback router (log:* amount:* day:* week:*)
              ├─ session store   (per-chat, minimal — mostly stateless)
              ├─ service layer   (intake, streaks, $SIP grants, charts)
              ├─ reminder cron   (every 2h between 08:00–20:00 local)
              └─ SQLite persistence (users, water_logs, streaks, sip_grants)
```

- **Runtime**: single Node.js process, grammY, long polling (no inbound ports).
- **State**: per-chat, mostly stateless. Logging is a single inline button or
  one-shot command. Only `/stats` collects a small "which day?" picker.
- **Reminder cron**: a single in-process scheduler that ticks once a minute,
  and on the hour boundary (08:00, 10:00, …, 20:00) fans out a friendly
  nudge to every active user whose `reminders_enabled=true`. Idempotent per
  (user, day, hour) — a `reminders_sent` table guards against double-sends
  on restart.
- **Timezone**: the bot learns each user's offset from Telegram's `language`
  hint on first contact, and stores it on the `users` row (`tz_offset_min`).
  Defaults to `UTC` if unknown. All times stored UTC; reminders are scheduled
  in the user's local frame.

## 2. Data model (implements General "Core Entities")

| Entity | Table | Fields |
| --- | --- | --- |
| **User** | `users` | `tg_id` PK, `name`, `tz_offset_min` (default 0), `daily_goal_ml` (default 2000), `reminders_enabled` (default true), `created_at` |
| **WaterLog** | `water_logs` | `id` PK, `user_tg_id` FK→users, `amount_ml` (integer, > 0), `logged_at` (UTC), `source` (`command`/`button`) |
| **Streak** | `streaks` | `user_tg_id` PK FK→users, `current_days` (integer), `longest_days` (integer), `last_met_date` (the local date the user last hit the goal) |
| **ReminderSchedule** | in code | constant: hours `[8, 10, 12, 14, 16, 18, 20]` — no need for a table; the cron drives it |
| **TokenBalance** | `sip_grants` | `id` PK, `user_tg_id` FK→users, `amount` (integer, $SIP base units), `reason` (`streak_3`/`streak_7`/`streak_30`/…), `granted_at`. Balance = `SUM(amount)`. |
| **Chart** | generated on the fly | aggregation over `water_logs` for the trailing 7 local days, rendered as a PNG via a tiny chart lib (e.g. `chartjs-node-canvas`) and sent as a photo |

Relationships preserved exactly as General states: user 1—N water_logs,
user 1—1 streak, user 1—N sip_grants, user 1—1 chart (computed).

## 3. Command set

| Command | Purpose |
| --- | --- |
| `/start` | register user, ask timezone (button: "Use my Telegram timezone" / "UTC" / custom offset), show main menu |
| `/help` | command reference |
| `/drank <ml>` | log a drink (e.g. `/drank 250`) — quick path |
| `/stats` | show the 7-day chart + streak + token balance |
| `/goal <ml>` | set the daily hydration goal (default 2000 ml, allowed 500–6000) |
| `/reminders on` / `/reminders off` | toggle the 2-hourly nudge |
| `/balance` | show $SIP earned and a short history of grants |

Inline button actions (no slash command):

| Button label | CB data | Effect |
| --- | --- | --- |
| `💧 250 ml` | `log:250` | log 250 ml right now |
| `💧 500 ml` | `log:500` | log 500 ml right now |
| `🥤 Custom…` | `log:custom` | text-step: ask the amount (1–2000 ml) |
| `📊 Stats` | `stats:open` | same as `/stats` |
| `🔔 Reminders` | `reminders:toggle` | flip the flag, update message |

## 4. Conversation / UX flows

### 4.1 Onboarding (`/start`)
1. Upsert `users` row by `tg_id`.
2. First contact: ask timezone with three inline buttons:
   `📍 Use Telegram TZ` (CB `tz:auto`), `🌍 UTC` (CB `tz:utc`),
   `⌨ Custom…` (CB `tz:custom` → text step `±HH:MM`).
3. Show the main menu:
   `💧 250 ml` `💧 500 ml` `🥤 Custom…` `📊 Stats` `🔔 Reminders: ON/OFF`.
4. Send a friendly one-time message: "I'll nudge you every 2 hours between
   08:00 and 20:00. /reminders off to silence."

### 4.2 Logging a drink
- **Quick path** — `/drank 250` or button `💧 250 ml`: insert `water_logs`
  row, run the daily-total recompute (see §4.4), reply
  "Logged 250 ml — today: 1750 / 2000 ml (88%) 💧". If today's total
  crosses `daily_goal_ml` for the first time, fire the streak update
  (§4.5) and reply an extra "🎉 Goal hit! Streak: N days · +N $SIP".
- **Custom** — `🥤 Custom…` button: state `awaiting_amount`; next text in
  this chat is parsed as an integer 1–2000; on valid input → same as quick
  path. Anything else → "Send a number 1–2000, or /cancel".

### 4.3 Reminders (System)
A scheduler ticks every 60s. On the local-time boundary hours `[8, 10, 12,
14, 16, 18, 20]`:
- For every user with `reminders_enabled=true` and no row in `reminders_sent`
  for `(user_tg_id, local_date, hour)`: send "💧 Time for a sip! Tap to log:"
  with `💧 250 ml` / `💧 500 ml` / `🥤 Custom…` buttons.
- Insert the `reminders_sent` row **first** (claim), then send, so a crash
  between claim and send can be retried on the next tick without
  double-messaging.

A user who logs in the same hour short-circuits the next reminder for that
hour (it still gets sent once — the nudge is the point — but the reply
after the log includes the progress card).

### 4.4 Daily totals & goal hit
After every insert/update in `water_logs` for a user, recompute today's
local total. If it has just crossed `daily_goal_ml` from below (within
the last 5 minutes) → fire §4.5.

### 4.5 Streak & $SIP grant
- `last_met_date` is the most recent local date the user hit the goal.
- On a new goal-hit, set `current_days = (today - last_met_date) days` and
  bump `longest_days` if needed.
- $SIP grants (configurable, defaults listed):
  - 3-day streak: +10 $SIP
  - 7-day streak: +30 $SIP
  - 14-day streak: +75 $SIP
  - 30-day streak: +200 $SIP
  - Each milestone fires once; idempotent via
    `(user_tg_id, reason, streak_length)`.
- The user is notified in the same message: "🎉 Goal hit! Streak: N days ·
  +X $SIP".

### 4.6 Stats (`/stats`)
- Generate a 7-day bar chart of `SUM(amount_ml) per local day` for the
  trailing week, with a horizontal line at `daily_goal_ml`.
- Caption: `Streak: N days (best: M) · Today: 1750/2000 ml (88%) · $SIP
  balance: B`.
- Send as a photo with `🏠 Меню` button.

### 4.7 Goal (`/goal <ml>`)
- Reject anything outside 500–6000 with a clear error and re-prompt.
- Persist; reply "New goal: <ml> ml/day".

### 4.8 Reminders toggle
- `/reminders on|off` or the inline button: flip the flag, reply
  "Reminders: ON (every 2h, 08:00–20:00)" / "Reminders: OFF".

### 4.9 Balance (`/balance`)
- `SUM(amount)` from `sip_grants` for the user, plus the last 5 grants:
  `+10 $SIP · 3-day streak · 2026-06-12`.
- Footer: "Stay hydrated! 💧"

### 4.10 Fallbacks
- Unknown command → "Try /help — quick buttons: /drank 250 or /stats".
- Out-of-range custom amount → re-ask with the valid range.
- Any handler error → log + "Something went wrong, try again" + main menu;
  the update loop never crashes on a single update.

## 5. Edge cases & rules

- **Timezone** — the entire reminder + streak + day-boundary logic uses the
  user's `tz_offset_min`. DST shifts don't move the schedule (the offset is
  fixed at onboarding); a future enhancement could refresh it from Telegram.
- **Double-fire on restart** — `reminders_sent` rows prevent it.
- **Logging in the past** — the `logged_at` field is the moment of the
  message, not the moment the user actually drank; we don't accept
  back-dated entries.
- **Goal hit race** — two near-simultaneous logs on the same day both
  recompute; the second one sees the goal already met and skips the streak
  fire (idempotent via the 5-minute "just crossed" window).
- **Streak reset** — if `today - last_met_date > 1` (i.e. a full day was
  missed), `current_days` resets to 0; the next goal-hit starts a new
  streak at 1.
- **$SIP supply** — no cap configured in v1; grants are off-chain points
  (a future task wires real $SIP minting).

## 6. External dependencies (mirrors General)

- **Telegram Bot API** via grammY — long polling, inline keyboards,
  callback queries, bot-initiated scheduled messages.
- **Database** — SQLite (users, water_logs, streaks, sip_grants,
  reminders_sent).
- **Charting library** — `chartjs-node-canvas` (or any pure-Node chart lib
  that emits a PNG buffer). No external service.
- **No third-party APIs** for v1. Timezone is inferred from Telegram's
  `language` code if possible; otherwise a one-time user prompt.

## 7. Non-goals (inherited from General)

No wearable/health-app integration, no family/group tracking, no
notifications on goal hit beyond the streak message, no marketplace/trading
of $SIP, no customizable reminder cadence (fixed at every 2h, 08:00–20:00),
no customizable goals beyond the 500–6000 ml range.

## 8. Feature → design traceability

| General feature | Design section |
| --- | --- |
| `/drank <ml>` quick log | 4.2 |
| Inline-button log | 3, 4.2 |
| Reminder every 2h, 08:00–20:00 | 2, 4.3 |
| Weekly chart on `/stats` | 2, 4.6 |
| Streak tracking | 2, 4.5 |
| $SIP rewards | 2, 4.5, 4.9 |
| Multi-user support | 2, 4.3 fan-out |
| Persistent data | 2 (every table) |
| Display streaks | 4.5, 4.6 |
