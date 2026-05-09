import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, ImageBackground 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Theme } from '../../theme';

const API_URL = 'http://localhost:8002'; 

const GlassCard = ({ children, style }) => (
  <View style={[styles.glassBase, style]}>
    {children}
  </View>
);

const CreateTeam = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]); 
  const [pendingInvites, setPendingInvites] = useState([]); 
  const [isCoachAuth, setIsCoachAuth] = useState(false);
  
  const [teamData, setTeamData] = useState({
    name: '',
    team_logo: '', 
    location: '',
    description: '', 
    captain_id: '', 
    vice_captain_id: '', 
    coach_id: '', 
    player_ids: [],
    invite_code: '', 
    max_squad_size: 20, 
    matches_played: 0,
    wins: 0,
    losses: 0,
    draws: 0
  });

  const generateInviteCode = (name = '') => {
    const prefix = name ? name.substring(0, 4).toUpperCase().replace(/\s/g, '') : 'TEAM';
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newCode = `${prefix}-${randomSuffix}`;
    setTeamData(prev => ({ ...prev, invite_code: newCode }));
  };

  useEffect(() => {
    generateInviteCode();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = await AsyncStorage.getItem('user_id'); 
        const userRole = await AsyncStorage.getItem('user_role'); 
        if (userRole === 'coach' && userId) {
          setIsCoachAuth(true);
          setTeamData(prev => ({ ...prev, coach_id: userId }));
        }
      } catch (error) {
        console.error("Error fetching auth data:", error);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length > 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async () => {
    try {
      const response = await axios.get(`${API_URL}/players/search?query=${searchQuery}`);
      if (response.data && Array.isArray(response.data)) {
        const filtered = response.data.filter(p => 
          !pendingInvites.some(pi => String(pi._id) === String(p._id))
        );
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    }
  };

  const handleInvitePlayer = (player) => {
    if (pendingInvites.length >= 20) {
      Alert.alert("Squad limit reached", "Maximum 20 players per squad.");
      return;
    }
    setPendingInvites([...pendingInvites, player]);
    setSearchResults(prev => prev.filter(p => p._id !== player._id));
    Alert.alert("Request Sent", `Auth request sent to ${player.name}.`);
    setSearchQuery('');
  };

  const removePendingInvite = (playerId) => {
    setPendingInvites(prev => prev.filter(p => p._id !== playerId));
  };

  const submitTeam = async () => {
    if (!teamData.name || !teamData.invite_code) {
      Alert.alert("Error", "Team Name and Invite Code are required.");
      return;
    }
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert("Authentication Required", "Session expired.");
        navigation.replace('Login');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API_URL}/teams/`, teamData, { headers });
      const newTeamId = response.data._id || response.data.id;
      
      if (newTeamId && pendingInvites.length > 0) {
        for (const player of pendingInvites) {
          try {
            await axios.post(`${API_URL}/teams/${newTeamId}/invite/${player._id}`, {}, { headers });
          } catch (err) {
            console.error(`Failed to invite ${player.name}`, err);
          }
        }
      }

      Alert.alert("Success", "Squad initialized!", [
        { text: "FINISH", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert("Initialization Failed", error.response?.data?.detail || "Check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={require('../../../assets/neural_bg.png')} 
      style={styles.container}
    >
      <View style={styles.overlay}>
        <View style={styles.headerControlBar}>
          <Text style={styles.header}>INITIALIZE<Text style={styles.green}>_SQUAD</Text></Text>
          <GlassCard style={styles.zoomControls}>
            <Text style={styles.zoomVal}>50%</Text>
            <TouchableOpacity style={styles.zoomBtn}><MaterialCommunityIcons name="minus" size={14} color="#00FF41" /></TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn}><MaterialCommunityIcons name="plus" size={14} color="#00FF41" /></TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn}><Text style={styles.resetText}>RESET</Text></TouchableOpacity>
          </GlassCard>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.sectionTitle}>TEAM_IDENTITY</Text>
          <GlassCard style={[styles.sectionCard, Theme.glow]}>
            <Text style={styles.label}>TEAM_NAME *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. THE REGENTS"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={teamData.name}
              onChangeText={(txt) => {
                setTeamData({...teamData, name: txt});
                if(teamData.invite_code.startsWith('TEAM')) generateInviteCode(txt);
              }}
            />

            <Text style={styles.label}>TEAM_LOGO_URL</Text>
            <View style={styles.urlInputRow}>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                placeholder="https://cloud.regent.ai/logo.png"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={teamData.team_logo}
                onChangeText={(txt) => setTeamData({...teamData, team_logo: txt})}
              />
              <MaterialCommunityIcons name="cloud-upload-outline" size={20} color="rgba(255,255,255,0.3)" style={{ marginLeft: 15 }} />
            </View>

            <Text style={styles.label}>LOCATION</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. FAISALABAD, PK"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={teamData.location}
              onChangeText={(txt) => setTeamData({...teamData, location: txt})}
            />

            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput 
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
              placeholder="Primary operative club objectives..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline={true}
              value={teamData.description}
              onChangeText={(txt) => setTeamData({...teamData, description: txt})}
            />
          </GlassCard>

          <Text style={styles.sectionTitle}>LEADERSHIP_&_CONFIG</Text>
          <GlassCard style={styles.sectionCard}>
            <Text style={styles.label}>CAPTAIN_OPERATIVE_ID {isCoachAuth ? "(OPTIONAL)" : "*"}</Text>
            <TextInput 
              style={styles.input} 
              placeholder={isCoachAuth ? "ASSIGN_LATER" : "e.g. OP_SAAD_11"}
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={teamData.captain_id}
              onChangeText={(txt) => setTeamData({...teamData, captain_id: txt})}
            />

            <Text style={styles.label}>VICE_CAPTAIN_ID</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. OP_SAMAD_02"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={teamData.vice_captain_id}
              onChangeText={(txt) => setTeamData({...teamData, vice_captain_id: txt})}
            />

            <Text style={styles.label}>NEURAL_LINK_STATUS</Text>
            <View style={[styles.input, styles.statusWell]}>
              <Text style={styles.statusText}>
                <MaterialCommunityIcons name="check-decagram" size={14} color="#00FF41" /> COCH_AUTH: {teamData.coach_id.toUpperCase().slice(-8)}
              </Text>
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>INVITE_&_ROSTER</Text>
          <GlassCard style={styles.sectionCard}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 20 }}>
                <Text style={styles.label}>INVITE_CODE *</Text>
                <GlassCard style={styles.codeWell}>
                  <Text style={styles.inviteCodeText}>{teamData.invite_code}</Text>
                  <TouchableOpacity onPress={() => generateInviteCode(teamData.name)}>
                      <MaterialCommunityIcons name="refresh-circle" size={24} color="#00FF41" />
                  </TouchableOpacity>
                </GlassCard>
              </View>
              <View style={{ width: 80 }}>
                <Text style={styles.label}>MAX_SIZE</Text>
                <TextInput 
                  style={[styles.input, { textAlign: 'center', color: '#00FF41' }]} 
                  keyboardType="numeric"
                  value={teamData.max_squad_size.toString()}
                  onChangeText={(txt) => setTeamData({...teamData, max_squad_size: parseInt(txt) || 0})}
                />
              </View>
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>INITIAL_ROSTER_RECRUITMENT</Text>
          <GlassCard style={styles.sectionCard}>
            <View style={styles.searchBar}>
              <MaterialCommunityIcons name="account-search-outline" size={20} color="rgba(255,255,255,0.3)" />
              <TextInput 
                style={styles.searchInput}
                placeholder="Search operatives by name or ID..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity onPress={handleSearch} style={styles.goBtn}>
                <MaterialCommunityIcons name="arrow-right-bold-circle" size={28} color="#00FF41" />
              </TouchableOpacity>
            </View>

            {searchResults.map((item) => (
              <GlassCard key={item._id} style={styles.playerCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{item.name.toUpperCase()}</Text>
                  <Text style={styles.playerId}>ID: {item._id.toUpperCase()}</Text>
                </View>
                <TouchableOpacity style={styles.inviteBtn} onPress={() => handleInvitePlayer(item)}>
                  <Text style={styles.inviteBtnText}>INVITE</Text>
                </TouchableOpacity>
              </GlassCard>
            ))}

            {pendingInvites.length > 0 && (
              <View style={styles.pendingContainer}>
                <Text style={styles.label}>DISPATCH_LIST ({pendingInvites.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {pendingInvites.map((player) => (
                    <GlassCard key={player._id} style={styles.pendingChip}>
                      <Text style={styles.pendingName}>{player.name.split(' ')[0].toUpperCase()}</Text>
                      <TouchableOpacity onPress={() => removePendingInvite(player._id)}>
                        <MaterialCommunityIcons name="close-circle" size={16} color="#ff4444" />
                      </TouchableOpacity>
                    </GlassCard>
                  ))}
                </ScrollView>
              </View>
            )}
          </GlassCard>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.disabledBtn]} 
            onPress={submitTeam} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>CONFIRM_&_DISPATCH</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  scrollContent: { padding: 20, paddingTop: 20 },
  glassBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  header: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  green: { color: '#00FF41' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  zoomVal: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginRight: 10, opacity: 0.6 },
  zoomBtn: { paddingHorizontal: 8 },
  resetText: { color: '#00FF41', fontSize: 8, fontWeight: '900', marginLeft: 5 },
  sectionTitle: { color: '#00FF41', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginLeft: 5, opacity: 0.6 },
  sectionCard: { padding: 25, marginBottom: 30 },
  label: { color: '#fff', fontSize: 8, fontWeight: '900', marginBottom: 10, opacity: 0.3, letterSpacing: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.03)', color: '#fff', padding: 18, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20, fontSize: 12, fontWeight: 'bold' },
  urlInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statusWell: { backgroundColor: 'rgba(0, 255, 65, 0.05)', borderColor: '#00FF41', borderWidth: 1 },
  statusText: { color: '#00FF41', fontWeight: '900', fontSize: 10 },
  row: { flexDirection: 'row' },
  codeWell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'rgba(0, 255, 65, 0.05)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0, 255, 65, 0.2)' },
  inviteCodeText: { color: '#00FF41', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 15, borderRadius: 15, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 18, marginLeft: 12, fontSize: 11, fontWeight: 'bold' },
  goBtn: { marginLeft: 10 },
  playerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, marginBottom: 12 },
  playerName: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  playerId: { color: '#fff', fontSize: 8, marginTop: 4, opacity: 0.3 },
  inviteBtn: { backgroundColor: '#00FF41', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  inviteBtnText: { color: '#000', fontWeight: '900', fontSize: 11 },
  pendingContainer: { marginTop: 10 },
  pendingChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, marginRight: 12, borderRadius: 12 },
  pendingName: { color: '#fff', fontSize: 10, fontWeight: '900', marginRight: 8 },
  submitBtn: { backgroundColor: '#00FF41', padding: 22, borderRadius: 15, alignItems: 'center', marginTop: 10, marginBottom: 80 },
  submitBtnText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 14 },
  disabledBtn: { opacity: 0.5 }
});

export default CreateTeam;
