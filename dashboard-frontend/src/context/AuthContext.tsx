import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserSettings } from '../types';
import { API_BASE, fetchApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings> & { botDisplayName?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const data = await fetchApi<{ user: User; settings: UserSettings }>('/auth/me');
      setUser(data.user);
      setSettings(data.settings);
    } catch {
      setUser(null);
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setSettings(null);
      window.location.href = '/login';
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings> & { botDisplayName?: string }) => {
    const data = await fetchApi<{ success: boolean; settings: UserSettings; botDisplayName?: string }>(
      '/api/settings',
      {
        method: 'PUT',
        body: JSON.stringify({
          botDisplayName: newSettings.botDisplayName,
          enableVideo: newSettings.enable_video,
          enableAudio: newSettings.enable_audio,
          enableTranscription: newSettings.enable_transcription,
          driveFolderName: newSettings.drive_folder_name,
          maxRecordingMinutes: newSettings.max_recording_minutes,
          autoJoin: newSettings.auto_join,
          telegramChatId: newSettings.telegram_chat_id,
        }),
      }
    );

    if (data.settings) {
      setSettings(data.settings);
    }
    if (data.botDisplayName && user) {
      setUser({ ...user, botDisplayName: data.botDisplayName });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isLoading,
        loginWithGoogle,
        logout,
        refreshUser,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
