import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, Modal, ImageBackground 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../theme';

const GlassCard = ({ children, style }) => (
  <View style={[styles.glassBase, style]}>
    {children}
  </View>
);

const ManageTeam = ({ route, navigation }) => {
  const [teamId, setTeamId] = useState(route.params?.teamId || null);
  const API_URL = 'http://localhost:8002';

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  
  const [pendingInvites, setPendingInvites] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [statsForm, setStatsForm] = useState({ wins: 0, losses: 0, draws: 0 });
  const [leaderForm, setLeaderForm] = useState({ captain_id: '', vice_captain_id: '' });
  
  const fetchTeamProfile = async (id) => {
    const activeId = id || teamId;
    if (!activeId || activeId === 'DEFAULT_ID') {
      const storedId = await AsyncStorage.getItem('team_id');
      if (!storedId) {
        Alert.alert("Registry Required", "No active squad detected.");
        navigation.goBack();
        return;
      }
      setTeamId(storedId);
      return fetchTeamProfile(storedId);
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/teams/${activeId}/full-profile`);
      setProfile(response.data);
      setStatsForm({
        wins: response.data.analytics.record ? parseInt(response.data.analytics.record.split('W')[0]) : 0,
        losses: response.data.analytics.record ? parseInt(response.data.analytics.record.split('-')[1].split('L')[0]) : 0,
        draws: response.data.analytics.record ? parseInt(response.data.analytics.record.split('-')[2].split('D')[0]) : 0,
      });
      setLeaderForm({
        captain_id: response.data.leadership.captain || '',
        vice_captain_id: response.data.leadership.vice_captain || ''
      });

      const invitesRes = await axios.get(`${API_URL}/teams/${activeId}/invites`, { headers });
      setPendingInvites(invitesRes.data);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Could not fetch team profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamProfile();
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.length > 2) {
        try {
          const res = await axios.get(`${API_URL}/players/search?query=${searchQuery}`);
          setSearchResults(Array.isArray(res.data) ? res.data : []);
        } catch (e) { setSearchResults([]); }
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const sendInvite = async (playerId) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(`${API_URL}/teams/${teamId}/invite/${playerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert("Invite Sent", "Invitation successfully dispatched.");
    } catch (error) {
      Alert.alert("Recruitment Failed", error.response?.data?.detail || "Something went wrong.");
    }
  };

  const cancelInvite = async (playerId, name) => {
    const confirmRevoke = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const activeTeamId = teamId || route.params?.teamId || await AsyncStorage.getItem('team_id');
        
        if (!activeTeamId || activeTeamId === 'DEFAULT_ID') {
          throw new Error("ACTIVE_SQUAD_ID_NOT_RESOLVED");
        }

        console.log(`[REVOKE] Team: ${activeTeamId}, Player: ${playerId}`);
        
        await axios.delete(`${API_URL}/teams/${activeTeamId}/invite/${playerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchTeamProfile();
        if (Platform.OS === 'web') {
          alert("Registry Updated: Invitation revoked.");
        } else {
          Alert.alert("Registry Updated", "Invitation revoked.");
        }
      } catch (err) {
        if (Platform.OS === 'web') {
          alert("Link Failure: Failed to revoke invitation.");
        } else {
          Alert.alert("Link Failure", "Failed to revoke invitation.");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to cancel the invitation for ${name}?`)) {
        confirmRevoke();
      }
    } else {
      Alert.alert(
        "REVOKE_INVITATION",
        `Are you sure you want to cancel the invitation for ${name}?`,
        [
          { text: "STAY", style: "cancel" },
          { text: "REVOKE", style: "destructive", onPress: confirmRevoke }
        ]
      );
    }
  };

  const handleRemovePlayer = async (pid, name) => {
    Alert.alert(
      "TERMINATE_MEMBERSHIP",
      `Remove ${name} from squad?`,
      [
        { text: "CANCEL", style: "cancel" },
        { 
          text: "REMOVE", 
          style: "destructive", 
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(`${API_URL}/teams/${teamId}/player/${pid}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              fetchTeamProfile(); 
              Alert.alert("Success", "Operative removed.");
            } catch (err) {
              Alert.alert("Purge Failure", "Failed to remove operative.");
            }
          }
        }
      ]
    );
  };

  const updateStats = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.patch(`${API_URL}/teams/${teamId}/stats`, statsForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowStatsModal(false);
      fetchTeamProfile();
    } catch (error) {
      Alert.alert("Error", "Could not update stats.");
    }
  };

  const updateLeadership = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.patch(`${API_URL}/teams/${teamId}/leadership`, leaderForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowLeaderModal(false);
      fetchTeamProfile();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.detail || "Could not update leadership.");
    }
  };

  if (loading || !profile) {
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
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>

          <GlassCard style={[styles.headerCard, Theme.glow]}>
            <Text style={styles.teamName}>{profile.identity.name.toUpperCase()}</Text>
            <Text style={styles.location}>{profile.identity.location}</Text>
            
            <View style={styles.statsRow}>
              <GlassCard style={styles.statBox}>
                <Text style={styles.statValue}>{profile.analytics.win_rate}</Text>
                <Text style={styles.statLabel}>WIN RATE</Text>
              </GlassCard>
              <GlassCard style={styles.statBox}>
                <Text style={styles.statValue}>{profile.analytics.record}</Text>
                <Text style={styles.statLabel}>RECORD</Text>
              </GlassCard>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowStatsModal(true)}>
                <MaterialCommunityIcons name="scoreboard" size={16} color="#00FF41" />
                <Text style={styles.outlineBtnText}> EDIT STATS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowLeaderModal(true)}>
                <MaterialCommunityIcons name="shield-account" size={16} color="#00FF41" />
                <Text style={styles.outlineBtnText}> LEADERSHIP</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>ACTIVE SQUAD ({profile.squad.length})</Text>
            {profile.squad.map(player => (
              <GlassCard key={player._id} style={styles.playerCard}>
                <TouchableOpacity 
                  style={{ flex: 1 }} 
                  onPress={() => navigation.navigate('EditPlayerStats', { playerId: player.user_id })}
                >
                  <Text style={styles.playerName}>
                    {player.name} 
                    {player._id === profile.leadership.captain && <Text style={styles.roleText}> (C)</Text>}
                    {player._id === profile.leadership.vice_captain && <Text style={styles.roleText}> (VC)</Text>}
                  </Text>
                  <View style={styles.playerMetricsRow}>
                    <Text style={styles.metricText}>MAX: <Text style={styles.metricValue}>{player.performance_stats?.top_speed_kph || 0} KPH</Text></Text>
                    <View style={styles.metricDivider} />
                    <Text style={styles.metricText}>AVG: <Text style={styles.metricValue}>{player.performance_stats?.average_speed_kph || 0} KPH</Text></Text>
                  </View>
                  <Text style={styles.playerId}>ID: {player._id.toUpperCase()}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => navigation.navigate('EditPlayerStats', { playerId: player.user_id })} style={{ marginRight: 15 }}>
                    <MaterialCommunityIcons name="chart-box-outline" size={22} color="#00FF41" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemovePlayer(player._id, player.name)}>
                    <MaterialCommunityIcons name="account-remove" size={22} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>

          {pendingInvites.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: '#f1c40f' }]}>PENDING INVITATIONS ({pendingInvites.length})</Text>
              {pendingInvites.map(invite => (
                <GlassCard key={invite._id} style={[styles.playerCard, { borderLeftColor: '#f1c40f', borderLeftWidth: 4 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{invite.name}</Text>
                    <Text style={styles.playerId}>{invite.email}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <GlassCard style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>AWAITING ACCEPTANCE</Text>
                    </GlassCard>
                    <TouchableOpacity 
                      onPress={() => cancelInvite(invite._id, invite.name)}
                      style={styles.cancelInviteBtn}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                      <MaterialCommunityIcons name="close-circle" size={24} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>SCOUT & RECRUIT</Text>
            <GlassCard style={styles.searchBar}>
              <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
              <TextInput 
                style={styles.searchInput}
                placeholder="Search players by name/ID..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                onChangeText={setSearchQuery}
              />
            </GlassCard>

            {searchResults.map((item) => (
              <GlassCard key={item._id} style={styles.playerCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <Text style={styles.playerEmail}>{item.email || "No Email"}</Text>
                  <Text style={styles.playerId}>ID: {item._id.toUpperCase()}</Text>
                </View>
                <TouchableOpacity style={styles.inviteBtn} onPress={() => sendInvite(item._id)}>
                  <Text style={styles.inviteBtnText}>INVITE</Text>
                </TouchableOpacity>
              </GlassCard>
            ))}
          </View>

        </ScrollView>

        <Modal visible={showStatsModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalHeader}>UPDATE MATCH RECORD</Text>
              
              <Text style={styles.label}>WINS</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={statsForm.wins.toString()} onChangeText={t => setStatsForm({...statsForm, wins: parseInt(t)||0})} />
              
              <Text style={styles.label}>LOSSES</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={statsForm.losses.toString()} onChangeText={t => setStatsForm({...statsForm, losses: parseInt(t)||0})} />
              
              <Text style={styles.label}>DRAWS</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={statsForm.draws.toString()} onChangeText={t => setStatsForm({...statsForm, draws: parseInt(t)||0})} />

              <TouchableOpacity style={styles.submitBtn} onPress={updateStats}><Text style={styles.submitBtnText}>SAVE STATS</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}><Text style={styles.closeText}>CANCEL</Text></TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        <Modal visible={showLeaderModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalHeader}>ASSIGN LEADERSHIP</Text>
              <Text style={styles.helperText}>Tap role identifiers to assign.</Text>
              
              <View style={{ marginBottom: 20, alignItems: 'center' }}>
                <Text style={styles.label}>COMMAND STRUCTURE:</Text>
                <Text style={{ color: '#00FF41', fontWeight: 'bold', fontSize: 10 }}>
                  CAPTAIN: {profile.squad.find(p => p._id === leaderForm.captain_id)?.name || "NONE"}
                </Text>
              </View>

              <ScrollView style={{ maxHeight: 250, marginBottom: 20 }}>
                {profile.squad.map(player => (
                  <GlassCard key={player._id} style={styles.miniPlayerItem}>
                    <Text style={{ color: '#fff', flex: 1, fontSize: 11, fontWeight: 'bold' }}>{player.name}</Text>
                    <TouchableOpacity 
                      style={[styles.roleMiniBtn, leaderForm.captain_id === player._id && styles.roleMiniBtnActive]} 
                      onPress={() => setLeaderForm({...leaderForm, captain_id: player._id})}
                    >
                      <Text style={styles.roleMiniText}>C</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.roleMiniBtn, leaderForm.vice_captain_id === player._id && styles.roleMiniBtnActive]} 
                      onPress={() => setLeaderForm({...leaderForm, vice_captain_id: player._id})}
                    >
                      <Text style={styles.roleMiniText}>VC</Text>
                    </TouchableOpacity>
                  </GlassCard>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.submitBtn} onPress={updateLeadership}><Text style={styles.submitBtnText}>CONFIRM ROLES</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowLeaderModal(false)}><Text style={styles.closeText}>CANCEL</Text></TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  scrollContent: { padding: 20, paddingTop: 60 },
  
  glassBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  backBtn: { marginBottom: 25, alignSelf: 'flex-start', padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerCard: { padding: 25, marginBottom: 35 },
  teamName: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  location: { color: '#fff', fontSize: 10, opacity: 0.5, marginBottom: 20, fontWeight: 'bold' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statBox: { alignItems: 'center', padding: 18, flex: 0.48 },
  statValue: { color: '#00FF41', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#fff', fontSize: 8, marginTop: 5, letterSpacing: 1, opacity: 0.4 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  outlineBtn: { flex: 0.48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderWidth: 1, borderColor: '#00FF41', borderRadius: 12, backgroundColor: 'rgba(0, 255, 65, 0.05)' },
  outlineBtnText: { color: '#00FF41', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  section: { marginBottom: 35 },
  sectionHeader: { color: '#00FF41', fontSize: 10, fontWeight: '900', marginBottom: 15, letterSpacing: 2, opacity: 0.6 },
  playerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, marginBottom: 12 },
  playerName: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  roleText: { color: '#00FF41', fontSize: 10, fontWeight: '900' },
  playerMetricsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metricText: { color: '#fff', fontSize: 9, fontWeight: 'bold', opacity: 0.4 },
  metricValue: { color: '#00FF41', opacity: 1 },
  metricDivider: { width: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 10 },
  playerEmail: { color: '#00FF41', fontSize: 9, marginTop: 4, opacity: 0.7 },
  playerId: { color: '#fff', fontSize: 8, marginTop: 6, opacity: 0.3 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 20 },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 12, marginLeft: 12, fontSize: 11, fontWeight: 'bold' },
  inviteBtn: { backgroundColor: '#00FF41', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  inviteBtnText: { color: '#000', fontWeight: '900', fontSize: 11 },
  
  pendingBadge: { backgroundColor: 'rgba(241, 196, 15, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#f1c40f' },
  pendingBadgeText: { color: '#f1c40f', fontSize: 7, fontWeight: '900' },
  cancelInviteBtn: { marginLeft: 15, padding: 10, backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.2)' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', padding: 25 },
  modalHeader: { fontSize: 16, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  helperText: { color: '#fff', fontSize: 9, marginBottom: 20, textAlign: 'center', fontStyle: 'italic', opacity: 0.4 },
  label: { color: '#fff', fontSize: 8, fontWeight: '900', marginBottom: 10, letterSpacing: 1, opacity: 0.5 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 15, fontSize: 12, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#00FF41', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#000', fontWeight: '900', letterSpacing: 1 },
  closeText: { color: '#fff', textAlign: 'center', marginTop: 20, fontSize: 10, opacity: 0.4, fontWeight: 'bold' },
  
  miniPlayerItem: { flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 10 },
  roleMiniBtn: { width: 35, height: 35, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginLeft: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  roleMiniBtnActive: { backgroundColor: '#00FF41', borderColor: '#00FF41' },
  roleMiniText: { color: '#fff', fontSize: 9, fontWeight: '900' }
});

export default ManageTeam;
