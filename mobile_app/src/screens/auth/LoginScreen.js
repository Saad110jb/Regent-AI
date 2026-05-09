import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, Platform, Image, ScrollView,
  KeyboardAvoidingView, ImageBackground
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../../api/auth';
import { Theme } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import axios from 'axios';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  const API_URL = 'http://localhost:8002';

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "701709592916-3iuu90laus5ub5no8ttskp8oo3dl045h.apps.googleusercontent.com",
    webClientId: "701709592916-c1pitfu9snfmtr5slkpm827of3md59lv.apps.googleusercontent.com",
    redirectUri: makeRedirectUri({
      shouldProxy: true
    })
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication.idToken);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/google?id_token_str=${idToken}`);
      const data = res.data;

      const userRole = (data.user.role || 'player').toLowerCase();
      const userId = data.user.id || data.user._id;

      await AsyncStorage.setItem('userToken', data.access_token);
      await AsyncStorage.setItem('user_role', userRole);
      await AsyncStorage.setItem('user_id', String(userId));

      if (userRole === 'coach') {
        navigation.replace('CoachDashboard');
      } else {
        navigation.replace('PlayerDashboard');
      }
    } catch (error) {
      console.log("GOOGLE_LOGIN_ERROR", error);
      Alert.alert("Neural Link Failed", "Could not verify Google credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await login(email, password);
      
      if (response.two_factor_required) {
        navigation.navigate('TwoFactor', { 
          userId: response.user_id, 
          email: response.email 
        });
        return;
      }

      const userRole = (response.user.role || 'player').toLowerCase(); 
      const userId = response.user._id || response.user.id || response.user.user_id;

      await AsyncStorage.setItem('user_role', userRole);
      if (userId) {
        await AsyncStorage.setItem('user_id', String(userId));
      }

      if (userRole === 'coach') {
        navigation.replace('CoachDashboard'); 
      } else {
        navigation.replace('PlayerDashboard'); 
      }
    } catch (error) {
      let msg = "Invalid email or password.";
      if (error.message === 'Network Error') {
        msg = "Cannot reach the server. Ensure Wi-Fi connectivity.";
      } else if (error.response) {
        msg = error.response.data?.detail || msg;
      }

      if (Platform.OS === 'web') {
        window.alert("Auth Error: " + msg);
      } else {
        Alert.alert("Auth Error", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={require('../../../assets/neural_bg.png')} 
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.glassCard}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../../assets/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.headerContainer}>
                <Text style={styles.header}>REGENT <Text style={styles.greenText}>AI</Text></Text>
                <Text style={styles.subtitle}>NEURAL PERFORMANCE ARCHITECTURE</Text>
              </View>

              <View style={styles.form}>
                <View style={[styles.inputWrapper, focused === 'email' && styles.inputFocused]}>
                  <MaterialCommunityIcons name="email-outline" size={20} color={focused === 'email' ? Theme.colors.primary : '#fff'} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="OPERATIVE EMAIL" 
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />
                </View>

                <View style={[styles.inputWrapper, focused === 'password' && styles.inputFocused]}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color={focused === 'password' ? Theme.colors.primary : '#fff'} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="SECURITY ACCESS KEY" 
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry 
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.button, Theme.glow]} 
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <View style={styles.btnContent}>
                      <Text style={styles.buttonText}>INITIATE SESSION</Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>OR NEURAL LINK</Text>
                  <View style={styles.line} />
                </View>

                <TouchableOpacity 
                  style={styles.googleBtn} 
                  onPress={() => promptAsync()}
                  disabled={!request || loading}
                >
                  <MaterialCommunityIcons name="google" size={20} color="#fff" />
                  <Text style={styles.googleBtnText}>SIGN IN WITH GOOGLE</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.linkText}>New operative? <Text style={styles.linkTextBold}>Request Credentials</Text></Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 30,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 10,
  },
  logoContainer: { alignItems: 'center', marginBottom: 15 },
  logo: { width: 140, height: 140 },
  headerContainer: { marginBottom: 35 },
  header: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: '900', 
    textAlign: 'center', 
    letterSpacing: 6,
    marginBottom: 5
  },
  greenText: { color: Theme.colors.primary },
  subtitle: { 
    color: '#fff', 
    fontSize: 8, 
    textAlign: 'center', 
    letterSpacing: 4, 
    fontWeight: 'bold',
    opacity: 0.5
  },
  form: { width: '100%' },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center'
  },
  inputFocused: {
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(0, 255, 65, 0.05)'
  },
  input: {
    flex: 1,
    color: '#fff',
    height: 55,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 15
  },
  button: {
    backgroundColor: Theme.colors.primary,
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    color: '#000',
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 13,
    marginRight: 10
  },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: '#666', fontSize: 8, fontWeight: 'bold', marginHorizontal: 15, letterSpacing: 2 },
  googleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    height: 55,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  googleBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 15, letterSpacing: 1, fontSize: 11 },
  registerLink: {
    marginTop: 25,
    alignItems: 'center'
  },
  linkText: {
    color: '#666',
    fontSize: 10,
    letterSpacing: 1
  },
  linkTextBold: {
    color: Theme.colors.primary,
    fontWeight: 'bold'
  }
});

export default LoginScreen;
