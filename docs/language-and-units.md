# Language and units

The interface is English and metric only, by choice (2026-10-08). Settings has no language or unit picker.

Open Food Facts may return a product name in another language, such as Hebrew. Keep that fallback, so a product with no English name can still be imported. Don't infer the interface language from a product's language.

Hebrew support, when it comes, needs extracted message keys, translations, locale-aware numbers and dates, and right-to-left layout, tested on real devices.

Imperial units, when they come, should convert only at display and input. Saved values stay in grams, kilograms, centimeters and milliliters.
