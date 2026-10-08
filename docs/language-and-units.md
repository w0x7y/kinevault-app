# Language and measurement formats

The current interface is English and uses metric measurements. The user chose
to keep that scope on October 8, 2026. Settings identifies these as the supported
formats; it does not offer a language or unit selector.

Open Food Facts can return a product's original name in another language,
including Hebrew. Source product names are user-reviewable food data, not an
indication that the app interface has been translated. Keep that fallback so a
Hebrew-labelled product can still be imported when it has no English name.

Hebrew interface support is future work in [TODO.md](../TODO.md). Implement it
as a complete interface feature: extracted message keys, Hebrew translations,
locale-aware number/date formatting, and right-to-left layout. Check navigation,
calendar order, charts, numeric inputs, mixed-language product names, text
scaling, and screen-reader labels on native devices. Do not infer the interface
language from the language of a scanned product.

Imperial display units are also future work. Keep canonical persisted values in
grams, kilograms, centimetres, and millilitres, and convert at display/input
boundaries when a real preference is introduced.
