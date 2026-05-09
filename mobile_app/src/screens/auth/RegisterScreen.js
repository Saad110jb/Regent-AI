import React, { useState } from 'react';
import { 
  View, ScrollView, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, Image, KeyboardAvoidingView, Platform,
  ImageBackground
} from 'react-native';
import { register } from '../../api/auth';
import { Theme } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const RegisterScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'player'
  });
  const [focused, setFocused] = useState(null);

  const handleRegister = async () => {
    if (!form.full_name || form.full_name.length < 3) {
      Alert.alert("Input Error", "Full name must be at least 3 characters.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      Alert.alert("Invalid Email", "Please enter a valid network email (e.g. name@domain.com).");
      return;
    }

    const passRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passRegex.test(form.password)) {
      Alert.alert(
        "Security Requirement", 
        "Access Key must be at least 8 characters and contain at least one uppercase letter and one number."
      );
      return;
    }

    try {
      await register(form);
      Alert.alert("Registry Confirmed", "Operative profile initialized. Access granted for terminal login.");
      navigation.navigate('Login');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Registry failed.";
      Alert.alert("Access Denied", typeof errorMsg === 'string' ? errorMsg : "Validation Error.");
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
              <View style={styles.headerContainer}>
                <Image 
                  source={require('../../../assets/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.header}>OPERATIVE <Text style={styles.green}>REGISTRY</Text></Text>
                <Text style={styles.subtitle}>ESTABLISHING NEURAL LINK</Text>
              </View>
              
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>CORE IDENTITY_</Text>
                
                <View style={[styles.inputWrapper, focused === 'name' && styles.inputFocused]}>
                  <MaterialCommunityIcons name="account-outline" size={18} color={focused === 'name' ? Theme.colors.primary : '#fff'} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="FULL NAME" 
                    placeholderTextColor="rgba(255,255,255,0.3)" 
                    onChangeText={txt => setForm({...form, full_name: txt})} 
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
                
                <View style={[styles.inputWrapper, focused === 'email' && styles.inputFocused]}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={focused === 'email' ? Theme.colors.primary : '#fff'} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="NETWORK EMAIL" 
                    placeholderTextColor="rgba(255,255,255,0.3)" 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={txt => setForm({...form, email: txt})} 
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
                
                <View style={[styles.inputWrapper, focused === 'pass' && styles.inputFocused]}>
                  <MaterialCommunityIcons name="shield-key-outline" size={18} color={focused === 'pass' ? Theme.colors.primary : '#fff'} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="ACCESS KEY" 
                    placeholderTextColor="rgba(255,255,255,0.3)" 
                    secureTextEntry 
                    onChangeText={txt => setForm({...form, password: txt})} 
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
                
                <Text style={styles.sectionLabel}>SELECT DESIGNATION_</Text>
                <View style={styles.roleRow}>
                  {['player', 'coach'].map(roleOption => (
                    <TouchableOpacity 
                      key={roleOption} 
                      style={[styles.roleChip, form.role === roleOption && styles.activeRoleChip]} 
                      onPress={() => setForm({...form, role: roleOption})}
                    >
                      <MaterialCommunityIcons 
                        name={roleOption === 'player' ? 'cricket' : 'account-tie-outline'} 
                        size={16} 
                        color={form.role === roleOption ? '#000' : '#fff'} 
                        style={{ marginBottom: 5 }}
                      />
                      <Text style={[styles.roleChipText, form.role === roleOption && styles.activeRoleChipText]}>
                        {roleOption.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={[styles.button, Theme.glow]} onPress={handleRegister}>
                  <View style={styles.btnContent}>
                    <Text style={styles.buttonText}>COMMIT REGISTRY</Text>
                    <MaterialCommunityIcons name="database-plus-outline" size={18} color="#000" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
                  <Text style={styles.footerText}>ALREADY ESTABLISHED? <Text style={styles.green}>INITIATE_LOGIN</Text></Text>
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
  scrollContent: { padding: 20, paddingTop: 60, flexGrow: 1, justifyContent: 'center' },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 30,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 10,
  },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 90, height: 90, marginBottom: 15 },
  header: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  green: { color: Theme.colors.primary },
  subtitle: { color: '#fff', fontSize: 8, letterSpacing: 2, fontWeight: 'bold', opacity: 0.5 },
  
  formSection: { width: '100%' },
  sectionLabel: { color: '#fff', fontSize: 8, marginBottom: 12, letterSpacing: 1, fontWeight: 'bold', opacity: 0.4 },
  
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
    paddingHorizontal: 15,
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
    height: 50,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 12
  },
  
  roleRow: { flexDirection: 'row', marginBottom: 25 },
  roleChip: { 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.1)', 
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12, 
    marginRight: 10, 
    borderRadius: 15, 
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeRoleChip: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  roleChipText: { color: '#fff', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, opacity: 0.5 },
  activeRoleChipText: { color: '#000', opacity: 1 },
  
  button: { 
    backgroundColor: Theme.colors.primary, 
    height: 55, 
    borderRadius: 15, 
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center', 
    fontWeight: '900', 
    color: '#000', 
    letterSpacing: 2, 
    fontSize: 13,
    marginRight: 10
  },
  
  footerLink: { marginTop: 25, alignSelf: 'center' },
  footerText: { color: '#666', fontSize: 9, letterSpacing: 1 }
});

export default RegisterScreen;
