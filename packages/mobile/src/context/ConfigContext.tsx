import React, { createContext, useContext, useState, useEffect } from 'react';
import { resolveApiUrl } from '../config/api';
import { updateApiBaseUrl } from '../api/client';

interface ConfigContextType {
  apiUrl: string;
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const refreshConfig = async () => {
    const url = await resolveApiUrl();
    updateApiBaseUrl(url);
    setApiUrl(url);
  };

  useEffect(() => {
    refreshConfig().finally(() => setIsLoading(false));
  }, []);

  return (
    <ConfigContext.Provider value={{ apiUrl, isLoading, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
