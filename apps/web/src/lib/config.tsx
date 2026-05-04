import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.js";

export interface AppConfig {
  features: {
    twilio: boolean;
    twilio_sms: boolean;
    resend: boolean;
    resend_webhook_signed: boolean;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  features: { twilio: false, twilio_sms: false, resend: false, resend_webhook_signed: false },
};

const Ctx = createContext<AppConfig>(DEFAULT_CONFIG);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;
    api
      .get<AppConfig>("/api/config")
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        // Worst case we just leave defaults (everything disabled). Better than a
        // misleading "available" state if /api/config itself is broken.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export function useConfig(): AppConfig {
  return useContext(Ctx);
}
