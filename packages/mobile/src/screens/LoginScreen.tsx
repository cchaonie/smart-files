import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { getApiErrorMessage, isNetworkError } from '../config/api';
import { theme } from '../theme';
import { CloudArrowUpIcon, EnvelopeIcon, LockIcon, EyeIcon, EyeSlashIcon, ArrowRightIcon } from '../components/icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function LoginScreen({ navigation }: { navigation: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const { login } = useAuth();
  const { apiUrl } = useConfig();
  const { t } = useI18n();

  useEffect(() => {
    (async () => {
      const savedEmail = await AsyncStorage.getItem('sf_remember_email');
      const savedPw = await AsyncStorage.getItem('sf_remember_password');
      if (savedEmail) {
        setEmail(savedEmail);
        setRemember(true);
        if (savedPw) setPassword(savedPw);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t.error, t.enterCredentials);
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      if (remember) {
        await AsyncStorage.setItem('sf_remember_email', email);
        await AsyncStorage.setItem('sf_remember_password', password);
      } else {
        await AsyncStorage.removeItem('sf_remember_email');
        await AsyncStorage.removeItem('sf_remember_password');
      }
    } catch (error: any) {
      const message = getApiErrorMessage(error);
      if (isNetworkError(error)) {
        Alert.alert(
          t.cannotConnect,
          `Unable to reach the backend at:\n${apiUrl}\n\n${message}\n\nTap "Configure Server" below to set the correct URL.`,
          [
            { text: 'OK', style: 'cancel' },
            {
              text: t.configureServer,
              onPress: () => navigation.navigate('ServerConfig'),
            },
          ]
        );
      } else {
        Alert.alert(t.loginFailed, message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Background gradient effect */}
          <View style={styles.bgGlow}>
            <View style={styles.glowCircle} />
          </View>

          {/* Nav bar */}
          <View style={styles.nav}>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <CloudArrowUpIcon size={20} color="#fff" />
              </View>
              <Text style={styles.appName}>{t.appName}</Text>
            </View>
          </View>

          {/* Glassmorphism card */}
          <View style={styles.card}>
            {/* Subtle gradient overlay */}
            <View style={styles.cardGlow} />

            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t.signInTitle}</Text>
                <Text style={styles.cardSubtitle}>{t.signInSubtitle}</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* Email */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t.email}</Text>
                  <View style={styles.inputWrap}>
                    <View style={styles.inputIcon}>
                      <EnvelopeIcon size={18} color={theme.colors.textTertiary} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t.emailPlaceholder}
                      placeholderTextColor={theme.colors.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t.password}</Text>
                  <View style={styles.inputWrap}>
                    <View style={styles.inputIcon}>
                      <LockIcon size={18} color={theme.colors.textTertiary} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t.passwordPlaceholder}
                      placeholderTextColor={theme.colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                    />
                    <TouchableOpacity
                      style={styles.inputSuffix}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon size={18} color={theme.colors.textTertiary} />
                      ) : (
                        <EyeIcon size={18} color={theme.colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Remember password */}
                <View style={styles.rememberRow}>
                  <Text style={styles.rememberLabel}>{t.rememberPassword}</Text>
                  <Switch
                    value={remember}
                    onValueChange={setRemember}
                    trackColor={{ false: '#d4d4d8', true: '#3b82f6' }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <View style={styles.submitLoading}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.submitText}>{t.signingIn}</Text>
                    </View>
                  ) : (
                    <View style={styles.submitRow}>
                      <Text style={styles.submitText}>{t.signIn}</Text>
                      <ArrowRightIcon size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Register link */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                style={styles.linkRow}
              >
                <Text style={styles.linkText}>
                  {t.noAccount}{' '}
                  <Text style={styles.linkHighlight}>{t.registerLink}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Server config */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ServerConfig')}
            style={styles.configRow}
          >
            <Text style={styles.configLabel}>
              {t.serverLabel}: {apiUrl || t.loadingElipsis}
            </Text>
            <Text style={styles.configSubtext}>{t.tapToConfigure}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.zinc50,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  // Background gradient
  bgGlow: {
    position: 'absolute',
    top: -200,
    left: -100,
    right: -100,
    height: 400,
    alignItems: 'center',
  },
  glowCircle: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    borderRadius: SCREEN_WIDTH * 0.75,
    backgroundColor: theme.colors.accentGlow,
    opacity: 0.6,
  },

  // Nav
  nav: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },

  // Card
  card: {
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: theme.radii['3xl'],
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(37, 99, 235, 0.03)',
  },
  cardContent: {
    padding: 32,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },

  // Form
  form: {
    gap: 18,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  inputIcon: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: theme.colors.text,
  },
  inputSuffix: {
    paddingRight: 12,
  },

  // Submit
  submitBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  submitLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Links
  linkRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  linkHighlight: {
    color: theme.colors.accent,
    fontWeight: '500',
  },

  // Config
  configRow: {
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 40,
  },
  configLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  configSubtext: {
    fontSize: 12,
    color: theme.colors.accent,
    marginTop: 4,
  },
});

export default LoginScreen;
