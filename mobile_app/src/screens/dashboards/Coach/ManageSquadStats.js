import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const ManageSquadStats = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const API_URL = 'http://localhost:8002';

  useEffect(() => {
    fetchRoster();
  }, []);

  const fetchRoster = async () => {
    try {
      const teamId = await AsyncStorage.getItem('team_id');
      if (!teamId) {
        Alert.alert("Error", "No team found. Initialize a squad first.");
        navigation.goBack();
        return;
      }

      const token = await AsyncStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API_URL}/players/team/${teamId}`, { headers });
      setPlayers(response.data);
    } catch (error) {
      Alert.alert("Error", "Could not fetch squad roster.");
    } finally {
      setLoading(false);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SQUAD <Text style={styles.greenText}>ANALYTICS</Text></Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Select an operative to modify ballistic performance metrics.</Text>

        {players.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={60} color="#333" />
            <Text style={styles.emptyText}>No operatives recruited yet.</Text>
          </View>
        ) : (
          players.map((player) => (
            <TouchableOpacity 
              key={player.user_id} 
              style={styles.playerCard}
              onPress={() => navigation.navigate('EditPlayerStats', { playerId: player.user_id })}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.user_id.toUpperCase()}</Text>
                <Text style={styles.playerRole}>{player.player_type?.toUpperCase() || 'PLAYER'}</Text>
                
                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>MAX</Text>
                    <Text style={styles.metricValue}>{player.performance_stats?.top_speed_kph || 0} KPH</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>AVG</Text>
                    <Text style={styles.metricValue}>{player.performance_stats?.average_speed_kph || 0} KPH</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>RANK</Text>
                    <Text style={styles.metricValue}>#{player.squad_rank || '--'}</Text>
                  </View>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#00FF41" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#0a0a0a' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 20, letterSpacing: 2 },
  greenText: { color: '#00FF41' },
  scrollContent: { padding: 20 },
  subtitle: { color: '#666', fontSize: 12, marginBottom: 30, letterSpacing: 1, lineHeight: 18 },
  
  playerCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  playerInfo: { flex: 1 },
  playerName: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  playerRole: { color: '#444', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  
  metricsRow: { flexDirection: 'row', marginTop: 15, alignItems: 'center' },
  metric: { alignItems: 'flex-start' },
  metricLabel: { color: '#333', fontSize: 8, fontWeight: 'bold' },
  metricValue: { color: '#00FF41', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  metricDivider: { width: 1, height: 15, backgroundColor: '#222', marginHorizontal: 15 },
  
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#444', marginTop: 20, fontSize: 14 }
});

export default ManageSquadStats;
