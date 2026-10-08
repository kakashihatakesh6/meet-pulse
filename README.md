# Meeting Alarm ⏰📅

A production-quality **React Native & Expo** mobile application for automated Google Calendar alarms, event synchronization, and Excel/CSV/Google Sheets schedule imports with **100% on-device architecture** (Zero Node.js/Backend Server).

---

## 1. Project Overview

**Meeting Alarm** ensures you never miss an interview, sprint review, or client catchup. It directly communicates with Google APIs using OAuth 2.0 PKCE, persists calendar schedules in an on-device SQLite database, provides flexible spreadsheet imports, and schedules high-priority local device alarms with customizable offsets (e.g., At start time, 5m, 10m, 15m, 30m, 1 hour before).

### Key Features
* 🔐 **Serverless & Private**: Direct Google OAuth 2.0 on-device authentication. OAuth tokens are secured in `Expo SecureStore`; event and alarm data are stored in `Expo SQLite`.
* 📅 **Google Calendar Sync**: Fetches user calendars, resolves recurring/all-day events, detects meeting links (Google Meet, Zoom, MS Teams, Webex), and handles incremental changes via `syncToken`.
* 🔔 **Punctual Local Alarms**: Configurable multi-alarm reminders scheduled directly with `Expo Notifications` (rings reliably even when offline).
* 📊 **Excel, CSV & Google Sheets Import**: Parses `.xlsx`, `.xls`, `.csv` files using SheetJS (`xlsx`) or pulls directly from Google Drive spreadsheets with fuzzy column auto-detection and validation previews.
* ✈️ **Offline Support**: Full dashboard usability, calendar navigation, and alarm reliability without active internet connectivity.
* 🌓 **Dark & Light Mode**: Curated theme styling supporting System, Light, and Dark modes.

---

## 2. Architecture & Data Flow

```text
                                 [ Google Cloud Services ]
                               /            |             \
                   Google OAuth 2.0   Google Calendar   Google Sheets & Drive
                     (Direct PKCE)       (v3 API)             (v4 API)
                              \             |             /
                               \            |            /
================================\===========|===========/===========================
MOBILE CLIENT (100% On-Device)   \          |          /
                                  ▼         ▼         ▼
                              [ Services & Repositories ]
                             /             |             \
                Google OAuth Service   Calendar Sync   Spreadsheet Importer
               (Tokens in SecureStore) (Normalization)    (SheetJS Engine)
                             \             |             /
                              ▼            ▼            ▼
                            [ Local SQLite Database (WAL Mode) ]
                             ├── users
                             ├── calendars
                             ├── meetings
                             ├── alarms
                             ├── settings
                             └── sync_metadata
                                           │
                                           ▼
                            [ Local Notification Service ]
                             ├── Android Notification Channels
                             ├── High-Priority Alarms & Vibration
                             └── Deep Links to Video Meetings
                                           │
                                           ▼
                                [ Presentation Layer ]
                             ├── Expo Router (Tabs & Modals)
                             ├── Zustand State Stores
                             ├── TanStack Query (Caching)
                             └── Theme-Aware UI Components
===================================================================================
```

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native (0.74.x), Expo SDK 51 |
| **Language** | TypeScript (Strict mode) |
| **Routing** | Expo Router v3 (File-based navigation) |
| **Local Database** | Expo SQLite (Async API, WAL Journaling, Migrations) |
| **Secure Storage** | Expo SecureStore (OAuth tokens & user credentials) |
| **Notifications** | Expo Notifications (Local triggers, categories, audio) |
| **File / Spreadsheet Parsing** | SheetJS (`xlsx`), Expo Document Picker, Expo FileSystem |
| **Authentication** | Direct Google OAuth 2.0 PKCE (`expo-auth-session`, `expo-crypto`) |
| **Remote APIs** | Google Calendar API v3, Google Drive API v3, Google Sheets API v4 |
| **State Management** | Zustand |
| **Caching & Sync** | TanStack React Query v5 |
| **Validation** | Zod |
| **Date & Timezone** | `date-fns`, `date-fns-tz` |
| **Testing** | Jest, `jest-expo` |

---

## 4. Installation & Prerequisites

Ensure you have **Node.js (v18+)** and **npm** or **yarn** installed.

```bash
# 1. Clone repository
git clone https://github.com/your-username/meetpulse.git
cd meetpulse

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env
```

---

## 5. Development Commands

```bash
# Start development server
npx expo start

# Run on Android emulator or connected device
npx expo start --android

# Run on iOS simulator (macOS required)
npx expo start --ios

# Run on Web browser for rapid UI testing
npx expo start --web

# Run Expo health check
npx expo doctor

# Run test suite
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 6. Google Cloud Console Setup

To enable direct Google OAuth and Calendar/Sheets access:

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **Meeting Alarm**.
3. Navigate to **APIs & Services > Library** and enable:
   - **Google Calendar API**
   - **Google Drive API** (for spreadsheet selection)
   - **Google Sheets API**
4. Navigate to **APIs & Services > OAuth consent screen**:
   - Choose **External** user type.
   - Fill in App Name: `Meeting Alarm`, Support email, and Developer contact.
   - Under **Scopes**, add:
     - `openid`
     - `.../auth/userinfo.profile`
     - `.../auth/userinfo.email`
     - `.../auth/calendar.readonly`
     - `.../auth/calendar.events.readonly`
     - `.../auth/spreadsheets.readonly`
     - `.../auth/drive.readonly`
   - Add your test Google accounts under **Test users**.
5. Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - **Android Client**:
     - Package name: `com.meetingalarm.app`
     - SHA-1 fingerprint: Obtain via `npx expo credentials:manager` or default debug keystore.
   - **iOS Client**:
     - Bundle ID: `com.meetingalarm.app`
   - **Web Application Client**:
     - Authorized redirect URIs:
       - `https://auth.expo.io/@your-expo-username/meeting-alarm`
       - `http://localhost:8081` (for web development)

---

## 7. Environment Variables Configuration

Populate your `.env` file with the Client IDs created above:

```env
# Google OAuth Public Client IDs
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your_ios_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your_android_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your_web_client_id.apps.googleusercontent.com

# Redirect URI for AuthSession
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=meetingalarm:/oauthredirect

# Defaults
EXPO_PUBLIC_DEFAULT_REMINDER_MINUTES=15
EXPO_PUBLIC_SYNC_INTERVAL_MINUTES=15
EXPO_PUBLIC_APP_ENV=development
```

> **Security Note**: Never include Google Client Secrets in client-side mobile applications. Mobile OAuth uses the Authorization Code flow with PKCE (Proof Key for Code Exchange).

---

## 8. Android & iOS Native Configuration

### Android (`app.json`)
* **Permissions**:
  - `POST_NOTIFICATIONS` (Android 13+)
  - `SCHEDULE_EXACT_ALARM` & `USE_EXACT_ALARM` (Android 12+)
  - `RECEIVE_BOOT_COMPLETED`
  - `VIBRATE`
* **Notification Channels**:
  - `meeting-high-priority-alarms`: Priority `MAX`, custom sound `alarm.wav`, vibration pattern `[0, 250, 250, 250, 500, 250]`, lockscreen visibility `PUBLIC`.

### iOS (`app.json`)
* **Info.plist**:
  - `UIBackgroundModes`: `["fetch", "remote-notification"]`
  - `NSCalendarsUsageDescription`: Calendar event access description.
  - Critical notification and sound permissions enabled.

---

## 9. SQLite Database Architecture

Data is stored locally in `meeting_alarm.db` with Write-Ahead Logging (WAL) enabled:

* `users`: `(id, email, name, given_name, family_name, picture, last_login_at)`
* `calendars`: `(id, google_calendar_id, summary, description, primary_cal, background_color, foreground_color, is_enabled, access_role, timezone, last_synced_at)`
* `meetings`: `(id, google_event_id, calendar_id, title, description, start_time, end_time, timezone, location, meeting_url, platform, organizer_name, organizer_email, attendees, source, status, is_all_day, recurring_event_id, raw_data, created_at, updated_at)`
* `alarms`: `(id, meeting_id, offset_minutes, scheduled_time, notification_id, status, is_enabled, created_at, updated_at)`
* `settings`: Key-value configuration store `(key, value, updated_at)`
* `sync_metadata`: `(calendar_id, sync_token, last_sync_timestamp, status, error_message)`

---

## 10. Background Sync Limitations & Local Reliability

Mobile operating systems (iOS Background App Refresh and Android Doze Mode) restrict background execution intervals. 

To ensure **100% reliable alarms**:
1. **Local Scheduling First**: Whenever a calendar is synced, an Excel file is imported, or a meeting time changes, all alarm notifications are calculated and registered with the operating system's native alarm scheduler ahead of time.
2. **Foreground Synchronization**: The application performs an automatic incremental synchronization whenever the app is opened or focused.
3. **Opportunistic Background Fetch**: An `expo-background-fetch` task is registered with `expo-task-manager` to perform incremental background updates when the OS scheduler allows.

---

## 11. EAS Build Instructions

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log in to Expo account
eas login

# 3. Configure EAS Project
eas project:init

# 4. Build Development Client (Android APK)
eas build --profile development --platform android

# 5. Build Development Client (iOS Simulator or Device)
eas build --profile development --platform ios

# 6. Build Production Bundle
eas build --profile production --platform all
```

---

## 12. Testing

The codebase includes comprehensive unit tests verifying core algorithms:

```bash
npm test
```

### Test Coverage:
- `dates.test.ts`: Time range formatting, relative urgency calculations, countdown labels.
- `timezone.test.ts`: UTC conversion, all-day date bounds, timezone offsets.
- `spreadsheet.parsing.test.ts`: Excel serial dates, 12h/24h time parsing, date formats (`YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MM-YYYY`), duration string extraction, midnight crossing.
- `column.mapping.test.ts`: Fuzzy header auto-detection, row validation diagnostics.
- `meeting.normalization.test.ts`: Google Calendar API item conversion, video link detection (Meet, Zoom, Teams, Webex).
- `alarm.calculation.test.ts`: Offset subtraction, future validation, notification payload construction.

---

## 13. Troubleshooting

| Issue | Resolution |
|---|---|
| **Google Sign-In shows Error 400: redirect_uri_mismatch** | Add `meetingalarm:/oauthredirect` and your Expo AuthSession proxy URL (`https://auth.expo.io/@your-username/meeting-alarm`) to Authorized Redirect URIs in Google Cloud Console. |
| **Notifications not ringing on Android** | Check Android Settings > Apps > Meeting Alarm > Notifications > Enable Alarms and Reminders permission. |
| **Excel date column imported incorrectly** | Ensure the Date column is mapped in the Mapping screen. Meeting Alarm handles Excel serial numbers (e.g. 45558) and standard date strings automatically. |
| **Google sync returns 410 Gone** | Handled automatically: Meeting Alarm invalidates the expired `syncToken` and performs a clean full sync. |
