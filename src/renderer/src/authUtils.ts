// Auth utilities for VetBuddy Desktop Overlay
// Uses localStorage instead of chrome.storage (same async interface for service compatibility)

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export async function getAuthToken(): Promise<string | null> {
  return localStorage.getItem('vetbuddy_token');
}

export async function setAuthToken(token: string): Promise<void> {
  localStorage.setItem('vetbuddy_token', token);
}

export async function removeAuthToken(): Promise<void> {
  localStorage.removeItem('vetbuddy_token');
  localStorage.removeItem('vetbuddy_user');
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = localStorage.getItem('vetbuddy_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getUserData(): Promise<any | null> {
  try {
    const raw = localStorage.getItem('vetbuddy_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setUserData(user: any): Promise<void> {
  localStorage.setItem('vetbuddy_user', JSON.stringify(user));
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
