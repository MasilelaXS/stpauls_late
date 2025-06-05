import React, { createContext, useContext, useState, useEffect } from "react";
import { registerSW } from "virtual:pwa-register";

interface PWAContextType {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error("usePWA must be used within a PWAProvider");
  }
  return context;
};

interface PWAProviderProps {
  children: React.ReactNode;
}

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] =
    useState<(reloadPage?: boolean) => Promise<void>>();

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
        console.log("App ready to work offline");
      },
    });

    setUpdateServiceWorker(() => updateSW);
  }, []);

  const value: PWAContextType = {
    needRefresh,
    offlineReady,
    updateServiceWorker: updateServiceWorker || (() => Promise.resolve()),
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
};

export default PWAProvider;
