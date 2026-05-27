import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { getApiErrorMessage, isNetworkError } from '../config/api';

export function LoginScreen({ navigation }: { navigation: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { apiUrl } = useConfig();
  const { t } = useI18n();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t.error, t.enterCredentials);
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
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
    <View style={styles.container}>
      <Text style={styles.title}>{t.appName}</Text>
      <Text style={styles.subtitle}>{t.signInSubtitle}</Text>

      <TextInput
        style={styles.input}
        placeholder={t.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder={t.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? t.signingIn : t.signIn}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>{t.noAccountMobile}</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity onPress={() => navigation.navigate('ServerConfig')}>
        <Text style={styles.configLink}>
          {t.serverLabel}: {apiUrl || 'loading...'}
        </Text>
        <Text style={styles.configSubtext}>{t.tapToConfigure}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 24,
    marginHorizontal: 40,
  },
  configLink: {
    color: '#666',
    textAlign: 'center',
    fontSize: 13,
  },
  configSubtext: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
});