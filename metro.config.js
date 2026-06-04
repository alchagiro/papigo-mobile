const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer.unstable_transformProfile = "hermes-v0";

module.exports = config;
