# Web deploy

The web app is a static Expo Router export, and `vercel.json` already holds its build settings and security headers. A free Vercel project gives it a `https://<project>.vercel.app` address. The store listings and Google sign-in need two pages there: `/privacy` and `/delete-account`.

Below, `YOUR-TRACK-WEB-HOST` stands for that address without `https://`, as in [Supabase setup](supabase-setup.md).

## 1. Create the Vercel project

1. On vercel.com, choose **Add New → Project** and import this repository. Keep the root directory at the repository root, where `package.json` and `vercel.json` are.
2. Set **Framework Preset** to Other and leave the build, output and install overrides off. `vercel.json` sets them:

   | Setting          | Value                                                    |
   | ---------------- | -------------------------------------------------------- |
   | Install command  | `npm ci`                                                 |
   | Build command    | `npm run export:web` (`expo export --platform web`)      |
   | Output directory | `dist`                                                   |
   | Clean URLs       | On. `/delete-account` serves `dist/delete-account.html`. |

3. Set **Node.js Version** to 24.x under Settings → Build and Deployment. That matches `.nvmrc`, which Vercel doesn't read.
4. Add the environment variables below for Production, and for Preview if you use preview deployments. Expo copies `EXPO_PUBLIC_*` values into the bundle at build time, so a changed value needs a redeploy.

   | Name                                   | Value                                                           | Needed                                                                |
   | -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
   | `EXPO_PUBLIC_SUPABASE_URL`             | `https://kkywpvkckxniriatelta.supabase.co`                      | Yes                                                                   |
   | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key from Supabase → Project Settings → API Keys | Yes                                                                   |
   | `EXPO_PUBLIC_TRACK_PARTITIONS`         | Leave unset                                                     | Not until the [monthly history rollout](history-migration-rollout.md) |

   Without the Supabase pair the build still passes, but the app shows account features as unavailable. Everything here ends up in the public bundle. Never add a service-role key, secret key or access token.

5. Deploy. The production address is listed under Settings → Domains. Use that address everywhere below. Per-deployment URLs, the ones with a hash in them, can sit behind Vercel's deployment protection, and a reviewer who opens one gets a Vercel login page.

Pushes to the production branch redeploy. Edits to `/privacy` or `/delete-account` go live that way too.

## 2. Check the deployment

1. Check the headers:

   ```bash
   curl -sI https://YOUR-TRACK-WEB-HOST/delete-account | grep -i content-security-policy
   ```

2. Open `https://YOUR-TRACK-WEB-HOST/`, `/privacy` and `/delete-account` in a private window with the browser console open. Type each address so the server serves it directly. None of them should log an error, and in particular no "violates the following Content Security Policy directive" line. Signed out, `/` moves on to setup ("Hi, I'm Kine."), and the other two stay on their own address.
3. Sign in with a test account and wait for Settings to say "All changes saved to your account." That shows Supabase requests pass `connect-src`.

A blocked inline script means Expo Router changed its hydration script, so the hash in `vercel.json` is stale. `tests/web-headers.test.ts` fails in `npm run check` when that happens.

To look at the export before deploying, run `npm run export:web` and `npx expo serve`. That serves `dist` with clean URLs but without the `vercel.json` headers, so the CSP check has to happen on Vercel.

## 3. Supabase Auth URLs

In Supabase, open Authentication → URL Configuration and add these redirect URLs:

```text
https://YOUR-TRACK-WEB-HOST/auth/callback
https://YOUR-TRACK-WEB-HOST/auth/callback?flow=recovery
```

The web app asks Supabase to return to `<origin>/auth/callback` after email confirmation and Google sign-in (`redirectTo` in `src/account/provider.tsx`), and recovery opens `/auth/reset-password`.

Leave the Site URL alone unless KineVault's owner agrees. The project is shared with KineVault, the Site URL is a single value, and Track doesn't need it because every Track request names its own redirect. Supabase falls back to the Site URL only when a redirect isn't on the list above, so a missing entry sends Track users to KineVault's site.

`scripts/configure-auth.mjs` can add the same URLs from `KINEVAULT_TRACK_WEB_URL`, but it also moves email to Resend. Use it only as part of that change ([email delivery](supabase-setup.md#email-delivery)).

Then request a password reset for a test account on the deployed site. The email's link should open `/auth/reset-password` on the Vercel address.

## 4. Google Auth Platform

In Google Cloud Console, open Google Auth Platform for the project that holds the sign-in client.

1. On **Branding**, set:
   - App home page: `https://YOUR-TRACK-WEB-HOST/`
   - App privacy policy link: `https://YOUR-TRACK-WEB-HOST/privacy`
   - Authorized domains: add `YOUR-TRACK-WEB-HOST`. `vercel.app` is a public suffix, so the authorized domain is the whole project subdomain. Keep `kkywpvkckxniriatelta.supabase.co`, which the sign-in redirect uses.
2. On **Audience**, choose **Publish app** to move it from Testing to In production. Until then, only listed test users can sign in with Google.

If Google asks for brand verification, it checks that you own the home page's domain and that the home page links to the privacy policy. Verify the domain in Google Search Console as a URL-prefix property with the HTML file method: put the file in `public/`, which the export copies to the site root, and redeploy. The home page is a known gap. `/` sends a signed-out visitor to setup, and setup's first screen has no privacy policy link.

## 5. Store listings

| Store             | Field                                             | URL                                          |
| ----------------- | ------------------------------------------------- | -------------------------------------------- |
| Google Play       | App content → Privacy policy                      | `https://YOUR-TRACK-WEB-HOST/privacy`        |
| Google Play       | App content → Data safety, the delete account URL | `https://YOUR-TRACK-WEB-HOST/delete-account` |
| App Store Connect | App Privacy → Privacy Policy URL                  | `https://YOUR-TRACK-WEB-HOST/privacy`        |

Both pages show bracketed placeholders, such as `[Contact email]`, until someone fills them in. Fill them before a reviewer sees the pages ([before publishing](privacy.md#before-publishing)).
