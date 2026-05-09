import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, Image 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Theme } from '../../theme';

const API_URL = 'http://localhost:8002';

const TwoFactorScreen = ({ route, navigation }) => {
  const { userId, email } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("Invalid Format", "Please enter the 6-digit security code.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/verify-2fa?user_id=${userId}&code=${code}`);
      
      const { access_token, user } = response.data;
      const userRole = (user.role || 'player').toLowerCase();

      await AsyncStorage.setItem('userToken', access_token);
      await AsyncStorage.setItem('user_role', userRole);
      await AsyncStorage.setItem('user_id', String(user.id));

      if (userRole === 'coach') {
        navigation.replace('CoachDashboard');
      } else {
        navigation.replace('PlayerDashboard');
      }
    } catch (error) {
      Alert.alert("Verification Failed", "The security code you entered is incorrect or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('../../../assets/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.header}>SECURITY <Text style={styles.greenText}>VERIFICATION</Text></Text>
        <Text style={styles.subtitle}>A 6-digit access code has been sent to your registered email: {email}</Text>

        <TextInput 
          style={styles.input}
          placeholder="ENTER CODE"
          placeholderTextColor="#444"
          keyboardType="numeric"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        <TouchableOpacity 
          style={[styles.button, Theme.glow]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>VERIFY IDENTITY</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>CANCEL SESSION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { flex: 1, justifyContent: 'center', padding: 30, alignItems: 'center' },
  logo: { width: 120, height: 120, marginBottom: 30 },
  header: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  greenText: { color: Theme.colors.primary },
  subtitle: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 18, marginBottom: 40 },
  input: {
    backgroundColor: '#111',
    width: '100%',
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    color: '#fff',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 10
  },
  button: {
    backgroundColor: Theme.colors.primary,
    width: '100%',
    height: 55,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30
  },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  cancelBtn: { marginTop: 30 },
  cancelText: { color: '#444', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }
});

export default TwoFactorScreen;
