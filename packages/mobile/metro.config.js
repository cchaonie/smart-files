const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the shared package for changes
const sharedPath = path.resolve(__dirname, '../shared');
config.watchFolders = [...(config.watchFolders || []), sharedPath];

// Ensure Metro can resolve the shared package
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, '../../node_modules'),
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
