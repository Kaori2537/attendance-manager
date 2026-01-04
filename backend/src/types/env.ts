// backend/src/types/env.ts
export type Env = {
  SUPABASE_URL: string;
  SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;

  // Slack
  SLACK_BOT_TOKEN: string;
  SLACK_CHANNEL_ID: string;

   SLACK_SIGNING_SECRET: string; 
};