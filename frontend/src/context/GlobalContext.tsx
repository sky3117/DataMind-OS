'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { 
  Notification, 
  UploadedFile, 
  GlobalContextType 
} from '@/types';

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

const STORAGE_KEY = 'datamind_global_state';
const NOTIFICATION_DISMISS_TIMEOUT_MS = 3000;

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
  const timeoutRefsRef = useRef<Record<string, NodeJS.Timeout>>({});

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

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    // Clear timeout if exists
    if (timeoutRefsRef.current[id]) {
      clearTimeout(timeoutRefsRef.current[id]);
      delete timeoutRefsRef.current[id];
    }
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
      }, NOTIFICATION_DISMISS_TIMEOUT_MS);

      timeoutRefsRef.current[id] = timeout;
    },
    [removeNotification]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefsRef.current).forEach(clearTimeout);
    };
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
