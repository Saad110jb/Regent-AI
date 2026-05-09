import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:8002'; 

// Inside src/api/auth.js
export const login = async (email, password) => {
  const targetUrl = `${API_URL}/auth/login`;
  console.log("AUTH_ATTEMPT:", targetUrl);
  
  // Use URLSearchParams for x-www-form-urlencoded (Best for FastAPI OAuth2)
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  try {
    const response = await axios.post(targetUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000, 
    });
    
    console.log("AUTH_RAW_DATA_RECEIVED:", !!response.data);

    if (response.data.access_token) {
      await AsyncStorage.setItem('userToken', response.data.access_token);
      console.log("TOKEN_STORED_SUCCESSFULLY");
    }
    return response.data;
  } catch (error) {
    console.error("LOGIN_API_ERROR:", error.message);
    throw error;
  }
};

export const register = async (userData) => {
  // Registration sends JSON for the dynamic coach/player roles
  const response = await axios.post(`${API_URL}/auth/register`, userData);
  return response.data;
};
