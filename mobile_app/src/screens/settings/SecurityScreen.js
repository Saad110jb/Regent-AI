import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Theme } from '../../theme';

const API_URL = 'http://localhost:8002';

const SecurityScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [security, setSecurity] = useState(null);
  const [logs, setLogs] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [toggling2fa, setToggling2fa] = useState(false);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [secRes, logsRes, prefRes] = await Promise.all([
        axios.get(`${API_URL}/settings/security`, { headers }),
        axios.get(`${API_URL}/settings/logs`, { headers }),
        axios.get(`${API_URL}/settings/preferences`, { headers })
      ]);

      setSecurity(secRes.data);
      setLogs(logsRes.data);
      setPreferences(prefRes.data);
    } catch (error) {
      console.log("SETTINGS_ERROR:", error);
      Alert.alert("Error", "Could not sync security parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handle2FAToggle = async (value) => {
    setToggling2fa(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(`${API_URL}/settings/security/2fa/toggle?enabled=${value}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSecurity({ ...security, two_factor_enabled: value });
      setPreferences({ ...preferences, two_factor_enabled: value });
      Alert.alert("Security Update", `Two-Factor Authentication is now ${value ? 'active' : 'disabled'}.`);
      fetchData(); // Refresh logs
    } catch (error) {
      Alert.alert("Error", "Failed to update 2FA status.");
    } finally {
      setToggling2fa(false);
    }
  };

  const handlePrefToggle = async (field, value) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.patch(`${API_URL}/settings/preferences`, { [field]: value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreferences({ ...preferences, [field]: value });
    } catch (error) {
      Alert.alert("Error", "Failed to update tactical preference.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const renderLogItem = ({ item }) => (
    <View style={styles.logItem}>
      <View style={styles.logIcon}>
        <MaterialCommunityIcons
          name={item.action.includes('login') ? 'login' : 'shield-sync'}
          size={16}
          color={Theme.colors.primary}
        />
      </View>
      <View style={styles.logInfo}>
        <Text style={styles.logAction}>{item.action.toUpperCase()}</Text>
        <Text style={styles.logMeta}>{item.user_agent} • {item.ip_address}</Text>
      </View>
      <Text style={styles.logTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BACK BUTTON */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.header}>SYSTEM <Text style={styles.greenText}>GOVERNANCE</Text></Text>
        <Text style={styles.subtitle}>ENCRYPTION_ID: {security?.user_id || 'UNKNOWN'}</Text>

        {/* 2FA SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="shield-lock" size={20} color={Theme.colors.primary} />
            <Text style={styles.sectionTitle}>MULTI-FACTOR AUTH</Text>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>TWO-FACTOR AUTHENTICATION</Text>
              <Text style={styles.settingDesc}>Secure your identity with an additional layer of verification.</Text>
            </View>
            <Switch
              value={preferences?.two_factor_enabled}
              onValueChange={handle2FAToggle}
              trackColor={{ false: '#333', true: Theme.colors.primary }}
              thumbColor={preferences?.two_factor_enabled ? '#fff' : '#888'}
              disabled={toggling2fa}
            />
          </View>
        </View>

        {/* TACTICAL PREFERENCES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="cog-transfer" size={20} color={Theme.colors.primary} />
            <Text style={styles.sectionTitle}>TACTICAL_PREFERENCES</Text>
          </View>

          {/* AUTO ANALYZE */}
          <View style={[styles.row, { marginBottom: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>AUTO_ANALYZE_UPLOADS</Text>
              <Text style={styles.settingDesc}>Trigger AI processing immediately upon transmission.</Text>
            </View>
            <Switch
              value={preferences?.auto_analyze_uploads}
              onValueChange={(v) => handlePrefToggle('auto_analyze_uploads', v)}
              trackColor={{ false: '#333', true: Theme.colors.primary }}
            />
          </View>

          {/* PROFILE PRIVACY */}
          <View style={[styles.row, { marginBottom: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>IS_PROFILE_PUBLIC</Text>
              <Text style={styles.settingDesc}>Allow scouts to find your profile on the neural network.</Text>
            </View>
            <Switch
              value={preferences?.is_profile_public}
              onValueChange={(v) => handlePrefToggle('is_profile_public', v)}
              trackColor={{ false: '#333', true: Theme.colors.primary }}
            />
          </View>

          {/* EMAIL NOTIFICATIONS */}
          <View style={[styles.row, { marginBottom: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>EMAIL_NOTIFICATIONS</Text>
              <Text style={styles.settingDesc}>Receive mission alerts and match reminders via email.</Text>
            </View>
            <Switch
              value={preferences?.email_notifications}
              onValueChange={(v) => handlePrefToggle('email_notifications', v)}
              trackColor={{ false: '#333', true: Theme.colors.primary }}
            />
          </View>

          {/* METRIC SYSTEM */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>METRIC_SYSTEM (KPH)</Text>
              <Text style={styles.settingDesc}>Use metric units for velocity and distance telemetry.</Text>
            </View>
            <Switch
              value={preferences?.metric_system === 'metric'}
              onValueChange={(v) => handlePrefToggle('metric_system', v ? 'metric' : 'imperial')}
              trackColor={{ false: '#333', true: Theme.colors.primary }}
            />
          </View>
        </View>


        {/* AUDIT LOGS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="history" size={20} color={Theme.colors.primary} />
            <Text style={styles.sectionTitle}>SECURITY_LOGS</Text>
          </View>
          {logs.length === 0 ? (
            <Text style={styles.emptyLogs}>No recent activity detected.</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index}>
                {renderLogItem({ item: log })}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: '#ff4444' }]}
          onPress={() => {
            Alert.alert(
              "TERMINATE SESSION",
              "Are you sure you want to decouple from the neural link? All local session data will be purged.",
              [
                { text: "ABORT", style: "cancel" },
                {
                  text: "TERMINATE",
                  onPress: async () => {
                    await AsyncStorage.clear();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Login' }],
                    });
                  },
                  style: "destructive"
                }
              ]
            );
          }}
        >
          <View style={styles.logoutContent}>
            <Text style={styles.logoutText}>TERMINATE SESSION</Text>
            <MaterialCommunityIcons name="power" size={20} color="#ff4444" />
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },
  scrollContent: { padding: 25, paddingTop: 60, paddingBottom: 50 },
  backBtn: { marginBottom: 20, alignSelf: 'flex-start', padding: 10, backgroundColor: '#111', borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  header: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  greenText: { color: Theme.colors.primary },
  subtitle: { color: '#444', fontSize: 10, fontWeight: 'bold', marginTop: 5, letterSpacing: 1, marginBottom: 40 },

  section: { marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, opacity: 0.8 },
  sectionTitle: { color: Theme.colors.primary, fontSize: 12, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  settingDesc: { color: '#666', fontSize: 11, marginTop: 4, paddingRight: 40 },

  prefRow: { marginBottom: 20 },
  chipRow: { flexDirection: 'row', marginTop: 12 },
  chip: {
    backgroundColor: '#111',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#222'
  },
  activeChip: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  chipText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
  activeChipText: { color: '#000' },

  logItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#0a0a0a' },
  logIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  logInfo: { flex: 1, marginLeft: 12 },
  logAction: { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  logMeta: { color: '#444', fontSize: 9, marginTop: 2 },
  logTime: { color: '#666', fontSize: 9 },
  emptyLogs: { color: '#444', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  logoutBtn: {
    borderWidth: 1,
    borderColor: '#FF4444',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.05)'
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoutText: { color: '#FF4444', fontWeight: '900', fontSize: 13, letterSpacing: 2, marginRight: 10 }
});

export default SecurityScreen;
