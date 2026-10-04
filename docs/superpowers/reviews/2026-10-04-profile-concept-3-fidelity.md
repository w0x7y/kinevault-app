# Profile concept 3 fidelity

Profile now follows the selected Personal journal composition in
[Variant C](../../../design/profile-prototype.html) and the four supplied
screenshots. The centered avatar and camera badge, typography, underline tabs,
compact streak, filled weekly chart, nutrition link, macro columns, inline water,
plain goal rows, and dated photo journal use the reference dimensions and colors.
The four existing bottom tabs remain in place.

Editing remains functional: identity opens Name; the goal cards expose nutrition,
water, and individual details editors. Photo images open their editor. Compare two
activates selection controls; two selected images open the comparison viewer.
Native Add opens library/camera choices. The closed range selector matches the
concept; its native options open a dismissible, scrolling dialog.

Chart volume and known duration aggregate by week; exercise weight retains
independent side maxima. Missing weeks remain gaps. Point selection reports the
plotted weekly value; the data disclosure retains the original daily records.

## Captures

These captures use isolated browser fixtures with the concept's sample content.
The user's saved profile, activity, and media were preserved. System status bars
and the prototype's decorative phone frame are supplied by the device, rather
than drawn inside the app.

- [Overview](assets/profile-concept-3/overview.png)
- [Scrolled Overview](assets/profile-concept-3/overview-scrolled.png)
- [Goals](assets/profile-concept-3/goals.png)
- [Photos](assets/profile-concept-3/photos.png)

Regenerate with:

```sh
KINE_PROFILE_VISUAL_DIR=/tmp/profile-captures node --test \
  --test-name-pattern='capture the approved journal' tests/profile.browser.mjs
```

## Validation

- TypeScript, including unused symbol checks, passed.
- All 560 direct tests passed.
- Full browser suite: 137 passed; the optional capture test was skipped.
- The optional reference capture passed separately. Final targeted checks passed
  after adding scrolling native picker options: responsive journal sections in
  both themes, graph selection, range selection, and Escape dismissal.
- Web, iOS, and Android exports passed against the final source.
- Android Expo Go inspection confirmed Overview, Goals, Photos, library/camera
  source choices, selecting a graph range, and Back dismissing range options
  while Profile remained open. Source choices and the range dialog avoid placing
  native touch controls outside their parent's bounds.
- Shared browser inspection confirmed the real saved profile still renders its
  own values and honest empty history.

No dependencies or persistence formats changed.
