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
import { theme } from '../theme';
import { GlobeIcon, ArrowPathIcon, CheckCircleIcon } from '../components/icons';

export function ServerConfigScreen({ navigation }: { navigation: any }) {
  const { apiUrl, refreshConfig } = useConfig();
  const [url, setUrl] = useState('');

  useEffect(() => { setUrl(apiUrl); }, [apiUrl]);

  const handleSave = async () => {
    if (!url.trim()) { Alert.alert('错误', '请输入服务器地址'); return; }
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('错误', 'URL 必须以 http:// 或 https:// 开头'); return;
    }
    try {
      await setStoredApiUrl(trimmed);
      updateApiBaseUrl(trimmed);
      await refreshConfig();
      Alert.alert('已保存', `服务器地址已设为 ${trimmed}`, [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch { Alert.alert('错误', '保存失败'); }
  };

  const handleReset = async () => {
    const defaultUrl = getPlatformDefaultApiUrl();
    try {
      await clearStoredApiUrl();
      updateApiBaseUrl(defaultUrl);
      await refreshConfig();
      setUrl(defaultUrl);
      Alert.alert('已重置', `已恢复默认: ${defaultUrl}`);
    } catch { Alert.alert('错误', '重置失败'); }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>服务器配置</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <GlobeIcon size={28} color={theme.colors.accent} />
          </View>
          <Text style={styles.cardTitle}>后端 API 地址</Text>
          <Text style={styles.cardSubtitle}>
            输入 NAS 或 Cloudflare Tunnel 的地址
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="https://photos.example.com"
              placeholderTextColor={theme.colors.textTertiary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <CheckCircleIcon size={18} color="#fff" />
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <ArrowPathIcon size={16} color={theme.colors.accent} />
            <Text style={styles.resetBtnText}>恢复默认</Text>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>如何找到服务器地址</Text>
          <Text style={styles.hintText}>
            • 模拟器: http://localhost:4000{'\n'}
            • 真机 (同一 Wi-Fi): http://{'<电脑IP>'}:4000{'\n\n'}
            查找电脑 IP:{'\n'}
            Linux/Mac: ip addr 或 ifconfig{'\n'}
            Windows: ipconfig
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  scroll: { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  backBtn: { fontSize: 16, color: theme.colors.accent },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  headerSpacer: { width: 60 },

  // Card
  card: {
    marginHorizontal: 20, marginTop: 24,
    padding: 24, borderRadius: theme.radii['2xl'],
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.glassBorder,
    alignItems: 'center', gap: 12,
    ...theme.shadows.md,
  },
  cardIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.accentGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  cardSubtitle: { fontSize: 13, color: theme.colors.textTertiary, textAlign: 'center', marginBottom: 8 },

  inputWrap: {
    width: '100%', borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radii.lg, backgroundColor: theme.colors.zinc50,
  },
  input: {
    paddingVertical: 14, paddingHorizontal: 14,
    fontSize: 15, color: theme.colors.text,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: '100%', paddingVertical: 14,
    borderRadius: theme.radii.lg, backgroundColor: theme.colors.accent,
    justifyContent: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10,
  },
  resetBtnText: { color: theme.colors.accent, fontSize: 14 },

  // Hint
  hintBox: {
    marginHorizontal: 20, marginTop: 20,
    padding: 16, borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.zinc100,
  },
  hintTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  hintText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
});

export default ServerConfigScreen;
