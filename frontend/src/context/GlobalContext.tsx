'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
}

export interface UploadedFile {
  file_id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface GlobalContextType {
  fileId: string | null;
  filename: string | null;
  fileMetadata: Record<string, unknown> | null;
  uploadedFiles: UploadedFile[];
  activeTab: string;
  notifications: Notification[];
  setFileId: (fileId: string | null) => void;
  setFilename: (filename: string | null) => void;
  setFileMetadata: (metadata: Record<string, unknown> | null) => void;
  setUploadedFiles: (files: UploadedFile[]) => void;
  setActiveTab: (tab: string) => void;
  addNotification: (message: string, type: Notification['type']) => void;
  removeNotification: (id: string) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

const STORAGE_KEY = 'datamind_global_state';

interface StoredState {
  fileId: string | null;
  filename: string | null;
  uploadedFiles: UploadedFile[];
  activeTab: string;
}

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [fileId, setFileIdState] = useState<string | null>(null);
  const [filename, setFilenameState] = useState<string | null>(null);
  const [fileMetadata, setFileMetadataState] =
    useState<Record<string, unknown> | null>(null);
  const [uploadedFiles, setUploadedFilesState] = useState<UploadedFile[]>([]);
  const [activeTab, setActiveTabState] = useState('home');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const state: StoredState = JSON.parse(stored);
        setFileIdState(state.fileId);
        setFilenameState(state.filename);
        setUploadedFilesState(state.uploadedFiles);
        setActiveTabState(state.activeTab);
      } catch (err) {
        console.error('Failed to load global state from localStorage:', err);
      }
    }
    setIsHydrated(true);
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      const state: StoredState = {
        fileId,
        filename,
        uploadedFiles,
        activeTab,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [fileId, filename, uploadedFiles, activeTab, isHydrated]);

  const setFileId = useCallback((id: string | null) => {
    setFileIdState(id);
  }, []);

  const setFilename = useCallback((name: string | null) => {
    setFilenameState(name);
  }, []);

  const setFileMetadata = useCallback(
    (metadata: Record<string, unknown> | null) => {
      setFileMetadataState(metadata);
    },
    []
  );

  const setUploadedFiles = useCallback((files: UploadedFile[]) => {
    setUploadedFilesState(files);
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
  }, []);

  const addNotification = useCallback(
    (message: string, type: Notification['type']) => {
      const id = `notif_${Date.now()}`;
      const notification: Notification = {
        id,
        message,
        type,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [...prev, notification]);

      // Auto-dismiss after 3 seconds
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, 3000);

      return () => clearTimeout(timeout);
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value: GlobalContextType = {
    fileId,
    filename,
    fileMetadata,
    uploadedFiles,
    activeTab,
    notifications,
    setFileId,
    setFilename,
    setFileMetadata,
    setUploadedFiles,
    setActiveTab,
    addNotification,
    removeNotification,
  };

  return (
    <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within GlobalProvider');
  }
  return context;
}
