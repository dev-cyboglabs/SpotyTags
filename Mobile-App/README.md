# SpotyTags Staff — React Native (Expo) App

A **native** Android/iOS app for hotel staff (housekeeping, technicians, reception),
porting the web dashboard's `/mobile` experience 1:1 to real native primitives.
Built with **Expo SDK 56 / React Native 0.85 / React Navigation 7**.

> This is a separate app from the web dashboard (`/app/frontend`). It talks to the
> same FastAPI backend over the LAN or cloud using **Bearer JWT** auth.

## Screens (ported from `frontend/src/pages/Mobile.jsx`)

| Screen | File | Notes |
| --- | --- | --- |
| Setup | `SetupScreen.js` | First-launch server URL chooser (LAN/cloud) |
| Login | `LoginScreen.js` | Staff sign-in, Bearer token persisted in SecureStore |
| Today (Home) | `HomeScreen.js` | KPIs, quick actions, workflows, recent activity |
| Menu | `MenuScreen.js` | Full role-aware workflow index |
| Scan & assign | `ScanScreen.js` | **`expo-camera` QR scan** → room → product → assign |
| Add tag | `AddTagScreen.js` | 3-step wizard + license quota guard |
| Add gateway | `AddGatewayScreen.js` | 3-step wizard + ESP32 diagnostics |
| Tasks | `TasksScreen.js` | Tamper / low-battery / not-seen, restock inline |
| Report | `ReportScreen.js` | Damaged / missing / issue reporting |
| Gateway diagnostics | `GatewayDiagScreen.js` | Per-gateway health snapshot |
| Sync status | `SyncScreen.js` | Cloud queue + manual sync trigger |
| Profile | `ProfileScreen.js` | Account details + sign out |
| Restock room | `RestockRoomScreen.js` | Per-room minibar checklist |

## Configuration

The backend URL comes from `.env`:

```
EXPO_PUBLIC_BACKEND_URL=https://staff-app-preview.preview.emergentagent.com
```

Staff can override it at runtime via the **Setup** screen (gear icon on Login).
The chosen URL + the JWT are persisted with `expo-secure-store`.

## Run on a phone (instant, no build)

```bash
cd /app/SpotyTags-staff-app
yarn install            # already installed in this repo
npx expo start --tunnel # scan the QR with the Expo Go app
```

## Build a signed APK / AAB (EAS)

```bash
npm i -g eas-cli
eas login
eas build --platform android --profile preview      # internal APK
eas build --platform android --profile production    # Play Store AAB
eas build --platform ios --profile production        # App Store (needs Apple account)
```

Build profiles live in `eas.json`.

## Design tokens

Ported verbatim from the web `index.css` "MOBILE DARK SYSTEM" (see `src/theme.js`):
background `#0A0A0A`, surface `#141414`, border `#232323`, text `#F5F0E5`,
brand `#FF7E6B`, success `#5BC97E`, cream CTA `#F5F0E5`.

## Auth

`POST /api/auth/login` returns `access_token` (12-hour TTL — covers a staff shift).
The app stores it in SecureStore and sends `Authorization: Bearer <token>` on every
request. On a 401 the user is returned to the Login screen.

## Test credentials

See `/app/memory/test_credentials.md`. e.g. `admin@spotytags.com` / `Admin@123`.


