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

Illustrations are generated concept art. They are not an approved mascot, logo,
or production app asset. Generation prompts are recorded in
`mascot-assets/prompts.json`; Geist's font license is included alongside the fonts.

The selected direction is **Original creature**, now named **Kine**. The Expo
onboarding uses the same illustration from `assets/mascot/kine.png`.
