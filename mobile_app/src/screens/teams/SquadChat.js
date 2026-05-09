import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Dimensions, Linking, Modal, ImageBackground
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Theme } from '../../theme';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video } from 'expo-av';

const { width, height } = Dimensions.get('window');
const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002/chat/ws';

const GlassCard = ({ children, style }) => (
  <View style={[styles.glassBase, style]}>
    {children}
  </View>
);

const SquadChat = ({ route, navigation }) => {
  const { teamId } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isCoach, setIsCoach] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    retention_period: "Never",
    broadcast_mode: false,
    only_coach_media: false,
    muted_users: []
  });
  const [showSettings, setShowSettings] = useState(false);
  const ws = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    initChat();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const initChat = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userId = await AsyncStorage.getItem('user_id');
      setCurrentUserId(userId);

      const res = await axios.get(`${API_URL}/chat/history/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.messages || res.data);
      
      try {
        const settingsRes = await axios.get(`${API_URL}/chat/settings/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChatSettings(settingsRes.data);

        const teamRes = await axios.get(`${API_URL}/teams/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsCoach(teamRes.data.coach_id === userId);
      } catch (e) { console.log("SETTINGS_FETCH_ERROR", e); }

      setLoading(false);
      ws.current = new WebSocket(`${WS_URL}/${teamId}?token=${token}`);
      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.action === 'message_deleted') {
          setMessages((prev) => prev.filter(m => m._id !== data.message_id));
        } else if (data.action === 'message_edited') {
          setMessages((prev) => prev.map(m => 
            m._id === data.message_id ? { ...m, content: data.new_content, is_edited: true } : m
          ));
        } else if (data.action === 'settings_updated') {
          setChatSettings(data.settings);
        } else {
          setMessages((prevMessages) => [...prevMessages, data]);
        }
      };
    } catch (error) {
      console.log("CHAT_INIT_ERROR", error);
      setLoading(false);
    }
  };

  const pickMediaOnly = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) uploadFile(result.assets[0]);
  };

  const pickDocOnly = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (result.canceled) return;
      const asset = result.assets[0];
      uploadFile({
        uri: asset.uri,
        fileName: asset.name,
        type: asset.mimeType || 'application/pdf',
        originalType: 'document'
      });
    } catch (e) { console.log(e); }
  };

  const uploadFile = async (asset) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('file', blob, asset.fileName || asset.name || `chat_asset_${Date.now()}`);
      } else {
        formData.append('file', {
          uri: asset.uri,
          name: asset.fileName || asset.name || `chat_asset_${Date.now()}`,
          type: asset.originalType === 'document' ? asset.type : (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
        });
      }

      const res = await axios.post(`${API_URL}/chat/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });

      if (res.data.status === 'success') {
        ws.current.send(JSON.stringify({
          type: res.data.type,
          file_url: res.data.file_url,
          filename: res.data.filename,
          content: `Shared a ${res.data.type}`
        }));
      }
    } catch (err) {
      Alert.alert("Transmission Error", "Failed to upload tactical asset.");
    } finally { setLoading(false); }
  };

  const sendMessage = async () => {
    if (inputText.trim().length === 0) return;
    if (editingMessage) {
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.patch(`${API_URL}/chat/message/${editingMessage._id}?content=${encodeURIComponent(inputText.trim())}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEditingMessage(null);
        setInputText('');
      } catch (e) { Alert.alert("Edit Failure", "Failed to update transmission."); }
      return;
    }
    ws.current.send(JSON.stringify({ type: 'text', content: inputText.trim() }));
    setInputText('');
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === currentUserId;
    const isCoachMsg = item.sender_role === 'coach';

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperOther]}>
        {!isMe && (
          <Text style={[styles.senderName, isCoachMsg && styles.coachName]}>
            {item.sender_name.toUpperCase()} {isCoachMsg ? '[COACH]' : ''}
          </Text>
        )}
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => item.file_url && Linking.openURL(item.file_url)}
          style={[
            styles.messageBubble, 
            isMe ? styles.bubbleMe : styles.bubbleOther,
            item.type !== 'text' && { backgroundColor: 'transparent', padding: 0, borderWidth: 0 }
          ]}
        >
          {item.type === 'text' ? (
            <View>
              <Text style={[styles.messageText, isMe ? styles.textMe : styles.textOther]}>
                {item.content}
              </Text>
              {item.is_edited && <Text style={styles.editedTag}>[MODIFIED]</Text>}
            </View>
          ) : item.type === 'image' ? (
            <GlassCard style={{ padding: 5 }}><Image source={{ uri: item.file_url }} style={styles.chatImage} /></GlassCard>
          ) : item.type === 'video' ? (
            <GlassCard style={styles.videoPreviewContainer}>
              <Video source={{ uri: item.file_url }} style={styles.chatVideo} isMuted shouldPlay={false} />
              <View style={styles.videoOverlay}>
                <MaterialCommunityIcons name="play-circle-outline" size={48} color="#00FF41" />
                <Text style={styles.videoLabel}>NEURAL_FEED</Text>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.docItem}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#00FF41" />
              <Text style={styles.docText}>{item.filename || 'Tactical_Document.pdf'}</Text>
            </GlassCard>
          )}
        </TouchableOpacity>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => { setEditingMessage(item); setInputText(item.content); }} style={styles.actionIcon}>
                <MaterialCommunityIcons name="pencil-outline" size={12} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {}} style={styles.actionIcon}>
                <MaterialCommunityIcons name="trash-can-outline" size={12} color="#ff4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00FF41" />
        <Text style={styles.loadingText}>SYNCING_NEURAL_LINK...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require('../../../assets/neural_bg.png')} style={styles.container}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        
        <GlassCard style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.headerTitle}>SQUAD <Text style={styles.green}>COMMS</Text></Text>
                {isCoach && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>COACH ACCESS</Text></View>}
              </View>
              <Text style={styles.headerSub}>ENCRYPTED NEURAL CHANNEL</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
              <MaterialCommunityIcons name="cog-outline" size={24} color="#00FF41" />
            </TouchableOpacity>
          </View>
        </GlassCard>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <GlassCard style={styles.inputDock}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.utilityBtn} onPress={pickMediaOnly}>
              <MaterialCommunityIcons name="image-outline" size={24} color="#00FF41" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.utilityBtn} onPress={pickDocOnly}>
              <MaterialCommunityIcons name="paperclip" size={24} color="#00FF41" />
            </TouchableOpacity>
            
            <View style={styles.inputWell}>
              <TextInput
                style={styles.textInput}
                placeholder="Transmit message..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
            </View>

            <TouchableOpacity style={[styles.sendBtn, Theme.glow]} onPress={sendMessage}>
              <MaterialCommunityIcons name="send-lock" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </GlassCard>

        <Modal visible={showSettings} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.settingsModal}>
              <Text style={styles.modalTitle}>TERMINAL_CONFIG</Text>
              <Text style={styles.modalSub}>SQUAD COMMUNICATION POLICIES</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowSettings(false)}>
                <Text style={styles.modalCloseText}>DISMISS</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#00FF41', marginTop: 15, fontSize: 8, fontWeight: '900', letterSpacing: 2 },

  header: { paddingTop: 60, paddingBottom: 20, borderRadius: 0, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  backBtn: { padding: 10, marginRight: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  green: { color: '#00FF41' },
  headerSub: { color: 'rgba(255,255,255,0.3)', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  adminBadge: { backgroundColor: 'rgba(255,149,0,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,149,0,0.3)', marginLeft: 10 },
  adminBadgeText: { color: '#FF9500', fontSize: 7, fontWeight: '900' },
  settingsBtn: { padding: 10, backgroundColor: 'rgba(0,255,65,0.05)', borderRadius: 15 },

  chatList: { padding: 20, paddingTop: 30, paddingBottom: 100 },
  messageWrapper: { marginBottom: 25, maxWidth: '85%' },
  messageWrapperMe: { alignSelf: 'flex-end' },
  messageWrapperOther: { alignSelf: 'flex-start' },
  senderName: { color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '900', marginBottom: 8, letterSpacing: 1, marginLeft: 10 },
  coachName: { color: '#FF9500' },

  glassBase: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  
  messageBubble: { padding: 18, borderRadius: 25 },
  bubbleMe: { backgroundColor: 'rgba(0, 255, 65, 0.15)', borderColor: 'rgba(0, 255, 65, 0.3)', borderBottomRightRadius: 5, borderTopRightRadius: 25 },
  bubbleOther: { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.05)', borderBottomLeftRadius: 5, borderTopLeftRadius: 25 },
  
  messageText: { fontSize: 13, lineHeight: 18, fontWeight: '900', letterSpacing: 0.5 },
  textMe: { color: '#00FF41' },
  textOther: { color: '#fff' },
  editedTag: { fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 5, alignSelf: 'flex-end' },

  messageFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, paddingHorizontal: 10 },
  timestamp: { color: 'rgba(255,255,255,0.2)', fontSize: 7, fontWeight: '900' },
  actionButtons: { flexDirection: 'row', marginLeft: 15 },
  actionIcon: { marginLeft: 10 },

  inputDock: { position: 'absolute', bottom: 30, left: 20, right: 20, padding: 10, borderRadius: 25 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  utilityBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 15, marginRight: 8 },
  inputWell: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  textInput: { color: '#fff', fontSize: 12, fontWeight: '900', maxHeight: 80 },
  sendBtn: { width: 50, height: 50, backgroundColor: '#00FF41', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },

  chatImage: { width: width * 0.65, height: 200, borderRadius: 15 },
  videoPreviewContainer: { width: width * 0.65, height: 200, overflow: 'hidden' },
  chatVideo: { flex: 1 },
  videoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  videoLabel: { color: '#00FF41', fontSize: 8, fontWeight: '900', marginTop: 10, letterSpacing: 1 },
  docItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  docText: { color: '#00FF41', fontSize: 10, marginLeft: 12, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  settingsModal: { width: '85%', padding: 30, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  modalSub: { color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '900', marginTop: 10, marginBottom: 30 },
  modalCloseBtn: { paddingVertical: 15, paddingHorizontal: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15 },
  modalCloseText: { color: '#fff', fontSize: 10, fontWeight: '900' }
});

export default SquadChat;

