# Branding preview

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
