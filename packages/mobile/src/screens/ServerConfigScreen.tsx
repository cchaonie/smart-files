import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { setStoredApiUrl, clearStoredApiUrl } from '../config/storage';
import { getPlatformDefaultApiUrl } from '../config/api';
import { updateApiBaseUrl } from '../api/client';
import { useConfig } from '../context/ConfigContext';

export function ServerConfigScreen({ navigation }: { navigation: any }) {
  const { apiUrl, refreshConfig } = useConfig();
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(apiUrl);
  }, [apiUrl]);

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a server URL');
      return;
    }

    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }

    try {
      await setStoredApiUrl(trimmed);
      updateApiBaseUrl(trimmed);
      await refreshConfig();
      Alert.alert('Saved', `Server URL set to ${trimmed}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to save server URL');
    }
  };

  const handleReset = async () => {
    const defaultUrl = getPlatformDefaultApiUrl();
    try {
      await clearStoredApiUrl();
      updateApiBaseUrl(defaultUrl);
      await refreshConfig();
      setUrl(defaultUrl);
      Alert.alert('Reset', `Restored default: ${defaultUrl}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to reset server URL');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Server Configuration</Text>

        <Text style={styles.label}>Backend API URL</Text>
        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.100:4000"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>Reset to Default</Text>
        </TouchableOpacity>

        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>How to find your server URL</Text>
          <Text style={styles.hintText}>
            • Simulators (iOS & Android): http://localhost:4000{'\n'}
            • Physical device: http://{'<your-computer-ip>'}:4000{'\n\n'}
            Find your computer's IP (same Wi-Fi):{'\n'}
            macOS: System Settings → Network{'\n'}
            Windows: ipconfig{'\n'}
            Linux: ip addr
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  resetButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  hintBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
