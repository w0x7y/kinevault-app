# Design previews

Standalone HTML previews. They don't read or change app data. Run the servers from `Application/`.

## Profile layouts

`profile-prototype.html` compares three Profile layouts. Version 3, Personal journal, is the chosen one and opens by default. Values and photos are placeholders. It predates the October 2026 redesign and later Profile changes, so its colors, icons, bottom bar, Edit profile and comparison controls are out of date.

```sh
python3 -m http.server 8091 --bind 127.0.0.1
```

Open `http://localhost:8091/design/profile-prototype.html`.

| Query          | Shows                     |
| -------------- | ------------------------- |
| `?variant=all` | All three layouts         |
| `?variant=A`   | One layout: `A`, `B`, `C` |
| `&theme=dark`  | Dark mode                 |

Floating controls or the arrow keys switch layouts. Charts, Journal tabs and the photo viewer are visual demos.

## Plus paywall

`paywall-prototype.html` shows KineVault Plus: the paywall sheet, locked controls and views, Settings plan rows and the after-purchase state. Prices ($4.99 a month, $34.99 a year with a 7-day trial) and values are placeholders, and nothing is wired to billing.

```sh
python3 -m http.server 8092 --bind 127.0.0.1
```

Open `http://localhost:8092/design/paywall-prototype.html`. The buttons above each phone switch its state; Dark mode and Android copy apply to all of them.

## Branding

`branding.html` previews the exported launcher icons and splash screens on the splash colors from `app.json`. Serving from `Application/` lets it load the images and the installed Comfortaa font.

```sh
python3 -m http.server 8090
```

Open `http://localhost:8090/design/branding.html`.

More: [branding guide](../assets/branding/README.md), [mascot guide](../assets/mascot/README.md), [DESIGN.md](../DESIGN.md).
