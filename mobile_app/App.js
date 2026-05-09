import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import your screens
import RegisterScreen from './src/screens/auth/RegisterScreen';
import LoginScreen from './src/screens/auth/LoginScreen'; 
import CoachDashboard from './src/screens/dashboards/Coach/CoachDashboard'; 
import CreateTeam from './src/screens/teams/createteam';
import ManageTeam from './src/screens/teams/ManageTeam';
import EditPlayerStats from './src/screens/teams/EditPlayerStats';
import PlayerDashboard from './src/screens/dashboards/Player/PlayerDashboard';
import InitializePlayer from './src/screens/players/InitializePlayer';
import VideoAnalysis from './src/screens/analysis/VideoAnalysis';
import ManageSquadStats from './src/screens/dashboards/Coach/ManageSquadStats';
import SecurityScreen from './src/screens/settings/SecurityScreen';
import TwoFactorScreen from './src/screens/auth/TwoFactorScreen';
import SquadChat from './src/screens/teams/SquadChat';

const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('user_role');
        
        if (token && role) {
          setInitialRoute(role === 'coach' ? 'CoachDashboard' : 'PlayerDashboard');
        }
      } catch (e) {
        console.error("SESSION_CHECK_ERROR:", e);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00FF41" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0a' }
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="CoachDashboard" component={CoachDashboard} />
        <Stack.Screen name="CreateTeam" component={CreateTeam} />
        <Stack.Screen name="ManageTeam" component={ManageTeam} />
        <Stack.Screen name="EditPlayerStats" component={EditPlayerStats} />
        <Stack.Screen name="PlayerDashboard" component={PlayerDashboard} />
        <Stack.Screen name="InitializePlayer" component={InitializePlayer} />
        <Stack.Screen name="VideoAnalysis" component={VideoAnalysis} />
        <Stack.Screen name="ManageSquadStats" component={ManageSquadStats} />
        <Stack.Screen name="Security" component={SecurityScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        <Stack.Screen name="SquadChat" component={SquadChat} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}