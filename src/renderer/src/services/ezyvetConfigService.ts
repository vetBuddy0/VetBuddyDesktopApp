/**
 * ezyVet Configuration Service - Desktop Overlay version
 * Uses localStorage instead of chrome.storage for fallback caching.
 */

import type { EzyVetClinicConfig, EzyVetClinicalRecord } from "../types/ezyvetConfig";
import { DEFAULT_EZYVET_RECORDS } from "../types/ezyvetConfig";
import { getAuthHeaders } from "../authUtils";
import { logout } from "../authService";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";
const LOCAL_STORAGE_KEY = "vetbuddy_ezyvet_config";

async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await logout();
    }
    const text = await response.text();
    let errorMessage = "Request failed";
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

function getDefaultConfig(): EzyVetClinicConfig {
  return {
    clinicId: 0,
    records: DEFAULT_EZYVET_RECORDS.map((r) => ({ ...r })),
    defaultMappings: {},
    updatedAt: new Date().toISOString(),
  };
}

// Fallback: Read from localStorage
async function getLocalConfig(): Promise<EzyVetClinicConfig | null> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Fallback: Write to localStorage
async function saveLocalConfig(config: EzyVetClinicConfig): Promise<void> {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
}

export const ezyvetConfigService = {
  async getConfig(): Promise<EzyVetClinicConfig> {
    try {
      const config = await apiRequest<EzyVetClinicConfig>("GET", "/api/clinic/ezyvet-config");
      if (!config.records || config.records.length === 0) {
        config.records = DEFAULT_EZYVET_RECORDS.map((r) => ({ ...r }));
      }
      await saveLocalConfig(config);
      return config;
    } catch (err) {
      console.warn("[EzyVetConfig] API fetch failed, trying local storage:", err);
      const local = await getLocalConfig();
      if (local) return local;
      return getDefaultConfig();
    }
  },

  async saveConfig(records: EzyVetClinicalRecord[]): Promise<EzyVetClinicConfig> {
    try {
      const config = await apiRequest<EzyVetClinicConfig>("PUT", "/api/clinic/ezyvet-config", { records });
      await saveLocalConfig(config);
      return config;
    } catch (err) {
      console.warn("[EzyVetConfig] API save failed, saving locally:", err);
      const localConfig: EzyVetClinicConfig = {
        clinicId: 0,
        records,
        defaultMappings: {},
        updatedAt: new Date().toISOString(),
      };
      await saveLocalConfig(localConfig);
      return localConfig;
    }
  },

  async getEnabledRecords(): Promise<Array<{ name: string; displayName: string; inputFieldSelector: string; order: number }>> {
    const config = await this.getConfig();
    return config.records
      .filter((r) => r.enabled && r.inputFieldSelector)
      .sort((a, b) => a.order - b.order)
      .map((r) => ({
        name: r.name,
        displayName: r.alternateName || r.name,
        inputFieldSelector: r.inputFieldSelector,
        order: r.order,
      }));
  },

  async getMappings(templateId: string | number): Promise<Array<{ title: string; ezyVetMapping: string }>> {
    const config = await this.getConfig();
    return config.defaultMappings?.[String(templateId)] || [];
  },

  async saveMappings(
    templateId: string | number,
    mappings: Array<{ title: string; ezyVetMapping: string }>
  ): Promise<void> {
    const config = await this.getConfig();
    const updated = { ...config.defaultMappings, [String(templateId)]: mappings };
    try {
      const saved = await apiRequest<EzyVetClinicConfig>("PUT", "/api/clinic/ezyvet-config", { defaultMappings: updated });
      await saveLocalConfig(saved);
    } catch (err) {
      console.warn("[EzyVetConfig] API save mappings failed, saving locally:", err);
      config.defaultMappings = updated;
      config.updatedAt = new Date().toISOString();
      await saveLocalConfig(config);
    }
  },

  async clearConfig(): Promise<void> {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  },
};
