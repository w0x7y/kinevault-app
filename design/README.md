# Mascot exploration

Open `mascots.html` in a browser to compare all eight concepts for KineVault and
KineVault Track. No build or internet connection is required. Keep the
`mascot-assets/` folder next to the HTML file.

The page includes a temporary shortlist, a shortlist-only comparison, expandable
notes for both products, and System/Light/Dark appearance. Selections reset when
the page reloads. No information is sent anywhere.

For a served preview, run from `Application/`:

```sh
python3 -m http.server 8090 --directory design
```

Then open `http://localhost:8090/mascots.html`.

The comparison illustrations are generated concept art, not runtime app assets.
The selected Original creature direction became Kine; the app now uses separate
flat 2D page poses and exported launcher/splash branding. Generation prompts
are recorded in
`mascot-assets/prompts.json`; Geist's font license is included alongside the fonts.

The historical selected illustration remains in `mascot-assets/original-v2.png`.
The Expo app imports `../assets/mascot/2d/kine-*.webp`; age reuses the body pose,
and Home uses the internally named `kine-today.webp`. See the
[mascot guide](../assets/mascot/README.md) for mappings and size limits.
Geist belongs to this standalone comparison; the app uses Comfortaa and
Font Awesome 6.

`branding.html` previews the actual exported launcher and splash assets. Using
the same server, open `http://localhost:8090/branding.html`. The
[branding guide](../assets/branding/README.md) records source and regeneration.
Neither comparison page is an app route or a logging interface.

The app's final layout is documented in [DESIGN.md](../DESIGN.md): 12px structural
spacing, a shared 7-column / 5-row calendar, and equal content/Kine columns on
Home, Food, Exercise, and Settings. Home uses a calorie bar and inline macro
counts; daily records remain empty and creation/view buttons are placeholders.
The supplied studio reference in that guide belongs to the separate
[KineVault repository](https://github.com/arielhagay10-ui/KineVault).
