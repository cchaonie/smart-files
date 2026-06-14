apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'
apply plugin: 'maven-publish'

group = 'life.inkxel.smartfiles'
version = '1.0.0'

android {
  namespace = "life.inkxel.smartfiles.foregrounddownload"
  compileSdk = 35

  defaultConfig {
    minSdk = 26
    targetSdk = 35
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation project(':expo-modules-core')
  implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.21"
}
