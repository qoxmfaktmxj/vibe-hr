export type AuthSessionPolicy = {
  access_ttl_min: number;
  refresh_threshold_min: number;
  remember_enabled: boolean;
  remember_ttl_min: number;
  show_countdown: boolean;
};
