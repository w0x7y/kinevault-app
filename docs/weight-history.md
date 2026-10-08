# Body weight history

Profile Overview includes Body weight. Log a measurement in kilograms, change its date or value, or delete it from the history. The date starts with the calendar day selected in the app header. Input accepts a decimal point or comma and up to two decimal places, between 1 and 500 kg. Dates must be real calendar dates in YYYY-MM-DD format.

Each date has one measurement. Saving another weight on a recorded date replaces that measurement. The editor explains this before saving. Moving a measurement to a recorded date also replaces the destination measurement.

The trend shows up to 30 latest measurements with calendar spacing. Dots are recorded values; dashed lines connect them without adding measurements on missing days. The chart exposes all shown dates and values to assistive technology. Empty and single-measurement histories have explicit messages. Measurement history lists dates and kg chronologically, starting with the latest ten. Show earlier measurements reveals thirty more at a time.

Weight history stays separate from `answers.weight`, which supplies body details for calorie estimates. Logging or changing history never changes calorie or macro goals. No initial measurement is inferred from profile setup.

Measurements live in the optional `weightEntries` field of the existing version-1 profile document under `kinevault-track.profile.v1`. Existing account storage scopes this document per account and syncs it across devices. Legacy documents without this field remain valid and display an empty history. Profile answer edits preserve the current history, including saves from older editors that omit the field. Starting fresh with profile recovery removes the history with the rest of that profile.

All add/edit/delete operations use the shared durable writer. The visible history changes only after local persistence succeeds. Failed writes keep the saved history and editor values for retry. Failed account refresh blocks changes until loading succeeds; the panel offers Retry weight history. A malformed stored history invokes existing profile recovery instead of silently discarding entries.

The body-weight edit module owns raw date/kg drafts, field errors, replacement guidance and save/delete completion. Its interface is shared by rendering and direct lifecycle tests. Leaving the journal discards its edit; pending durable writes may finish without publishing feedback into a replacement edit.

Unit coverage is in `tests/weight-history.test.ts` and `tests/weight-editing.test.ts`. Browser coverage is in `tests/weight-history.browser.mjs` and uses the existing preview and account fixture. Run the browser file with `KINE_PREVIEW_URL` pointing at a freshly built preview.
