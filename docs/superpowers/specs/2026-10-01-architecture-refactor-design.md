# Architecture refactor

Implement the three opportunities accepted from the architecture review.
English, metric units, local profile version 1, minimum age 16, and the current
screens remain the product contract.

The onboarding flow owns navigation, per-step validation, review return,
staged profile edits, pending-write exclusion, and save-before-navigation.
Its observable snapshot and actions are shared by the screen and focused tests.
React handles subscriptions; the screen handles focus, announcements, keyboard,
and rendering. Profile persistence continues to own durable writes and recovery.

Calorie policy owns answer changes that affect estimate eligibility, opting
in/out, teen transitions, custom-target retention, and target source.
Screen callers submit intentions instead of mutating related flags.
Transient numeric strings remain editable. Stored documents keep their format;
parsing and validation retain legacy age recovery.

Expo connection checks own iOS manifest interpretation, HTTP/exps scheme choice,
loopback detection, expected-origin validation, bounded retries, and cancellation.
The doctor and Cloudflare launcher share them. The launcher's existing child
ownership remains in its script; shutdown aborts readiness promptly.
Tests use local HTTP fixtures, with no running public tunnel needed.

Verify focused tests for save failure/retry, canceled edits, repeated navigation,
age/target transitions, malformed manifests, wrong hosts, timeouts, and shutdown.
Run existing browser regressions, TypeScript, web/native exports, and Expo Doctor.
Keep the pre-existing expo-mcp dependency edits intact.
