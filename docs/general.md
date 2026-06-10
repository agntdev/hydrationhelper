# GENERAL Design Document: Water Intake Tracker Bot

## Summary
This Telegram bot helps users track their daily water intake and stay hydrated. It sends friendly reminders every 2 hours between 8am and 8pm. Users can log their water consumption by sending `/drank 250` or using an inline button. The bot displays a weekly chart of their progress via `/stats` and rewards streaks with a custom token called $SIP. It is designed for individuals who want to maintain a healthy hydration routine.

## Core Entities
- **User**: A Telegram user interacting with the bot. Each user has a unique ID.
- **WaterLog**: A record of a user's water intake, including the amount (in ml) and timestamp.
- **Streak**: A count of consecutive days a user has met or exceeded their hydration goal.
- **ReminderSchedule**: The bot's internal schedule for sending hydration reminders (every 2 hours between 8am and 8pm).
- **TokenBalance**: The number of $SIP tokens a user has earned based on their streaks.
- **Chart**: A weekly summary of a user's water intake, displayed as a chart when `/stats` is used.

## Relationships
- A **User** has many **WaterLogs**.
- A **User** has one **Streak** and one **TokenBalance**.
- A **User** can request a **Chart** via `/stats`.
- **ReminderSchedule** is global and applies to all users.

## External Dependencies
- **Telegram Bot API**:
  - Sending messages and inline buttons.
  - Receiving commands and inline button clicks.
  - Getting user IDs and message timestamps.
- **Database**:
  - Persisting **User**, **WaterLog**, **Streak**, **TokenBalance**, and **Chart** data.
- **Charting Library** (e.g., Chart.js or similar):
  - Generating the weekly chart for `/stats`.

## Features
- Users can log water intake with `/drank <amount>` (e.g., `/drank 250`).
- Users can log water intake via an inline button.
- The bot sends a friendly reminder every 2 hours between 8am and 8pm.
- Users can view a weekly chart of their water intake with `/stats`.
- The bot tracks and displays streaks of consecutive days met or exceeded.
- Users earn $SIP tokens for streaks.
- The bot persists all user data (logs, streaks, token balances).
- The bot supports multiple users simultaneously.

## Non-Goals
- Integration with wearable devices or health apps.
- Multi-user tracking for families or groups.
- Advanced analytics beyond the weekly chart.
- Real-time notifications for hydration goals.
- Marketplace or trading of $SIP tokens.
- Customizable reminder intervals or hydration goals.