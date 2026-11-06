// Takes Android's versionCode from ANDROID_VERSION_CODE when it's set.
//
// Google Play needs a higher versionCode for every upload. The release workflow
// sets ANDROID_VERSION_CODE from its run number, so builds count up without an
// app.json edit. Without the variable, local builds keep app.json's value
// (Expo's default is 1).
const maxVersionCode = 2100000000; // Google Play's limit

function versionCodeFrom(value) {
  if (value === undefined || value === "") return undefined;
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > maxVersionCode) {
    throw new Error(
      `ANDROID_VERSION_CODE must be a whole number from 1 to ${maxVersionCode}, not "${value}".`,
    );
  }
  return Number(value);
}

function withAndroidVersionCode(config) {
  const versionCode = versionCodeFrom(process.env.ANDROID_VERSION_CODE);
  if (versionCode === undefined) return config;
  return { ...config, android: { ...config.android, versionCode } };
}

module.exports = withAndroidVersionCode;
module.exports.versionCodeFrom = versionCodeFrom;
