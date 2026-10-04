# Design previews

## Profile layouts

`profile-prototype.html` is a throwaway, standalone comparison of three proposed
Profile layouts. Values and photo placeholders are illustrative. It does not
read or modify app data.

From `Application/`, run:

```sh
python3 -m http.server 8091 --bind 127.0.0.1
```

Open `http://localhost:8091/design/profile-prototype.html` to compare all three.
Use the floating controls or arrow keys to switch layouts. Individual links use
`?variant=A`, `?variant=B`, and `?variant=C`; add `&theme=dark` for dark mode.
The chart metric/range controls, Journal tabs, and photo-comparison viewer are
visual demos. Camera, editing, and logging actions do not change saved data.

## Branding

`branding.html` previews the app's exported launcher icons and splash screens.
It runs independently of the Expo app.

From `Application/`, start a local server with the repository root available so
the preview can load images and the installed Comfortaa font:

```sh
python3 -m http.server 8090
```

Open `http://localhost:8090/design/branding.html`.

The [branding guide](../assets/branding/README.md) records source artwork and
regeneration. The [mascot guide](../assets/mascot/README.md) documents the current
2D page poses, their mappings, and size limits. The app's layouts are documented
in [DESIGN.md](../DESIGN.md).
