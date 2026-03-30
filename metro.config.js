const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the /website Next.js project from Metro's module resolution.
// Without this, Metro may attempt to resolve Next.js modules and fail.
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /\/website\/.*/,
];

module.exports = config;
