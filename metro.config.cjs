// Keeps private env files out of development bundles.
//
// In development, Expo's env module loads every project-root file whose name
// starts with `.env`. It parses the standard names (`.env`, `.env.local`,
// `.env.development`, `.env.production` and their `.local` variants) and drops
// values without the EXPO_PUBLIC_ prefix. Any other name, such as
// `.env.auth.local` with the Supabase Management API token, would be bundled as
// plain source and served by Metro to anything that can reach the dev server.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const root = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const separator = `\\${path.sep}`;
const privateEnvFile = new RegExp(
  `^${root}${separator}\\.env(?!(\\.(local|(development|production)(\\.local)?))?$)[^${separator}]*$`,
  // Windows paths ignore case, and tools disagree on the drive letter's case.
  process.platform === "win32" ? "i" : "",
);

const blockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  privateEnvFile,
];

module.exports = config;
