// Auth service for VetBuddy Desktop Overlay
// Email/password only — no Firebase, no Google OAuth

import { setAuthToken, setUserData, removeAuthToken } from './authUtils';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

async function apiRequest(method: string, endpoint: string, body?: any) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'Request failed';
    try {
      const error = JSON.parse(text);
      errorMessage = error.message || text;
    } catch {
      errorMessage = text || response.statusText;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function login(email: string, password: string) {
  try {
    const data = await apiRequest('POST', '/api/extension/login', {
      email: email.toLowerCase(),
      password,
    });

    if (data && data.success && data.token) {
      await setAuthToken(data.token);
      if (data.user) {
        await setUserData(data.user);
      }
      return data.user;
    } else {
      throw new Error(data.message || 'Authentication failed');
    }
  } catch (error: any) {
    if (error.message?.includes('Invalid email or password')) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    }
    throw new Error(error.message || 'Login failed. Please try again.');
  }
}

export async function signup(name: string, email: string, password: string) {
  try {
    const data = await apiRequest('POST', '/api/extension/register', {
      email: email.toLowerCase(),
      password,
      fullName: name,
    });

    if (data && data.success && data.token) {
      await setAuthToken(data.token);
      if (data.user) {
        await setUserData(data.user);
      }
      return data.user;
    } else {
      throw new Error(data.message || 'Registration failed');
    }
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      throw new Error('An account with this email already exists. Please try logging in instead.');
    }
    throw new Error(error.message || 'Registration failed. Please try again.');
  }
}

export async function logout() {
  await removeAuthToken();
}
