import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, RefreshControl, Dimensions, Image, Platform, Modal 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Theme } from '../../../theme';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

const PlayerDashboard = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [neuralAdvice, setNeuralAdvice] = useState(null);
  const API_URL = 'http://localhost:8002';

  const handleLogout = async () => {
    const performLogout = async () => {
      await AsyncStorage.clear();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm("TERMINATE SESSION: Decouple neural link?")) {
        await performLogout();
      }
    } else {
      Alert.alert("TERMINATE", "Decouple neural link?", [
        { text: "ABORT", style: "cancel" },
        { text: "CONFIRM", onPress: performLogout, style: "destructive" }
      ]);
    }
  };

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userId = await AsyncStorage.getItem('user_id');
      
      if (!token) {
        Alert.alert("Security Alert", "Session token missing. Please re-authenticate.");
        navigation.replace('Login');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Player Stats securely
      const playerRes = await axios.get(`${API_URL}/players/${userId}`, { headers });
      setPlayerData(playerRes.data);

      // 2. Fetch Analysis History
      const analysisRes = await axios.get(`${API_URL}/videos/my-analysis`, { headers });
      setAnalysisHistory(analysisRes.data);
      
      // 3. Fetch Neural Advice
      try {
        const adviceRes = await axios.get(`${API_URL}/players/me/neural-advice`, { headers });
        setNeuralAdvice(adviceRes.data.advice);
      } catch (e) { console.log("NEURAL_ADVICE_SYNC_ERROR", e); }

    } catch (error) {
      console.log("PLAYER_DASHBOARD_ERROR:", error);
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 404) {
        // Player profile doesn't exist yet
        setPlayerData({ notInitialized: true });
      } else if (status === 401) {
        Alert.alert("Session Expired", "Your security link has been terminated. Please login again.");
        navigation.replace('Login');
      } else {
        Alert.alert("Telemetry Sync Failed", detail || "Could not connect to Regent AI network.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const acceptInvite = async (teamId, teamName) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(`${API_URL}/players/accept-invite/${teamId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert("Success", `You have officially joined ${teamName}!`);
      fetchData(); // Refresh to show new team
    } catch (error) {
      Alert.alert("Error", error.response?.data?.detail || "Could not join team.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00FF41" />
        <Text style={styles.loadingText}>SYNCING BIOMETRICS...</Text>
      </View>
    );
  }

  if (!playerData) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="wifi-off" size={64} color="#ff4444" />
        <Text style={[styles.loadingText, { color: '#ff4444', marginTop: 20 }]}>NEURAL LINK DISCONNECTED</Text>
        <TouchableOpacity 
          style={[styles.initializeBtn, { marginTop: 30, borderColor: '#ff4444' }]} 
          onPress={fetchData}
        >
          <Text style={[styles.initializeBtnText, { color: '#ff4444' }]}>RE-ESTABLISH LINK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (playerData?.notInitialized) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-alert" size={80} color="#666" />
          <Text style={styles.noProfileTitle}>IDENTITY NOT FOUND</Text>
          <Text style={styles.noProfileDesc}>
            Your cricket profile hasn't been initialized. Set up your specialty and stats to start your journey.
          </Text>
          <TouchableOpacity 
            style={styles.initializeBtn}
            onPress={() => navigation.navigate('InitializePlayer')}
          >
            <Text style={styles.initializeBtnText}>CREATE CRICKET IDENTITY</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = playerData?.performance_stats || {};

  const handleLeaveTeam = () => {
    Alert.alert(
      "VOLUNTARY_RESIGNATION",
      "Are you sure you want to resign from your current squad? This will terminate your access to team comms and telemetry.",
      [
        { text: "CANCEL", style: "cancel" },
        { 
          text: "RESIGN", 
          style: "destructive", 
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.post(`${API_URL}/teams/leave`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
              fetchData(); // Refresh to reflect "No Team" status
              Alert.alert("Status Updated", "You are now an independent operative.");
            } catch (err) {
              Alert.alert("Process Failed", "Could not complete resignation.");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF41" />}
      >
        {/* PLAYER HEADER */}
        <View style={styles.header}>
          <View style={styles.brandingRow}>
            <Image source={require('../../../../assets/logo.png')} style={styles.miniLogo} resizeMode="contain" />
            <View>
              <Text style={styles.welcomeText}>OPERATIVE STATUS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.playerName}>{playerData.player_type?.toUpperCase() || 'PLAYER'}</Text>
                {playerData.leadership_role && (
                  <View style={styles.leadershipBadge}>
                    <Text style={styles.leadershipBadgeText}>{playerData.leadership_role}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {playerData.team_id && (
              <TouchableOpacity 
                style={[styles.settingsBtn, { marginRight: 10, borderColor: '#ff9500' }]} 
                onPress={handleLeaveTeam}
              >
                <MaterialCommunityIcons name="exit-run" size={22} color="#ff9500" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.settingsBtn, { marginRight: 10, borderColor: '#ff4444' }]} 
              onPress={handleLogout}
            >
              <MaterialCommunityIcons name="power" size={22} color="#ff4444" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Security')}>
              <MaterialCommunityIcons name="cog" size={24} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* TEAM INVITATIONS BANNER */}
        {playerData.invitations?.length > 0 && (
          <View style={styles.invitationBox}>
            <View style={styles.invitationHeader}>
              <MaterialCommunityIcons name="email-alert" size={20} color="#000" />
              <Text style={styles.invitationTitle}>PENDING SQUAD RECRUITMENTS ({playerData.invitations.length})</Text>
            </View>
            {playerData.invitations.map((inv, index) => (
              <View key={index} style={styles.inviteItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteTeamName}>{inv.team_name}</Text>
                  <Text style={styles.inviteCode}>CODE: {inv.invite_code}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.acceptBtn} 
                  onPress={() => acceptInvite(inv.team_id, inv.team_name)}
                >
                  <Text style={styles.acceptBtnText}>ACCEPT</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* PHYSICS SNAPSHOT (TOP SPEED / AI STATS) */}
        <View style={styles.physicsCard}>
          <View style={styles.physicsHeader}>
            <View style={styles.physicsHeaderLeft}>
              <MaterialCommunityIcons name="molecule" size={20} color="#00FF41" />
              <Text style={styles.sectionTitle}>BIOMETRIC PERFORMANCE</Text>
            </View>
            {playerData.squad_rank && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>RANK #{playerData.squad_rank}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.physicsGrid}>
            <View style={styles.physicsItem}>
              <Text style={styles.physicsValue}>{stats.top_speed_kph || '0.0'}</Text>
              <Text style={styles.physicsLabel}>MAX KPH</Text>
            </View>
            <View style={[styles.physicsItem, { borderLeftWidth: 1, borderColor: '#222' }]}>
              <Text style={styles.physicsValue}>{stats.average_speed_kph || '0.0'}</Text>
              <Text style={styles.physicsLabel}>AVG KPH</Text>
            </View>
          </View>
        </View>

        {/* NEURAL INSIGHTS */}
        {playerData.ai_suggestions && playerData.ai_suggestions.length > 0 && (
          <View style={styles.insightBox}>
            <View style={styles.insightHeader}>
              <MaterialCommunityIcons name="brain" size={20} color="#00FF41" />
              <Text style={styles.insightTitle}>NEURAL INSIGHTS</Text>
            </View>
            {playerData.ai_suggestions.map((insight, idx) => (
              <View key={idx} style={styles.insightItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#00FF41" />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}
        {/* NEURAL ADVISORY (GEMINI-POWERED) */}
        {neuralAdvice && (
          <View style={styles.adviceBanner}>
            <View style={styles.adviceHeader}>
              <MaterialCommunityIcons name="robot" size={20} color="#00FF41" />
              <Text style={styles.adviceTitle}>NEURAL_ADVISORY_FEED</Text>
            </View>
            <Text style={styles.adviceText}>{neuralAdvice}</Text>
          </View>
        )}

        {/* CORE STATS */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL RUNS</Text>
            <Text style={styles.statValue}>{stats.total_runs || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>WICKETS</Text>
            <Text style={styles.statValue}>{stats.wickets || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG</Text>
            <Text style={styles.statValue}>{stats.batting_average || '0.0'}</Text>
          </View>
        </View>

        {/* SQUAD COMMS */}
        {playerData.team_id && (
          <TouchableOpacity 
            style={styles.commsBtn} 
            onPress={() => navigation.navigate('SquadChat', { teamId: playerData.team_id })}
          >
            <MaterialCommunityIcons name="access-point" size={24} color="#000" />
            <Text style={styles.commsBtnText}>ENTER SQUAD COMMS</Text>
          </TouchableOpacity>
        )}

        {/* AI ANALYSIS HISTORY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT AI SESSIONS</Text>
          {analysisHistory.length === 0 ? (
            <View style={styles.emptyAnalysis}>
              <MaterialCommunityIcons name="video-off" size={40} color="#333" />
              <Text style={styles.emptyText}>No AI analysis sessions recorded yet.</Text>
            </View>
          ) : (
            analysisHistory.map((item, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.analysisItem}
                onPress={() => {
                  setSelectedVideo(item);
                  setShowVideoModal(true);
                }}
              >
                <View style={styles.analysisIcon}>
                  <MaterialCommunityIcons name="video-check" size={24} color="#00FF41" />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.analysisTitle}>SESSION #{analysisHistory.length - idx}</Text>
                  <Text style={styles.analysisDate}>
                    {(() => {
                      const expiry = new Date(new Date(item.created_at).getTime() + 24 * 60 * 60 * 1000);
                      const diff = expiry - new Date();
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      return diff > 0 ? `Expires in ${hours}h ${mins}m` : 'Expired';
                    })()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.analysisSpeed}>{item.top_speed_kph} KPH</Text>
                  <Text style={styles.analysisScore}>SCORE: {item.form_score}%</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <View style={styles.logoutContent}>
            <Text style={styles.logoutText}>TERMINATE SESSION</Text>
            <MaterialCommunityIcons name="power" size={20} color="#ff4444" />
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* NEURAL OVERLAY MODAL */}
      <Modal visible={showVideoModal} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>NEURAL_PLAYBACK</Text>
              <Text style={styles.modalSession}>SESSION #{analysisHistory.length - (analysisHistory.indexOf(selectedVideo))}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowVideoModal(false)}>
              <MaterialCommunityIcons name="close" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.videoWrapper}>
            {selectedVideo && (
              <Video
                source={{ uri: selectedVideo.annotated_video_url }}
                rate={1.0}
                volume={1.0}
                isMuted={false}
                resizeMode="contain"
                shouldPlay
                useNativeControls
                style={styles.videoPlayer}
              />
            )}
          </View>

          <View style={styles.modalStats}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatVal}>{selectedVideo?.metrics?.ball_speed_kph} KPH</Text>
              <Text style={styles.miniStatLab}>VELOCITY</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatVal}>{selectedVideo?.metrics?.elbow_extension_angle}°</Text>
              <Text style={styles.miniStatLab}>EXTENSION</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatVal}>{selectedVideo?.form_score}%</Text>
              <Text style={styles.miniStatLab}>FORM_SCORE</Text>
            </View>
          </View>

          <ScrollView style={styles.insightScroll}>
             <Text style={styles.insightHeader}>PERSONAL_NEURAL_INSIGHTS:</Text>
             {selectedVideo?.ai_suggestions.map((insight, i) => (
               <View key={i} style={styles.insightItem}>
                 <MaterialCommunityIcons name="lightbulb-on" size={16} color="#00FF41" />
                 <Text style={styles.insightText}>{insight}</Text>
               </View>
             ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scrollContent: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#00FF41', marginTop: 10, letterSpacing: 2, fontSize: 10, fontWeight: 'bold' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  brandingRow: { flexDirection: 'row', alignItems: 'center' },
  miniLogo: { width: 40, height: 40, marginRight: 12 },
  welcomeText: { color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  playerName: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  leadershipBadge: { 
    backgroundColor: '#00FF41', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 4, 
    marginLeft: 10 
  },
  leadershipBadgeText: { 
    color: '#000', 
    fontSize: 8, 
    fontWeight: '900', 
    letterSpacing: 1 
  },
  settingsBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },

  invitationBox: { 
    backgroundColor: '#111', 
    borderRadius: 15, 
    padding: 20, 
    marginBottom: 25, 
    borderWidth: 2, 
    borderColor: '#00FF41',
    shadowColor: '#00FF41',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10
  },
  invitationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  invitationTitle: { color: '#00FF41', fontSize: 11, fontWeight: 'bold', marginLeft: 8, letterSpacing: 1 },
  inviteItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1a1a1a', 
    padding: 15, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  inviteTeamName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  inviteCode: { color: '#666', fontSize: 10, marginTop: 2 },
  acceptBtn: { backgroundColor: '#00FF41', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  acceptBtnText: { color: '#000', fontWeight: 'bold', fontSize: 12 },

  physicsCard: { backgroundColor: '#0a0a0a', borderRadius: 15, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#1a1a1a', borderTopWidth: 4, borderTopColor: '#00FF41' },
  physicsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  physicsHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  rankBadge: { backgroundColor: '#00FF41', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  rankBadgeText: { color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  physicsGrid: { flexDirection: 'row' },
  physicsItem: { flex: 1, alignItems: 'center' },
  physicsValue: { color: '#fff', fontSize: 36, fontWeight: '900' },
  physicsLabel: { color: '#00FF41', fontSize: 9, fontWeight: 'bold', marginTop: 5, letterSpacing: 1 },

  insightBox: { backgroundColor: '#111', borderRadius: 15, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  insightTitle: { color: '#00FF41', fontSize: 12, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  insightText: { flex: 1, color: '#ccc', fontSize: 12, marginLeft: 10, lineHeight: 18 },

  adviceBanner: { backgroundColor: 'rgba(255, 149, 0, 0.05)', borderRadius: 15, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.2)', borderLeftWidth: 5, borderLeftColor: '#FF9500' },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  adviceTitle: { color: '#FF9500', fontSize: 10, fontWeight: '900', marginLeft: 10, letterSpacing: 2 },
  adviceText: { color: '#fff', fontSize: 13, lineHeight: 22, fontStyle: 'italic' },

  commsBtn: {
    backgroundColor: '#00FF41',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginVertical: 20,
    marginHorizontal: 5
  },
  commsBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    marginLeft: 10
  },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { width: (width - 60) / 3, backgroundColor: '#0f0f0f', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#151515' },
  statLabel: { color: '#444', fontSize: 8, fontWeight: 'bold', marginBottom: 5 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  section: { marginBottom: 30 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  emptyAnalysis: { backgroundColor: '#0f0f0f', padding: 30, borderRadius: 15, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#222' },
  emptyText: { color: '#444', fontSize: 12, marginBottom: 15 },
  uploadLink: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#00FF41' },
  uploadLinkText: { color: '#00FF41', fontSize: 10, fontWeight: 'bold' },

  analysisItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  analysisIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  analysisTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  analysisDate: { color: '#FF9500', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  analysisSpeed: { color: '#00FF41', fontSize: 14, fontWeight: 'bold' },
  analysisScore: { color: '#888', fontSize: 10 },

  noProfileTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 20 },
  noProfileDesc: { color: '#666', fontSize: 14, textAlign: 'center', paddingHorizontal: 40, marginTop: 10, lineHeight: 20 },
  initializeBtn: { backgroundColor: '#00FF41', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, marginTop: 30 },
  initializeBtnText: { color: '#000', fontWeight: 'bold', letterSpacing: 1 },
  logoutBtn: { 
    borderWidth: 1, 
    borderColor: '#FF4444', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: 'rgba(255, 68, 68, 0.05)'
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoutText: { color: '#FF4444', fontWeight: '900', fontSize: 13, letterSpacing: 2, marginRight: 10 },

  // MODAL STYLES
  modalContainer: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, marginBottom: 20 },
  modalTitle: { color: '#00FF41', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  modalSession: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 4 },
  videoWrapper: { width: width, height: width * 0.75, backgroundColor: '#0a0a0a' },
  videoPlayer: { flex: 1 },
  modalStats: { flexDirection: 'row', justifyContent: 'space-around', padding: 25, borderBottomWidth: 1, borderBottomColor: '#111' },
  miniStat: { alignItems: 'center' },
  miniStatVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  miniStatLab: { color: '#444', fontSize: 8, fontWeight: '900', marginTop: 4 },
  insightScroll: { flex: 1, padding: 25 },
  insightHeader: { color: '#00FF41', fontSize: 9, fontWeight: '900', marginBottom: 15, letterSpacing: 2 },
  insightItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#080808', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#111' },
  insightText: { color: '#ddd', fontSize: 11, marginLeft: 12, flex: 1, lineHeight: 18 }
});

export default PlayerDashboard;
