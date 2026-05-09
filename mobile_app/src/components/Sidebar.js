import React from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, Animated, Image 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../theme';

const { width, height } = Dimensions.get('window');

const Sidebar = ({ navigation, isOpen, onClose }) => {
  const sidebarWidth = width * 0.75;
  const translateX = React.useRef(new Animated.Value(-sidebarWidth)).current;

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : -sidebarWidth,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const menuItems = [
    { name: 'Dashboard', icon: 'view-dashboard', route: 'CoachDashboard' },
    { name: 'My Squad', icon: 'account-group', route: 'ManageTeam' },
    { name: 'AI Analysis', icon: 'brain', route: 'VideoAnalysis' },
    { name: 'Create Squad', icon: 'plus-box', route: 'CreateTeam' },
    { name: 'Security', icon: 'shield-lock', route: 'Security' },
  ];

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  if (!isOpen && translateX._value === -sidebarWidth) return null;

  return (
    <View style={styles.overlayContainer}>
      <TouchableOpacity 
        activeOpacity={1} 
        style={styles.backdrop} 
        onPress={onClose} 
      />
      <Animated.View style={[styles.sidebar, { transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>REGENT <Text style={{ color: Theme.colors.primary }}>AI</Text></Text>
          <Text style={styles.systemStatus}>SYSTEM_READY_V2.0</Text>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={() => {
                onClose();
                navigation.navigate(item.route);
              }}
            >
              <MaterialCommunityIcons name={item.icon} size={22} color={Theme.colors.primary} />
              <Text style={styles.menuText}>{item.name.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#FF4444" />
            <Text style={styles.logoutText}>TERMINATE SESSION</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.75,
    height: height,
    backgroundColor: '#050505',
    borderRightWidth: 1,
    borderRightColor: '#1a1a1a',
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    paddingBottom: 20,
  },
  logo: { width: 60, height: 60, marginBottom: 15 },
  brandName: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  systemStatus: { color: '#444', fontSize: 8, fontWeight: 'bold', marginTop: 5 },
  
  menu: { flex: 1 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#0a0a0a',
  },
  menuText: { color: '#ddd', fontSize: 12, fontWeight: 'bold', marginLeft: 15, letterSpacing: 1 },
  
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#111',
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#110000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#330000',
  },
  logoutText: { color: '#FF4444', fontSize: 10, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
});

export default Sidebar;
