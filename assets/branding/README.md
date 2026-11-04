# Kine app branding

Launcher icons and splash screens. The icon is a close-up of Kine's face. The iOS splash is the waving Kine with a "KineVault" wordmark in Comfortaa 700. In-app poses are in the [mascot guide](../mascot/README.md).

## Assets

| File                      | Use                                                               |
| ------------------------- | ----------------------------------------------------------------- |
| `icon.png`                | Opaque 1024px iOS icon and Android legacy icon; the OS rounds it  |
| `adaptive-foreground.png` | Transparent 1024px Android foreground with a mask-safe inset      |
| `adaptive-monochrome.png` | Android themed icon; eyes and smile are transparent cutouts       |
| `notification-icon.png`   | 96px white Android notification icon; the head fills 84px         |
| `favicon.png`             | 48px web favicon                                                  |
| `splash-light.png`        | Transparent 720px square iOS splash with a navy wordmark          |
| `splash-dark.png`         | The same with a cream wordmark for dark mode                      |
| `splash-android.png`      | Transparent 720px head mark for Android's square launch container |

[app.json](../../app.json) wires them up.

| Setting                     | Value                                         |
| --------------------------- | --------------------------------------------- |
| Splash background           | `#eef2f6` light, `#10161c` dark (page colors) |
| Notification tint           | `#3a6a96` (Kine blue)                         |
| Android adaptive background | `#f8f2e3` (cream)                             |
| Adaptive head               | 580px box, inside the 626px safe circle       |

All three splash files are square to match Expo's native image view. Android gets a head mark instead of the wordmark, which its launch container would clip.

## Regenerate

`source/` holds the two generated source PNGs; `prompts.json` has their prompts. The waving Kine comes from `../mascot/2d/source/kine-welcome.png`. Install ImageMagick, then run from `Application/` after `npm ci`:

```sh
node scripts/export-branding.mjs
```

It only resizes and exports the PNGs in this folder. To preview them, see [design previews](../../design/README.md).

Icon and splash changes need a new native build. Expo Go can't show the native splash, so check it in an installed release build. The [startup code](../../src/app/_layout.tsx) holds the splash until theme and profile load and the fonts (Comfortaa, Manrope, Font Awesome 6, Ionicons) load or fail.

References: [Expo SDK 57 splash screen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/), [icons and splash guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
