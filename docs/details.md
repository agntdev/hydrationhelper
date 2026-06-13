# DETAILS: HydrationHelper Implementation Specification (Revised)

## SCREENS

### 1. Onboarding (Initial)
- **Trigger**: `/start` (first-time user)
- **Message**: 
  ```
  Welcome! Let's set up your hydration tracker.
  Please select your timezone:
  ```
- **Keyboard**: 
  ```markdown
  [📍 Use Telegram TZ] [🌍 UTC] [⌨ Custom…]
  ```
- **Transitions**:
  - `tz:auto` → set user's timezone from Telegram → show main menu with one-time nudge
  - `tz:utc` → set UTC → show main menu with one-time nudge
  - `tz:custom` → prompt for `±HH:MM` input (e.g., +03:00) → validate → update user record

### 2. Main Menu (Default)
- **Trigger**: Shown after onboarding, or `/start` (existing user)
- **Message**: 
  ```
  💧 Hydration Tracker
  Today: {current_ml}/{goal_ml} ml ({percent}%)
  I'll nudge you every 2 hours between 08:00 and 20:00. /reminders off to silence.
  ```
- **Keyboard**: 
  ```markdown
  [💧 250 ml] [💧 500 ml] [🥤 Custom…] [📊 Stats] [🔔 Reminders: ON/OFF]
  ```
- **Transitions**:
  - `log:250` → log 250ml → update totals → show progress message
  - `log:500` → log 500ml → update totals → show progress message
  - `log:custom` → prompt for amount (1-2000ml)
  - `stats:open` → show stats screen
  - `reminders:toggle` → flip `reminders_enabled` flag → update button state
  - `/reminders on` → enable reminders → update button state
  - `/reminders off` → disable reminders → update button state

### 3. Custom Log Input
- **Trigger**: `🥤 Custom…` button
- **Message**: 
  ```
  Enter amount (1–2000 ml):
  ```
- **Keyboard**: 
  ```markdown
  [Cancel]
  ```
- **Transitions**:
  - Valid number → log amount → return to main menu with progress
  - Invalid → error message "Please enter a number between 1 and 2000" → re-prompt
  - `/cancel` → return to main menu

### 4. Stats Screen
- **Trigger**: `/stats` or `📊 Stats` button
- **Message**: 
  ```
  📊 Weekly Hydration
  [Bar chart showing 7-day intake vs goal]
  Streak: {current_days} days (Best: {longest_days})
  Today: {today_ml}/{goal_ml} ml ({percent}%)
  $SIP Balance: {balance}
  ```
- **Keyboard**: 
  ```markdown
  [🏠 Меню]
  ```
- **Transitions**:
  - `🏠 Меню` → return to main menu

### 5. Help Screen
- **Trigger**: `/help`
- **Message**: 
  ```
  📚 Available Commands:
  /drank <ml> - Log water intake
  /stats - View weekly chart
  /goal <ml> - Set daily goal (500–6000)
  /reminders on/off - Toggle reminders
  /balance - Show $SIP balance
  Use the buttons below for quick actions.
  ```
- **Keyboard**: 
  ```markdown
  [💧 250 ml] [🏠 Меню]
  ```
- **Transitions**:
  - `log:250` → log 250ml → return to main menu
  - `🏠 Меню` → return to main menu

### 6. Goal Setting
- **Trigger**: `/goal <ml>` or inline command
- **Message**: 
  ```
  New goal: {ml} ml/day
  ```
- **Keyboard**: 
  ```markdown
  [🏠 Меню]
  ```
- **Transitions**:
  - Invalid ML → error message "Goal must be between 500 and 6000 ml" → re-prompt
  - Valid ML → update `daily_goal_ml` → return to main menu

### 7. Balance Screen
- **Trigger**: `/balance`
- **Message**: 
  ```
  $SIP Balance: {total}
  Recent Grants:
  - {grant1}
  - {grant2}
  - ...
  ```
- **Keyboard**: 
  ```markdown
  [🏠 Меню]
  ```
- **Transitions**:
  - `🏠 Меню` → return to main menu

### 8. Error Handling
- **Trigger**: Unknown command, invalid input
- **Message**: 
  ```
  Try /help or use the buttons above.
  ```
- **Keyboard**: 
  ```markdown
  [💧 250 ml] [📊 Stats]
  ```
- **Transitions**:
  - Any valid input → transition to appropriate screen

---

## COMPONENTS

### Inline Button Group: Log Buttons
- **Structure**: 
  ```markdown
  [💧 250 ml] [💧 500 ml] [🥤 Custom…]
  ```
- **Callbacks**: `log:250`, `log:500`, `log:custom`
- **Usage**: Main Menu, Reminder Messages

### Main Menu Buttons
- **Structure**: 
  ```markdown
  [📊 Stats] [🔔 Reminders: ON/OFF]
  ```
- **Callbacks**: `stats:open`, `reminders:toggle`

### Stats Chart Component
- **Generated**: Dynamically via Chart.js (bar chart)
- **Data**: Aggregation of `water_logs` for last 7 days
- **Annotations**: Goal line, today's progress, streak count

### Reminder Toggle Button
- **Dynamic Label**: "Reminders: ON" / "Reminders: OFF"
- **Callback**: `reminders:toggle`

---

## TRANSITIONS

| State | Input/Callback | Next State | Side Effects |
|-------|----------------|------------|--------------|
| Main Menu | `log:250` | Main Menu | Insert `water_logs`, update totals, check goal |
| Main Menu | `log:500` | Main Menu | Insert `water_logs`, update totals, check goal |
| Main Menu | `log:custom` | Custom Log Input | Await user input |
| Main Menu | `stats:open` | Stats Screen | Generate chart |
| Main Menu | `reminders:toggle` | Main Menu | Flip `reminders_enabled` |
| Main Menu | `/reminders on` | Main Menu | Set `reminders_enabled=true` |
| Main Menu | `/reminders off` | Main Menu | Set `reminders_enabled=false` |
| Custom Log Input | Valid ML | Main Menu | Insert `water_logs`, update totals |
| Custom Log Input | `/cancel` | Main Menu | Cancel input |
| Reminder Schedule | Hourly tick (08:00–20:00) | Reminder Message | Send if `reminders_enabled` |
| Any State | `/help` | Help Screen | Show command reference |
| Any State | `/balance` | Balance Screen | Fetch and display $SIP balance |

---

## DATA MODEL

### Tables

#### `users`
| Field | Type | Notes |
|-------|------|-------|
| `tg_id` | INTEGER | Primary Key |
| `name` | TEXT | From Telegram |
| `tz_offset_min` | INTEGER | Default 0 |
| `daily_goal_ml` | INTEGER | Default 2000 (500–6000) |
| `reminders_enabled` | BOOLEAN | Default TRUE |
| `created_at` | DATETIME | UTC timestamp |

#### `water_logs`
| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER | Primary Key |
| `user_tg_id` | INTEGER | Foreign Key to `users` |
| `amount_ml` | INTEGER | >0 |
| `logged_at` | DATETIME | UTC timestamp |
| `source` | TEXT | `command`/`button` |

#### `streaks`
| Field | Type | Notes |
|-------|------|-------|
| `user_tg_id` | INTEGER | Foreign Key to `users` |
| `current_days` | INTEGER | Current streak |
| `longest_days` | INTEGER | Best streak |
| `last_met_date` | DATE | Last goal met date |

#### `sip_grants`
| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER | Primary Key |
| `user_tg_id` | INTEGER | Foreign Key to `users` |
| `amount` | INTEGER | $SIP units |
| `reason` | TEXT | `streak_3`, `streak_7`, etc. |
| `granted_at` | DATETIME | UTC timestamp |

#### `reminders_sent`
| Field | Type | Notes |
|-------|------|-------|
| `user_tg_id` | INTEGER | Foreign Key to `users` |
| `local_date` | DATE | User's local date |
| `hour` | INTEGER | 8–20 |

---

## ACCEPTANCE NOTES

1. **Reminder Logic**:
   - Sent every 2h between 08:00–20:00 in user's local time.
   - Prevents double-sends via `reminders_sent` table.
   - Includes log buttons in reminder message.

2. **Streak Calculation**:
   - Streak resets if a day passes without meeting the goal.
   - Streak milestones (3/7/14/30 days) grant $SIP tokens.
   - Tokens are granted only once per milestone.

3. **Stats Chart**:
   - Aggregates total intake per day for last 7 days.
   - Displays goal line and today's progress.
   - Generated as PNG via Chart.js.

4. **Timezone Handling**:
   - User's timezone is fixed at onboarding.
   - All internal times stored in UTC.
   - Local time used for streak/day calculations.

5. **Error Handling**:
   - Invalid inputs (e.g., ML out of range) show error and re-prompt.
   - All errors log to console and show generic user message.

6. **$SIP Rewards**:
   - Tokens are off-chain in v1 (no blockchain).
   - Balance is sum of `sip_grants.amount`.
   - Grants are idempotent per user and milestone.

7. **/help Command**:
   - Lists all available commands with brief descriptions.
   - Provides quick access to 250ml log button.

8. **/reminders Commands**:
   - Both `/reminders on` and `/reminders off` toggle the flag.
   - Inline button and slash commands are functionally equivalent.