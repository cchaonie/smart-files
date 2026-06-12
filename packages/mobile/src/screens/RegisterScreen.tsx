import React, { useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import {
  CloudArrowUpIcon, EnvelopeIcon, LockIcon, UserIcon,
  EyeIcon, EyeSlashIcon, ArrowRightIcon, CheckCircleIcon,
} from '../components/icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function RegisterScreen({ navigation }: { navigation: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register } = useAuth();
  const { t } = useI18n();

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert(t.error, t.enterCredentials);
      return;
    }
    if (password.length < 6) {
      setError(t.passwordMinLength);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await register(email, password, name || undefined);
      setSuccess(true);
      setTimeout(() => navigation.replace('Home'), 800);
    } catch (err: any) {
      setError(err.response?.data?.error || t.loginFailed);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.root}>
        <View style={styles.successContainer}>
          <CheckCircleIcon size={56} color={theme.colors.success} />
          <Text style={styles.successTitle}>{t.accountCreated}</Text>
          <Text style={styles.successSubtext}>{t.redirectingToFiles}</Text>
        </View>
      </View>
    );
  }

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
          {/* Background glow */}
          <View style={styles.bgGlow}>
            <View style={styles.glowCircle} />
          </View>

          {/* Nav */}
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backBtn}>← 返回</Text>
            </TouchableOpacity>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <CloudArrowUpIcon size={20} color="#fff" />
              </View>
              <Text style={styles.appName}>{t.appName}</Text>
            </View>
          </View>

          {/* Glass card */}
          <View style={styles.card}>
            <View style={styles.cardGlow} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t.createAccount}</Text>
                <Text style={styles.cardSubtitle}>{t.registerSubtitle}</Text>
              </View>

              <View style={styles.form}>
                {/* Name */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t.nameOptional}</Text>
                  <View style={styles.inputWrap}>
                    <View style={styles.inputIcon}>
                      <UserIcon size={18} color={theme.colors.textTertiary} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t.namePlaceholder}
                      placeholderTextColor={theme.colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

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
                      autoComplete="new-password"
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

                {/* Error */}
                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <View style={styles.submitLoading}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.submitText}>{t.creating}</Text>
                    </View>
                  ) : (
                    <View style={styles.submitRow}>
                      <Text style={styles.submitText}>{t.register}</Text>
                      <ArrowRightIcon size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Login link */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.linkRow}
              >
                <Text style={styles.linkText}>
                  {t.hasAccount}{' '}
                  <Text style={styles.linkHighlight}>{t.signIn}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  nav: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 16,
  },
  backBtn: {
    fontSize: 16,
    color: theme.colors.accent,
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
    gap: 16,
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

  // Error
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: theme.radii.md,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.danger,
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

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.text,
  },
  successSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});

export default RegisterScreen;
