import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Image, Dimensions, Platform, Alert, 
  Modal, ImageBackground 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Sidebar from '../../../components/Sidebar';
import { Theme } from '../../../theme';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

const GlassCard = ({ children, style }) => (
  <View style={[styles.glassBase, style]}>
    {children}
  </View>
);

const CoachDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState(null);
  const [noTeam, setNoTeam] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recentAnalysis, setRecentAnalysis] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [squadBriefing, setSquadBriefing] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);

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

  useEffect(() => {
    AsyncStorage.getItem('user_role').then(role => setUserRole(role));
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      const teamRes = await axios.get(`${API_URL}/teams/coach/${userId}`);
      if (teamRes.data) {
        setTeamData(teamRes.data);
        const teamId = String(teamRes.data._id);
        await AsyncStorage.setItem('team_id', teamId);
        setNoTeam(false);

        try {
          const token = await AsyncStorage.getItem('userToken');
          const analysisRes = await axios.get(`${API_URL}/analysis/team/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setRecentAnalysis(analysisRes.data);
        } catch (e) { console.log("ANALYSIS_ERROR", e); }

        try {
          const token = await AsyncStorage.getItem('userToken');
          const briefingRes = await axios.get(`${API_URL}/teams/${teamId}/neural-briefing`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSquadBriefing(briefingRes.data.briefing);
        } catch (e) { console.log("BRIEFING_ERROR", e); }

        try {
          const token = await AsyncStorage.getItem('userToken');
          const invitesRes = await axios.get(`${API_URL}/teams/${teamId}/invites`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setPendingInvites(invitesRes.data);
        } catch (e) { console.log("INVITES_ERROR", e); }
      }
    } catch (error) {
      if (error.response?.status === 404) setNoTeam(true);
    } finally {
      setLoading(false);
    }
  };

  const cancelInvite = async (playerId, name) => {
    const confirmRevoke = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const activeTeamId = teamData?._id || await AsyncStorage.getItem('team_id');
        
        if (!activeTeamId) throw new Error("SQUAD_ID_NOT_FOUND");

        await axios.delete(`${API_URL}/teams/${activeTeamId}/invite/${playerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchDashboardData();
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

  const StatCard = ({ title, value, icon, color }) => (
    <GlassCard style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </GlassCard>
  );

  const QuickAction = ({ title, icon, onPress, color = "#00FF41" }) => (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <GlassCard style={[styles.iconCircle, { borderColor: color }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </GlassCard>
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00FF41" size="large" />
      </View>
    );
  }

  const renderNoTeamView = () => (
    <View style={styles.mainContent}>
      <View style={styles.header}>
        <View style={styles.brandingRow}>
          <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuTrigger}>
            <MaterialCommunityIcons name="menu" size={28} color={Theme.colors.primary} />
          </TouchableOpacity>
          <Image source={require('../../../../assets/logo.png')} style={styles.miniLogo} resizeMode="contain" />
          <View>
            <Text style={styles.greeting}>COMMANDER_MODE</Text>
            <Text style={styles.coachName}>REGENT <Text style={styles.greenText}>AI</Text></Text>
          </View>
        </View>
      </View>

      <GlassCard style={styles.welcomeCard}>
        <MaterialCommunityIcons name="shield-off-outline" size={60} color="#00FF41" />
        <Text style={styles.welcomeTitle}>SQUAD_NOT_INITIALIZED</Text>
        <Text style={styles.welcomeSub}>Establish your team identity to begin neural performance analysis.</Text>
        <TouchableOpacity style={[styles.setupBtn, Theme.glow]} onPress={() => navigation.navigate('CreateTeam')}>
          <Text style={styles.setupBtnText}>INITIALIZE SQUAD</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#000" />
        </TouchableOpacity>
      </GlassCard>
    </View>
  );

  const renderOverview = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brandingRow}>
          <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuTrigger}>
            <MaterialCommunityIcons name="apps" size={28} color={Theme.colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>COMMAND_LEVEL_UNLOCKED</Text>
            <Text style={styles.coachName}>{teamData?.name || 'REGENT_AI'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.profileCircle} onPress={() => navigation.navigate('Security')}>
          <MaterialCommunityIcons name="face-recognition" size={26} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <GlassCard style={[styles.teamCard, Theme.glow]}>
        <View style={styles.teamInfo}>
          <View>
            <Text style={styles.teamLabel}>NEURAL_SQUAD_ID: {teamData?._id?.slice(-8).toUpperCase()}</Text>
            <Text style={styles.teamName}>{teamData?.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ELITE_DIVISION // SEASON_1</Text>
            </View>
          </View>
          <View style={styles.crownContainer}>
            <MaterialCommunityIcons name="crown-outline" size={40} color="#00FF41" />
          </View>
        </View>
        <View style={styles.matrixDivider} />
        <View style={styles.statsRow}>
          <StatCard title="VICTORIES" value={teamData?.wins || 0} icon="sword-cross" color="#00FF41" />
          <StatCard title="DEFEATS" value={teamData?.losses || 0} icon="skull-outline" color="#ff4444" />
          <StatCard title="OPERATIVES" value={teamData?.squad?.length || 0} icon="account-network-outline" color="#3498db" />
        </View>
      </GlassCard>

      {squadBriefing && (
        <GlassCard style={styles.briefingBanner}>
          <View style={styles.briefingHeader}>
            <MaterialCommunityIcons name="lightning-bolt-circle" size={20} color="#00FF41" />
            <Text style={styles.briefingTitle}>SQUAD_NEURAL_BRIEFING</Text>
          </View>
          <Text style={styles.briefingText}>{squadBriefing}</Text>
        </GlassCard>
      )}

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>SYSTEM_OPERATIONS</Text>
        <View style={styles.statusDot} />
      </View>

      <View style={styles.actionsGrid}>
        <QuickAction title="SQUAD_CONFIG" icon="cog-outline" onPress={() => navigation.navigate('ManageTeam', { teamId: teamData?._id })} />
        <QuickAction title="RECRUITMENT" icon="orbit-variant" onPress={() => navigation.navigate('ManageTeam', { teamId: teamData?._id })} />
        <QuickAction title="NEURAL_ANALYSIS" icon="brain" onPress={() => navigation.navigate('VideoAnalysis')} />
        <QuickAction title="SQUAD_CHAT" icon="access-point" onPress={() => teamData && navigation.navigate('SquadChat', { teamId: teamData._id })} />
      </View>

      {pendingInvites.length > 0 && (
        <>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: '#f1c40f' }]}>PENDING_RECRUITMENT ({pendingInvites.length})</Text>
            <View style={[styles.statusDot, { backgroundColor: '#f1c40f' }]} />
          </View>
          <View style={styles.analysisContainer}>
            {pendingInvites.map((invite) => (
              <GlassCard key={invite._id} style={[styles.analysisItem, { borderLeftColor: '#f1c40f', borderLeftWidth: 4 }]}>
                <View style={styles.analysisIcon}>
                  <MaterialCommunityIcons name="account-clock-outline" size={24} color="#f1c40f" />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.analysisPlayer}>{invite.name?.toUpperCase()}</Text>
                  <Text style={styles.analysisExpiry}>{invite.email}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => cancelInvite(invite._id, invite.name)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <GlassCard style={styles.cancelBtn}>
                    <MaterialCommunityIcons name="close-circle" size={24} color="#ff4444" />
                  </GlassCard>
                </TouchableOpacity>
              </GlassCard>
            ))}
          </View>
        </>
      )}

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>TACTICAL_REPLAY_HUB</Text>
        <Text style={styles.liveBadge}>24H_WINDOW</Text>
      </View>

      <View style={styles.analysisContainer}>
        {recentAnalysis.length === 0 ? (
          <Text style={styles.emptyText}>No recent neural sessions processed.</Text>
        ) : (
          recentAnalysis.map((session) => (
            <TouchableOpacity key={session._id} onPress={() => { setSelectedVideo(session); setShowVideoModal(true); }}>
              <GlassCard style={styles.analysisItem}>
                <View style={styles.analysisIcon}>
                  <MaterialCommunityIcons name="video-check" size={24} color="#00FF41" />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.analysisPlayer}>{session.player_name?.toUpperCase()}</Text>
                  <Text style={styles.analysisExpiry}>ACTIVE_SESSION</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.analysisSpeed}>{session.metrics?.ball_speed_kph} KPH</Text>
                  <Text style={styles.analysisScore}>FORM: {session.form_score}%</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderSquadControl = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.greeting}>SQUAD_CONTROL_CENTER</Text>
      <Text style={styles.coachName}>Manage Your Roster</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={{width: '100%'}} onPress={() => navigation.navigate('CreateTeam')}>
          <GlassCard style={styles.squadLink}>
            <MaterialCommunityIcons name="plus-box" size={30} color="#00FF41" />
            <View style={{ marginLeft: 15 }}>
              <Text style={styles.squadLinkTitle}>INITIALIZE NEW SQUAD</Text>
              <Text style={styles.squadLinkSub}>Create a new team and start recruiting.</Text>
            </View>
          </GlassCard>
        </TouchableOpacity>
        <TouchableOpacity style={{width: '100%'}} onPress={() => teamData && navigation.navigate('ManageTeam', { teamId: teamData._id })}>
          <GlassCard style={styles.squadLink}>
            <MaterialCommunityIcons name="account-group" size={30} color="#3498db" />
            <View style={{ marginLeft: 15 }}>
              <Text style={styles.squadLinkTitle}>MANAGE ACTIVE SQUAD</Text>
              <Text style={styles.squadLinkSub}>View roster or promote captains.</Text>
            </View>
          </GlassCard>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderAnalysisControl = () => (
    <ScrollView style={styles.mainContent} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.greeting}>NEURAL_PROCESSING_HUB</Text>
      <Text style={styles.coachName}>AI Video Analysis</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={{width: '100%'}} onPress={() => navigation.navigate('VideoAnalysis')}>
          <GlassCard style={styles.squadLink}>
            <MaterialCommunityIcons name="video-plus" size={30} color="#00FF41" />
            <View style={{ marginLeft: 15 }}>
              <Text style={styles.squadLinkTitle}>NEW AI SESSION</Text>
              <Text style={styles.squadLinkSub}>Upload footage for biometric breakdown.</Text>
            </View>
          </GlassCard>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Teams': return renderSquadControl();
      case 'Analysis': return renderAnalysisControl();
      default: return renderOverview();
    }
  };

  return (
    <ImageBackground source={require('../../../../assets/neural_bg.png')} style={styles.container}>
      <View style={styles.overlay}>
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} navigation={navigation} />
        {noTeam ? renderNoTeamView() : renderContent()}
        <Modal visible={showVideoModal} animationType="fade" transparent={false}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>TACTICAL_REPLAY</Text>
                <Text style={styles.modalPlayer}>{selectedVideo?.player_name?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowVideoModal(false)}><MaterialCommunityIcons name="close-circle-outline" size={32} color="#fff" /></TouchableOpacity>
            </View>
            <View style={styles.videoWrapper}>
              {selectedVideo && <Video source={{ uri: selectedVideo.annotated_video_url }} rate={1.0} volume={1.0} isMuted={false} resizeMode="contain" shouldPlay useNativeControls style={styles.videoPlayer} />}
            </View>
            <View style={styles.modalStats}>
              <View style={styles.miniStat}><Text style={styles.miniStatVal}>{selectedVideo?.metrics?.ball_speed_kph} KPH</Text><Text style={styles.miniStatLab}>VELOCITY</Text></View>
              <View style={styles.miniStat}><Text style={styles.miniStatVal}>{selectedVideo?.metrics?.elbow_extension_angle}°</Text><Text style={styles.miniStatLab}>EXTENSION</Text></View>
            </View>
            <ScrollView style={styles.insightScroll}>
              <Text style={styles.insightHeader}>NEURAL_INSIGHTS:</Text>
              {selectedVideo?.ai_suggestions.map((insight, i) => (
                <GlassCard key={i} style={styles.insightItem}>
                  <MaterialCommunityIcons name="lightbulb-on" size={16} color="#00FF41" />
                  <Text style={styles.insightText}>{insight}</Text>
                </GlassCard>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  mainContent: { flex: 1, padding: 20, paddingTop: 60 },
  glassBase: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  greeting: { color: '#00FF41', fontSize: 8, fontWeight: '900', letterSpacing: 2, opacity: 0.6 },
  coachName: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  brandingRow: { flexDirection: 'row', alignItems: 'center' },
  miniLogo: { width: 35, height: 35, marginRight: 10 },
  menuTrigger: { marginRight: 15 },
  greenText: { color: Theme.colors.primary },
  profileCircle: { width: 45, height: 45, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  welcomeCard: { padding: 40, alignItems: 'center', marginTop: 100 },
  welcomeTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 20, letterSpacing: 2 },
  welcomeSub: { color: '#666', textAlign: 'center', fontSize: 10, marginTop: 10, lineHeight: 16 },
  setupBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00FF41', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 25 },
  setupBtnText: { color: '#000', fontWeight: 'bold', fontSize: 11, marginRight: 8 },
  teamCard: { borderRadius: 24, padding: 20, marginBottom: 30 },
  teamInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamLabel: { color: '#666', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  teamName: { color: '#fff', fontSize: 28, fontWeight: '900', marginVertical: 5 },
  badge: { backgroundColor: 'rgba(0, 255, 65, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#00FF41', fontSize: 7, fontWeight: '900' },
  crownContainer: { width: 55, height: 55, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  matrixDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { alignItems: 'center', padding: 15, flex: 1, marginHorizontal: 5 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 5 },
  statTitle: { color: '#444', fontSize: 7, fontWeight: '900', marginTop: 3 },
  briefingBanner: { padding: 20, marginBottom: 30, borderLeftWidth: 4, borderLeftColor: '#00FF41' },
  briefingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  briefingTitle: { color: '#00FF41', fontSize: 9, fontWeight: '900', marginLeft: 8 },
  briefingText: { color: '#fff', fontSize: 11, lineHeight: 18, opacity: 0.8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 2, opacity: 0.5 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#00FF41', marginLeft: 8 },
  liveBadge: { color: '#ff4444', fontSize: 7, fontWeight: '900', marginLeft: 10, borderWidth: 1, borderColor: '#ff4444', paddingHorizontal: 4, borderRadius: 3 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionBtn: { width: '48%', marginBottom: 15, alignItems: 'center' },
  iconCircle: { width: 55, height: 55, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionText: { color: '#666', fontSize: 8, fontWeight: '900' },
  analysisContainer: { marginBottom: 30 },
  analysisItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 10 },
  analysisIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  analysisPlayer: { color: '#fff', fontSize: 12, fontWeight: '900' },
  analysisExpiry: { color: '#FF9500', fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  analysisSpeed: { color: '#00FF41', fontSize: 14, fontWeight: '900' },
  analysisScore: { color: '#333', fontSize: 8, fontWeight: '900' },
  cancelBtn: { padding: 10, backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.2)' },
  squadLink: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, marginBottom: 12, width: '100%' },
  squadLinkTitle: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  squadLinkSub: { color: '#444', fontSize: 8, marginTop: 2 },
  modalContainer: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  modalTitle: { color: '#00FF41', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  modalPlayer: { color: '#fff', fontSize: 18, fontWeight: '900' },
  videoWrapper: { width: width, height: width * 0.75, backgroundColor: '#050505' },
  videoPlayer: { flex: 1 },
  modalStats: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  miniStat: { alignItems: 'center' },
  miniStatVal: { color: '#fff', fontSize: 16, fontWeight: '900' },
  miniStatLab: { color: '#444', fontSize: 7, fontWeight: '900' },
  insightScroll: { flex: 1, padding: 20 },
  insightHeader: { color: '#00FF41', fontSize: 9, fontWeight: '900', marginBottom: 15 },
  insightItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 15, borderRadius: 12 },
  insightText: { color: '#bbb', fontSize: 10, marginLeft: 10, flex: 1, lineHeight: 16 }
});

export default CoachDashboard;
