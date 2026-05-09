import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, ImageBackground, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Theme } from '../../theme';

const { width } = Dimensions.get('window');
const API_URL = 'http://localhost:8002';

const GlassCard = ({ children, style }) => (
  <View style={[styles.glassBase, style]}>
    {children}
  </View>
);

const EditPlayerStats = ({ route, navigation }) => {
  const { playerId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [stats, setStats] = useState({
    total_runs: 0,
    highest_score: 0,
    batting_average: 0.0,
    strike_rate: 0.0,
    wickets: 0,
    best_bowling_figures: "0/0",
    economy_rate: 0.0,
    top_speed_kph: 0.0,
    average_speed_kph: 0.0,
    sessions_count: 0
  });

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(`${API_URL}/players/${playerId}`, { headers });
        if (response.data && response.data.performance_stats) {
          setStats({
            ...stats,
            ...response.data.performance_stats
          });
        }
      } catch (error) {
        Alert.alert("Error", "Could not load player stats.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, [playerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        total_runs: parseInt(stats.total_runs) || 0,
        highest_score: parseInt(stats.highest_score) || 0,
        batting_average: parseFloat(stats.batting_average) || 0.0,
        strike_rate: parseFloat(stats.strike_rate) || 0.0,
        wickets: parseInt(stats.wickets) || 0,
        best_bowling_figures: stats.best_bowling_figures,
        economy_rate: parseFloat(stats.economy_rate) || 0.0,
        top_speed_kph: parseFloat(stats.top_speed_kph) || 0.0,
        average_speed_kph: parseFloat(stats.average_speed_kph) || 0.0,
        sessions_count: parseInt(stats.sessions_count) || 0
      };

      const token = await AsyncStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.patch(`${API_URL}/players/${playerId}/stats`, payload, { headers });
      
      Alert.alert("Success", "Player stats updated successfully!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert("Update Failed", "You do not have permission or there was an error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00FF41" size="large" />
      </View>
    );
  }

  return (
    <ImageBackground 
      source={require('../../../assets/neural_bg.png')} 
      style={styles.container}
    >
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.headerCard}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
              </TouchableOpacity>
              <View>
                <Text style={styles.header}>OPERATIVE <Text style={styles.green}>MODIFICATION</Text></Text>
                <Text style={styles.subtitle}>SECURE_ACCESS_ID: {playerId.slice(-12).toUpperCase()}</Text>
              </View>
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>BATTING_MATRIX</Text>
          <GlassCard style={[styles.sectionCard, Theme.glow]}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>TOTAL RUNS</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.total_runs)}
                    onChangeText={(t) => setStats({...stats, total_runs: t})}
                  />
                </View>
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>BAT_AVG</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.batting_average)}
                    onChangeText={(t) => setStats({...stats, batting_average: t})}
                  />
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>STRIKE_RATE</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.strike_rate)}
                    onChangeText={(t) => setStats({...stats, strike_rate: t})}
                  />
                </View>
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>SESSIONS_COUNT</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.sessions_count)}
                    onChangeText={(t) => setStats({...stats, sessions_count: t})}
                  />
                </View>
              </View>
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>BALLISTIC_METRICS</Text>
          <GlassCard style={styles.sectionCard}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>WICKETS</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.wickets)}
                    onChangeText={(t) => setStats({...stats, wickets: t})}
                  />
                </View>
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>BEST FIGURES</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    placeholder="0/0"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={stats.best_bowling_figures}
                    onChangeText={(t) => setStats({...stats, best_bowling_figures: t})}
                  />
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>MAX_KPH</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.top_speed_kph)}
                    onChangeText={(t) => setStats({...stats, top_speed_kph: t})}
                  />
                </View>
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>AVG_KPH</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.average_speed_kph)}
                    onChangeText={(t) => setStats({...stats, average_speed_kph: t})}
                  />
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>ECONOMY</Text>
                <View style={styles.inputWell}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric"
                    value={String(stats.economy_rate)}
                    onChangeText={(t) => setStats({...stats, economy_rate: t})}
                  />
                </View>
              </View>
            </View>
          </GlassCard>

          <TouchableOpacity 
            style={[styles.submitBtn, Theme.glow]} 
            onPress={handleSave} 
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>SAVE PLAYER STATS</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  glassBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCard: { padding: 25, marginBottom: 30 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 20, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  green: { color: '#00FF41' },
  subtitle: { color: '#666', fontSize: 8, fontWeight: '900', marginTop: 5, letterSpacing: 1 },
  sectionTitle: { color: '#00FF41', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginLeft: 5, opacity: 0.6 },
  sectionCard: { padding: 25, marginBottom: 30 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  halfInput: { width: '48%' },
  label: { color: '#fff', fontSize: 8, fontWeight: '900', marginBottom: 10, opacity: 0.3, letterSpacing: 1 },
  inputWell: { 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden'
  },
  input: { color: '#fff', padding: 15, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  submitBtn: { backgroundColor: '#00FF41', padding: 22, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 14 }
});

export default EditPlayerStats;

