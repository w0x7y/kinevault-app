**KineVault Track**

food, workouts, water and steps, with Kine keeping you company

<img width="128" alt="the KineVault Track app icon" src="assets/branding/icon.png" />

the expo companion to [KineVault](https://github.com/arielhagay10-ui/KineVault), for ios and android with a web preview. accounts are shared with KineVault through supabase

**what's in it**

~ **home**: calories left, macros, water, steps and the day's workout\
~ **food**: 5,431 offline usda foods, barcode scanning, custom foods and meals\
~ **exercise**: saved workouts, a live workout timer, and KineVault demo videos\
~ **profile**: weight history, progress photos and streaks\
~ **settings**: reminders, light and dark, export and delete your account

**run it**

needs node 24 (`.nvmrc`). copy `.env.example` to `.env.local` and fill in the supabase url and key, see [supabase setup](docs/supabase-setup.md)

```sh
npm ci
npm start           # scan the qr with expo go (sdk 57)
npm run web         # browser preview
```

phone won't connect, or the emulator has no keyboard? see [troubleshooting](docs/troubleshooting.md)

**install on a phone**

- iphone with a mac: [xcode](docs/ios-xcode.md)
- iphone from linux: [xtool](docs/ios-linux-xtool.md)
- android: [release apk](docs/android-apk.md)

**check**

```sh
npm run check          # lint, format, types and unit tests
npm run test:browser   # playwright, against npm run web -- --port 8081
```

**more**

[architecture](docs/architecture.md) | [terms](CONTEXT.md) | [design](docs/redesign-2026-10.md) | [todo](TODO.md) | [privacy](docs/privacy.md)
