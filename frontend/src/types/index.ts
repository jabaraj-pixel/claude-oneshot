export interface DatabaseHealth {
  status: string;
  connected: boolean;
  message: string;
}

export interface IntegrationsStatus {
  sarvam_ai: boolean;
  exotel_telephony: boolean;
  whatsapp_messaging: boolean;
  sms_gateway: boolean;
  gtfs_fixtures: boolean;
  [key: string]: boolean;
}

export interface BackendHealth {
  status: 'ok' | 'ok_standalone' | 'degraded' | 'unhealthy' | string;
  timestamp: string;
  version: string;
  environment: string;
  database: DatabaseHealth;
  integrations: IntegrationsStatus;
}

export type PageId =
  | 'overview'
  | 'calls'
  | 'journeys'
  | 'complaints'
  | 'messaging'
  | 'settings';

export interface NavigationItem {
  id: PageId;
  label: string;
  iconName: string;
  badge?: string;
}
