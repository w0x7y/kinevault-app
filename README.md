# KineVault Track

Track food, workouts, water and steps on your phone, with Kine keeping you company.

![Expo](https://img.shields.io/badge/Expo-SDK_58-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgray)

The companion app to [KineVault](https://github.com/arielhagay10-ui/KineVault). Accounts are shared with KineVault through Supabase.

## What's in it

| Tab      | What it does                                                                                |
| -------- | ------------------------------------------------------------------------------------------- |
| Home     | Calories left, macros, water, steps and the day's workout                                   |
| Food     | 5,431 offline USDA foods, barcode scanning, custom foods and meals                          |
| Exercise | Saved workouts, a live workout with a rest timer, personal records and demo videos          |
| Profile  | Weight history, body measurements, progress photos and streaks                              |
| Settings | Reminders, health saving, light and dark mode, the app tour, export and delete your account |

## Install

**Android:** build a signed APK with the `Android release build` workflow. See [Android APK](docs/android-apk.md).

**iPhone:** build it with [Xcode on a Mac](docs/ios-xcode.md), or [from Linux with xtool](docs/ios-linux-xtool.md).

**Web:** deploy the web export to a free `vercel.app` address. See [web deploy](docs/web-deploy.md).

## Development

It needs Node 24. Copy `.env.example` to `.env.local` and fill in the Supabase URL and key ([Supabase setup](docs/supabase-setup.md)).

```
npm ci
npm start      # scan the QR code with Expo Go for SDK 58
npm run web    # browser preview
```

| Command                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `npm run check`        | Lint, format, types and unit tests                  |
| `npm run test:browser` | Browser tests, against `npm run web -- --port 8081` |
| `npm run export:web`   | Static web export in `dist`, which Vercel deploys   |

If the phone won't connect, see [troubleshooting](docs/troubleshooting.md).

More: [architecture](docs/architecture.md), [terms](CONTEXT.md), [to do](TODO.md), [privacy](docs/privacy.md).
