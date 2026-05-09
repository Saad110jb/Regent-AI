import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const InitializePlayer = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    player_type: 'all-rounder',
    batting_style: 'right-hand',
    bowling_style: 'right-arm-fast',
    jersey_number: ''
  });

  const API_URL = 'http://localhost:8002';

  const handleInitialize = async () => {
    if (!form.jersey_number) {
      Alert.alert("Required", "Please enter your jersey number.");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userId = await AsyncStorage.getItem('user_id');
      
      const payload = {
        ...form,
        user_id: userId,
        jersey_number: parseInt(form.jersey_number),
        performance_stats: {
          total_runs: 0,
          highest_score: 0,
          batting_average: 0.0,
          strike_rate: 0.0,
          wickets: 0,
          best_bowling_figures: "0/0",
          economy_rate: 0.0,
          top_speed_kph: 0.0
        }
      };

      await axios.post(`${API_URL}/players/me`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert("Success", "Your cricket identity has been forged!");
      navigation.replace('PlayerDashboard');
    } catch (error) {
      Alert.alert("Error", error.response?.data?.detail || "Could not initialize profile.");
    } finally {
      setLoading(false);
    }
  };

  const OptionSelector = ({ label, value, options, onSelect }) => (
    <View style={styles.selectorContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map(opt => (
          <TouchableOpacity 
            key={opt}
            style={[styles.optionBtn, value === opt && styles.optionBtnActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.optionText, value === opt && styles.optionTextActive]}>
              {opt.replace(/-/g, ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* BACK BUTTON */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>IDENTITY FORGING</Text>
      <Text style={styles.subtitle}>Define your role on the field.</Text>

      <OptionSelector 
        label="SPECIALTY"
        value={form.player_type}
        options={['batsman', 'bowler', 'all-rounder', 'wicket-keeper']}
        onSelect={v => setForm({...form, player_type: v})}
      />

      <OptionSelector 
        label="BATTING HAND"
        value={form.batting_style}
        options={['right-hand', 'left-hand']}
        onSelect={v => setForm({...form, batting_style: v})}
      />

      <OptionSelector 
        label="BOWLING STYLE"
        value={form.bowling_style}
        options={['right-arm-fast', 'left-arm-fast', 'leg-spin', 'off-spin']}
        onSelect={v => setForm({...form, bowling_style: v})}
      />

      <Text style={styles.label}>JERSEY NUMBER</Text>
      <TextInput 
        style={styles.input}
        placeholder="E.g. 7, 10, 18"
        placeholderTextColor="#444"
        keyboardType="numeric"
        value={form.jersey_number}
        onChangeText={t => setForm({...form, jersey_number: t})}
      />

      <TouchableOpacity 
        style={styles.submitBtn} 
        onPress={handleInitialize}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>INITIALIZE IDENTITY</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scrollContent: { padding: 25, paddingTop: 60 },
  backBtn: { marginBottom: 20, alignSelf: 'flex-start', padding: 10, backgroundColor: '#111', borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', letterSpacing: 2 },
  subtitle: { color: '#666', fontSize: 12, marginBottom: 40 },
  
  selectorContainer: { marginBottom: 25 },
  label: { color: '#00FF41', fontSize: 10, fontWeight: 'bold', marginBottom: 12, letterSpacing: 2 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#222', marginRight: 8, marginBottom: 8, backgroundColor: '#111' },
  optionBtnActive: { borderColor: '#00FF41', backgroundColor: 'rgba(0,255,65,0.1)' },
  optionText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
  optionTextActive: { color: '#00FF41' },

  input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#222', marginBottom: 40 },
  submitBtn: { backgroundColor: '#00FF41', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: '#00FF41', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  submitBtnText: { color: '#000', fontWeight: 'bold', letterSpacing: 1 }
});

export default InitializePlayer;
