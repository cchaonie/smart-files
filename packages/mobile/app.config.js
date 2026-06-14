const version = process.env.APP_VERSION || require('./package.json').version;
const isReleaseBuild = process.env.RELEASE_BUILD === 'true';

// Build a monotonic version code from semver (e.g. "1.2.3" → 1002003)
const parts = version.split('.').map(n => (isNaN(Number(n)) ? 0 : Number(n)));
const versionCode = (parts[0] || 1) * 100000 + (parts[1] || 0) * 1000 + (parts[2] || 0);

export default {
  expo: {
    name: isReleaseBuild ? 'Smart Files' : 'mobile',
    slug: 'mobile',
    version,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'life.inkxel.smartfiles',
      supportsTablet: true,
    },
    android: {
      package: 'life.inkxel.smartfiles',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      versionCode,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      // Allow cleartext HTTP in dev; enforce HTTPS in production builds
      usesCleartextTraffic: !isReleaseBuild,
      // Release signing config — environment variables set by CI
      ...(isReleaseBuild
        ? {
            keystore: {
              keystorePath: process.env.ANDROID_KEYSTORE_PATH || 'release.keystore',
              keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD || '',
              keyAlias: process.env.ANDROID_KEY_ALIAS || 'release',
              keyPassword: process.env.ANDROID_KEY_PASSWORD || '',
            },
          }
        : {}),
    },
    plugins: [
      './plugins/withNetworkSecurityConfig',
      './modules/foreground-download',
      [
        'expo-notifications',
        {
          android: {
            foregroundService: {
              channelId: 'uploads',
              notificationColor: '#3B82F6',
            },
          },
        },
      ],
    ],
    web: {
      favicon: './assets/favicon.png',
    },
  },
};
