// Auth utilities for VetBuddy Desktop Overlay
// Uses localStorage instead of chrome.storage (same async interface for service compatibility)

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export async function getAuthToken(): Promise<string | null> {
  const electron = (window as any).electron;
  if (!electron?.secureStorage) {
    return localStorage.getItem('vetbuddy_token');
  }

  let token = await electron.secureStorage.get('token');
  if (!token) {
    // Migration: Check localStorage
    token = localStorage.getItem('vetbuddy_token');
    if (token) {
      await electron.secureStorage.set('token', token);
      localStorage.removeItem('vetbuddy_token');
    }
  }
  return token;
}

export async function setAuthToken(token: string): Promise<void> {
  const electron = (window as any).electron;
  if (electron?.secureStorage) {
    await electron.secureStorage.set('token', token);
    localStorage.removeItem('vetbuddy_token');
  } else {
    localStorage.setItem('vetbuddy_token', token);
  }
}

export async function removeAuthToken(): Promise<void> {
  const electron = (window as any).electron;
  if (electron?.secureStorage) {
    await electron.secureStorage.remove('token');
    await electron.secureStorage.remove('user');
  }
  localStorage.removeItem('vetbuddy_token');
  localStorage.removeItem('vetbuddy_user');
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getUserData(): Promise<any | null> {
  const electron = (window as any).electron;
  try {
    if (!electron?.secureStorage) {
      const raw = localStorage.getItem('vetbuddy_user');
      return raw ? JSON.parse(raw) : null;
    }

    let raw = await electron.secureStorage.get('user');
    if (!raw) {
      // Migration
      raw = localStorage.getItem('vetbuddy_user');
      if (raw) {
        await electron.secureStorage.set('user', raw);
        localStorage.removeItem('vetbuddy_user');
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setUserData(user: any): Promise<void> {
  const electron = (window as any).electron;
  const raw = JSON.stringify(user);
  if (electron?.secureStorage) {
    await electron.secureStorage.set('user', raw);
    localStorage.removeItem('vetbuddy_user');
  } else {
    localStorage.setItem('vetbuddy_user', raw);
  }
}

export async function removeUserData(): Promise<void> {
  localStorage.removeItem('vetbuddy_user');
}

export async function hasActiveSubscription(): Promise<boolean> {
  const user = await getUserData();
  if (!user || !user.subscriptionStatus || !user.subscriptionEndDate) {
    return false;
  }
  const isActive = user.subscriptionStatus.toLowerCase() === 'active';
  const endDate = new Date(user.subscriptionEndDate);
  const isNotExpired = endDate > new Date();
  return isActive && isNotExpired;
}
