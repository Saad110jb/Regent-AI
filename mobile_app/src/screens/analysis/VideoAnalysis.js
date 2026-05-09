import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, ImageBackground
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { Theme } from '../../theme';

const { width, height } = Dimensions.get('window');

const GlassCard = ({ children, style }) => (
  <View style={[styles.glassBase, style]}>
    {children}
  </View>
);

const VideoAnalysis = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [squad, setSquad] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [video, setVideo] = useState(null);
  const [result, setResult] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing Engine...");

  const PROCESSING_STEPS = [
    "Uploading Training Footage...",
    "Isolating Bowler (Expert 1)...",
    "Mapping Skeleton (Expert 2)...",
    "Tracking Ball Velocity (Expert 3)...",
    "Identifying Batting Shot (Expert 4)...",
    "Generating Neural Overlays..."
  ];

  const API_URL = 'http://localhost:8002';

  useEffect(() => {
    fetchSquad();
  }, []);

  useEffect(() => {
    let interval;
    if (uploading) {
      let step = 0;
      setStatusMessage(PROCESSING_STEPS[0]);
      interval = setInterval(() => {
        step = (step + 1) % PROCESSING_STEPS.length;
        setStatusMessage(PROCESSING_STEPS[step]);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [uploading]);

  const fetchSquad = async () => {
    try {
      const teamId = await AsyncStorage.getItem('team_id');
      if (!teamId || teamId === 'null') {
        Alert.alert("Configuration Required", "No active squad detected. Please initialize your team in the Dashboard first.");
        navigation.goBack();
        return;
      }
      const response = await axios.get(`${API_URL}/teams/${teamId}/full-profile`);
      setSquad(response.data.squad || []);
    } catch (error) {
      console.log("FETCH_SQUAD_ERROR:", error);
    }
  };

  const handleVideoSelection = (asset) => {
    const fileSizeMB = asset.fileSize ? asset.fileSize / (1024 * 1024) : 0;
    
    if (fileSizeMB > 10) {
      Alert.alert(
        "File Too Large", 
        `The selected video is ${fileSizeMB.toFixed(1)}MB. Please select a video smaller than 10MB to ensure smooth AI processing.`
      );
      return;
    }
    
    setVideo(asset);
  };

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      handleVideoSelection(result.assets[0]);
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Access Denied", "Camera permission is required to capture tactical footage.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      handleVideoSelection(result.assets[0]);
    }
  };

  const uriToBlob = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  };

  const uploadAndAnalyze = async () => {
    if (!selectedPlayer || !video) {
      Alert.alert("Required", "Please select a player and a training video.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const blob = await uriToBlob(video.uri);
        formData.append('file', blob, 'training_session.mp4');
      } else {
        formData.append('file', {
          uri: video.uri,
          type: 'video/mp4',
          name: 'training_session.mp4',
        });
      }

      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_URL}/analysis/upload-session?player_id=${selectedPlayer._id}`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          timeout: 300000 // 5 minutes for deep neural processing
        }
      );
      setResult(response.data);
      Alert.alert("Analysis Complete", "Biometrics and skeleton overlays are ready for review.");
    } catch (error) {
      console.log("UPLOAD_ERROR:", error.response?.data || error.message);
      if (error.code === 'ECONNABORTED') {
        Alert.alert("Timeout", "Neural processing is taking longer than usual. Please check your AI Engine terminal status.");
      } else {
        const detail = error.response?.data?.detail;
        const errorMsg = Array.isArray(detail) ? detail[0].msg : detail;
        Alert.alert("Analysis Failed", errorMsg || "AI Engine is unreachable or encountered a processing error.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <ImageBackground 
      source={require('../../../assets/neural_bg.png')} 
      style={styles.container}
    >
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.header}>AI <Text style={styles.green}>ANALYSIS ENGINE</Text></Text>
              <Text style={styles.subtitle}>Neural processing of training footage.</Text>
            </View>
          </View>

          {/* PLAYER SELECTION */}
          <Text style={styles.sectionLabel}>1. SELECT OPERATIVE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerScroll}>
            {squad.map(player => (
              <TouchableOpacity 
                key={player._id} 
                onPress={() => setSelectedPlayer(player)}
              >
                <GlassCard style={[styles.playerCard, selectedPlayer?._id === player._id && styles.playerCardActive]}>
                  <MaterialCommunityIcons 
                    name="account-circle-outline" 
                    size={32} 
                    color={selectedPlayer?._id === player._id ? "#00FF41" : "rgba(255,255,255,0.3)"} 
                  />
                  <Text style={[styles.playerName, selectedPlayer?._id === player._id && styles.playerNameActive]}>
                    {player.name.split(' ')[0].toUpperCase()}
                  </Text>
                  {selectedPlayer?._id === player._id && <View style={styles.activeDot} />}
                </GlassCard>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* VIDEO SELECTION */}
          <Text style={styles.sectionLabel}>2. TRAINING FOOTAGE</Text>
          
          <View style={styles.captureGrid}>
            <TouchableOpacity 
              style={styles.captureTouch}
              onPress={pickVideo}
            >
              <GlassCard style={[styles.captureBox, video && styles.captureBoxActive]}>
                <MaterialCommunityIcons 
                  name="folder-open-outline" 
                  size={36} 
                  color={video ? "#00FF41" : "rgba(255,255,255,0.4)"} 
                />
                <Text style={[styles.captureText, video && styles.captureTextActive]}>GALLERY</Text>
              </GlassCard>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.captureTouch}
              onPress={takeVideo}
            >
              <GlassCard style={[styles.captureBox, video && styles.captureBoxActive]}>
                <MaterialCommunityIcons 
                  name="camera-outline" 
                  size={36} 
                  color={video ? "#00FF41" : "rgba(255,255,255,0.4)"} 
                />
                <Text style={[styles.captureText, video && styles.captureTextActive]}>CAMERA</Text>
              </GlassCard>
            </TouchableOpacity>
          </View>

          {video && (
            <GlassCard style={styles.videoFeedback}>
              <MaterialCommunityIcons name="check-decagram" size={16} color="#00FF41" />
              <Text style={styles.videoFeedbackText}>
                TACTICAL ASSET: {video.duration ? (video.duration/1000).toFixed(1)+'S' : 'LOADED'}
              </Text>
            </GlassCard>
          )}

          {/* ACTION BUTTON */}
          <TouchableOpacity 
            style={[styles.analyzeBtn, (!selectedPlayer || !video) && styles.disabledBtn, selectedPlayer && video && Theme.glow]} 
            onPress={uploadAndAnalyze}
            disabled={uploading || !selectedPlayer || !video}
          >
            {uploading ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator color="#000" />
                <Text style={[styles.analyzeBtnText, { color: '#000', marginTop: 5, fontSize: 8 }]}>
                  {statusMessage.toUpperCase()}
                </Text>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons name="brain" size={24} color="#000" />
                <Text style={styles.analyzeBtnText}>RUN AI INFERENCE</Text>
              </>
            )}
          </TouchableOpacity>

          {/* RESULTS SECTION */}
          {result && (
            <GlassCard style={[styles.resultCard, Theme.glow]}>
              <View style={styles.resultHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={24} color="#00FF41" />
                <Text style={styles.resultHeaderText}>NEURAL_ANALYSIS_SYNC</Text>
              </View>

              <View style={styles.shotBadge}>
                <Text style={styles.shotLabel}>DETECTION: </Text>
                <Text style={styles.shotName}>{result.metrics.detected_shot || "ACTION"}</Text>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{result.metrics.ball_speed_kph}</Text>
                  <Text style={styles.metricLabel}>KPH</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{result.metrics.elbow_extension_angle}°</Text>
                  <Text style={styles.metricLabel}>ELBOW</Text>
                </View>
              </View>

              <Text style={styles.insightHeader}>SYSTEM_INSIGHTS</Text>
              {result.coaching_insights.map((insight, i) => (
                <View key={i} style={styles.insightItem}>
                  <MaterialCommunityIcons name="circle-medium" size={20} color="#00FF41" />
                  <Text style={styles.insightText}>{insight.toUpperCase()}</Text>
                </View>
              ))}

              {result.annotated_video_url && (
                <TouchableOpacity 
                  style={styles.playbackBtn}
                  onPress={() => setShowVideo(true)}
                >
                  <MaterialCommunityIcons name="play-circle-outline" size={24} color="#000" />
                  <Text style={styles.playbackBtnText}>LAUNCH OVERLAY</Text>
                </TouchableOpacity>
              )}
            </GlassCard>
          )}

          {/* NEURAL OVERLAY MODAL */}
          <Modal visible={showVideo} animationType="fade" transparent={false}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>NEURAL_OVERLAY_FEED</Text>
                <TouchableOpacity onPress={() => setShowVideo(false)} style={styles.modalClose}>
                  <MaterialCommunityIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.videoWrapper}>
                <Video
                  source={{ uri: result?.annotated_video_url }}
                  rate={1.0}
                  volume={1.0}
                  isMuted={false}
                  resizeMode="contain"
                  shouldPlay
                  useNativeControls
                  style={styles.videoPlayer}
                />
              </View>

              <View style={styles.modalStats}>
                <GlassCard style={styles.miniStat}>
                  <Text style={styles.miniStatVal}>{result?.metrics.ball_speed_kph} KPH</Text>
                  <Text style={styles.miniStatLab}>VELOCITY</Text>
                </GlassCard>
                <GlassCard style={styles.miniStat}>
                  <Text style={styles.miniStatVal}>{result?.metrics.elbow_extension_angle}°</Text>
                  <Text style={styles.miniStatLab}>ANGLE</Text>
                </GlassCard>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  scrollContent: { padding: 25, paddingTop: 60, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  backBtn: { marginRight: 20, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  green: { color: '#00FF41' },
  subtitle: { color: '#666', fontSize: 9, fontWeight: '900', marginTop: 5, letterSpacing: 1 },

  glassBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  sectionLabel: { color: '#fff', fontSize: 8, fontWeight: '900', marginBottom: 15, letterSpacing: 2, opacity: 0.3 },
  
  playerScroll: { marginBottom: 40 },
  playerCard: { width: 100, height: 110, justifyContent: 'center', alignItems: 'center', marginRight: 15, padding: 15 },
  playerCardActive: { borderColor: '#00FF41', backgroundColor: 'rgba(0, 255, 65, 0.05)' },
  playerName: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '900', marginTop: 12, letterSpacing: 1 },
  playerNameActive: { color: '#fff' },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#00FF41', marginTop: 8 },

  captureGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  captureTouch: { width: '48%' },
  captureBox: { height: 130, justifyContent: 'center', alignItems: 'center', padding: 20 },
  captureBoxActive: { borderColor: '#00FF41', backgroundColor: 'rgba(0, 255, 65, 0.05)' },
  captureText: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '900', marginTop: 15, letterSpacing: 2 },
  captureTextActive: { color: '#fff' },
  
  videoFeedback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 35, padding: 15, borderStyle: 'dashed' },
  videoFeedbackText: { color: '#00FF41', fontSize: 9, fontWeight: '900', marginLeft: 10, letterSpacing: 1 },

  analyzeBtn: { backgroundColor: '#00FF41', padding: 22, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { backgroundColor: 'rgba(255,255,255,0.05)', opacity: 0.3 },
  analyzeBtnText: { color: '#000', fontWeight: '900', marginLeft: 12, letterSpacing: 2, fontSize: 13 },

  resultCard: { padding: 30, marginTop: 40 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  resultHeaderText: { color: '#fff', fontSize: 13, fontWeight: '900', marginLeft: 15, letterSpacing: 2 },
  
  shotBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 255, 65, 0.1)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, marginBottom: 25, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(0, 255, 65, 0.2)' },
  shotLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '900' },
  shotName: { color: '#00FF41', fontSize: 10, fontWeight: '900' },

  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  metricBox: { width: '48%', backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metricValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  metricLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '900', marginTop: 5, letterSpacing: 1 },

  insightHeader: { color: '#fff', fontSize: 9, fontWeight: '900', marginBottom: 20, letterSpacing: 2, opacity: 0.3 },
  insightItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingRight: 10 },
  insightText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900', marginLeft: 10, flex: 1, lineHeight: 14, letterSpacing: 1 },
  
  playbackBtn: { 
    flexDirection: 'row', 
    backgroundColor: '#00FF41', 
    padding: 18, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 25 
  },
  playbackBtnText: { color: '#000', fontSize: 11, fontWeight: '900', marginLeft: 10, letterSpacing: 1 },
  
  // MODAL STYLES
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, marginBottom: 30 },
  modalClose: { padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15 },
  modalTitle: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 2, opacity: 0.5 },
  videoWrapper: { width: width, height: height * 0.5, backgroundColor: '#0a0a0a' },
  videoPlayer: { flex: 1 },
  modalStats: { flexDirection: 'row', justifyContent: 'space-between', padding: 25 },
  miniStat: { width: '48%', padding: 20, alignItems: 'center' },
  miniStatVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  miniStatLab: { color: '#00FF41', fontSize: 8, fontWeight: '900', marginTop: 5, letterSpacing: 1 },
});

export default VideoAnalysis;

