# Troubleshooting

## iPhone connection

If Expo Go times out ("This is taking much longer than it should"), use a tunnel. It needs internet access.

```sh
npx expo login
npm run start:tunnel
```

1. Sign in to the same Expo account in Expo Go. Physical iPhones check it ([Expo CLI authentication](https://docs.expo.dev/more/expo-cli/#authentication)).
2. Update Expo Go from the App Store if it doesn't support SDK 58.
3. Scan the new QR code with the Camera app. Pasting `exp://` into a browser doesn't open the app. The address changes every session.

| Command                     | Use                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run start:lan`         | Local Wi-Fi. Allow Expo Go's Local Network access in iOS Settings. Open the printed `http://<computer-IP>:8081/status` in Safari; it should show `packager-status:running`.   |
| `npm run doctor:connection` | Shows the advertised iOS bundle address, runtime, network addresses and Expo sign-in. Pass another port with `-- 8082`.                                                       |
| `npm run start:cloudflare`  | Use when ngrok fails with `remote gone away` or `session closed`. Needs [cloudflared](https://developers.cloudflare.com/tunnel/downloads/). Pass another port with `-- 8083`. |

`start:cloudflare` starts both servers, checks the public iOS manifest and prints an `exps://` QR code, also saved at `.expo/connection-qr.svg`. Keep the terminal open; Ctrl+C stops both. The address changes on each launch. Set `CLOUDFLARED_BIN` to use another cloudflared binary.

## Android emulator keyboard

If tapping a field shows no keyboard, boot the emulator and run:

```sh
npm run android:keyboard
```

Then tap the field again. It turns on the on-screen keyboard and turns off stylus handwriting on Android 14+ emulators. The settings stay on the emulator and never touch physical phones. It uses `adb` from your Android SDK or `PATH`.

## Web preview shows old code

The web dev server can keep serving a stale bundle, so the browser and `npm run test:browser` see old code. Restart it with a cleared cache:

```sh
npx expo start --web --port 8081 --clear
```
