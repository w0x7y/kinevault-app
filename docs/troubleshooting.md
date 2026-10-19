# Connection troubleshooting

## iPhone connection

For a timeout such as “This is taking much longer than it should”:

```sh
npx expo login
npm run start:tunnel
```

Sign into the same Expo account in Expo Go on the iPhone. Physical iOS devices
check the developer account ([Expo CLI authentication](https://docs.expo.dev/more/expo-cli/#authentication)).
Update Expo Go from the App Store if necessary; this app uses SDK 57.
Scan the new terminal QR with the Camera; pasting `exp://` into a browser search
does not open the app. The tunnel bypasses local Wi-Fi routing and firewall
restrictions. The tunnel address changes between sessions.

For local Wi-Fi, use `npm run start:lan` and allow Expo Go's Local Network access
in iOS Settings. Check whether the server is reachable by opening its printed
`http://<computer-IP>:8081/status` address in Safari. A response of
`packager-status:running` confirms connectivity from the phone.

Run `npm run doctor:connection` to inspect the advertised iOS bundle address,
runtime, available network addresses, and Expo sign-in status. Pass a different
port if necessary: `npm run doctor:connection -- 8082`.

The checked-in tunnel dependency makes the command usable after `npm ci`.
Internet access is needed for tunnel mode.

If ngrok fails with `remote gone away` or `session closed`, use the Cloudflare
fallback. Install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/),
then run `npm run start:cloudflare`. The launcher starts both servers, verifies the
public iOS manifest, and prints a secure `exps://` QR code. Keep the terminal open;
Ctrl+C stops both processes. The address is temporary and changes on each launch.
The QR is also saved at `.expo/connection-qr.svg`. You can pass another port with
`npm run start:cloudflare -- 8083` or set `CLOUDFLARED_BIN` to a custom binary path.

## Android emulator keyboard

If tapping a field shows no keyboard, boot the emulator and run:

```sh
npm run android:keyboard
```

This enables the on-screen keyboard alongside computer keyboard input and turns
off stylus handwriting on Android 14+ emulators. A virtual stylus can put Gboard
in handwriting mode and hide the keypad. Tap the field again after running the
command. These settings persist on the emulator; physical phones are untouched.
The command uses `adb` from your Android SDK or PATH.

