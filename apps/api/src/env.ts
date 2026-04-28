// Worker environment bindings. Mirrors wrangler.toml + secrets.
export interface Env {
  DB: D1Database;
  BROWSER?: Fetcher;

  // vars
  SENDER_EMAIL: string;
  SENDER_NAME: string;
  DAILY_EMAIL_CAP: string;

  // secrets
  APP_PASSWORD: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_API_KEY: string;
  TWILIO_API_SECRET: string;
  TWILIO_TWIML_APP_SID: string;
  TWILIO_PHONE_NUMBER: string;
  BROWSER_RENDERING_TOKEN?: string;
}

// Hono context variables — populated by middleware.
export interface AppVariables {
  authed: boolean;
}

export type AppBindings = { Bindings: Env; Variables: AppVariables };
