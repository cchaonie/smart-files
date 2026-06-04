const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withNetworkSecurityConfig = (config) => {
  // Step 1: Add android:networkSecurityConfig to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
    application.$["android:networkSecurityConfig"] =
      "@xml/network_security_config";
    return config;
  });

  // Step 2: Copy XML config and CA cert to Android resources
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      const resXmlDir = path.join(platformRoot, "app/src/main/res/xml");
      const resRawDir = path.join(platformRoot, "app/src/main/res/raw");

      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.mkdirSync(resRawDir, { recursive: true });

      fs.copyFileSync(
        path.join(projectRoot, "assets/network_security_config.xml"),
        path.join(resXmlDir, "network_security_config.xml")
      );

      fs.copyFileSync(
        path.join(projectRoot, "assets/ca.pem"),
        path.join(resRawDir, "ca.pem")
      );

      return config;
    },
  ]);

  return config;
};

module.exports = withNetworkSecurityConfig;
