import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

export interface EnabledModules {
  fuel: boolean;
  trips: boolean;
  maintenance: boolean;
  tires: boolean;
  fixedExpenses: boolean;
  documents: boolean;
  analytics: boolean;
}

export const DEFAULT_MODULES: EnabledModules = {
  fuel: true,
  trips: true,
  maintenance: true,
  tires: true,
  fixedExpenses: true,
  documents: true,
  analytics: true,
};

interface ModuleContextType {
  modules: EnabledModules;
  isModuleEnabled: (key: keyof EnabledModules) => boolean;
  toggleModule: (key: keyof EnabledModules) => Promise<void>;
  setModuleEnabled: (key: keyof EnabledModules, enabled: boolean) => Promise<void>;
  loading: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<EnabledModules>(() => {
    try {
      const stored = localStorage.getItem('vv_modules');
      if (stored) {
        return { ...DEFAULT_MODULES, ...JSON.parse(stored) };
      }
    } catch {}
    return DEFAULT_MODULES;
  });

  const [loading, setLoading] = useState(false);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ modules: EnabledModules }>('/api/settings/modules');
      if (res && res.modules) {
        const merged = { ...DEFAULT_MODULES, ...res.modules };
        setModules(merged);
        localStorage.setItem('vv_modules', JSON.stringify(merged));
      }
    } catch {
      // Offline or unauthenticated; fallback to localStorage
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const setModuleEnabled = async (key: keyof EnabledModules, enabled: boolean) => {
    const updated = { ...modules, [key]: enabled };
    setModules(updated);
    localStorage.setItem('vv_modules', JSON.stringify(updated));

    try {
      await apiFetch('/api/settings/modules', {
        method: 'PUT',
        body: JSON.stringify({ modules: updated }),
      });
    } catch (err) {
      console.error('Failed to sync module settings with backend:', err);
    }
  };

  const toggleModule = async (key: keyof EnabledModules) => {
    await setModuleEnabled(key, !modules[key]);
  };

  const isModuleEnabled = (key: keyof EnabledModules) => {
    return modules[key] !== false;
  };

  return (
    <ModuleContext.Provider
      value={{
        modules,
        isModuleEnabled,
        toggleModule,
        setModuleEnabled,
        loading,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = (): ModuleContextType => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
};
