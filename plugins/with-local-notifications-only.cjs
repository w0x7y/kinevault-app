// Keeps the generated iOS app signable with a free Apple ID (Personal Team).
//
// expo-notifications always adds the `aps-environment` entitlement, which needs
// the Push Notifications capability. Personal Teams cannot sign that capability.
// KineVault Track only schedules local notifications, and those need no
// entitlement, so this plugin removes the key again.
//
// List this plugin before "expo-notifications" in app.json. Expo applies
// entitlement changes in reverse plugin order, so the earlier plugin runs last.
// To add remote push later, delete this plugin and use a paid developer team.
const { withEntitlementsPlist } = require("expo/config-plugins");

const pluginPath = "./plugins/with-local-notifications-only.cjs";

module.exports = function withLocalNotificationsOnly(config) {
  if (config._internal?.pluginHistory?.["expo-notifications"]) {
    throw new Error(
      `Move "${pluginPath}" before "expo-notifications" in the app.json plugins list. ` +
        "In its current position, expo-notifications adds aps-environment back after it is removed.",
    );
  }
  return withEntitlementsPlist(config, (entitlementsConfig) => {
    delete entitlementsConfig.modResults["aps-environment"];
    return entitlementsConfig;
  });
};
