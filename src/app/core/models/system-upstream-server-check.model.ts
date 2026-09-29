/**
 * Result of the check made by the api against an upstream server
 */
export interface ISystemUpstreamServerCheckServer {
  online: boolean;
  statusCode?: number;
  errorCode?: string;
  code?: string;
  responseTimeMs?: number;
}

export interface ISystemUpstreamServerCheckCredentials {
  valid: boolean;
  statusCode?: number;
  errorCode?: string;
  code?: string;
  outbreakIDs?: string[];
}

export interface ISystemUpstreamServerCheck {
  server: ISystemUpstreamServerCheckServer;

  // null when the credentials weren't checked
  credentials: ISystemUpstreamServerCheckCredentials | null;
}

/**
 * Summary of a check, used to display if a server can be used with its credentials
 */
export type SystemUpstreamServerConnectionStatus = 'checking' | 'online' | 'invalid_credentials' | 'api_not_found' | 'offline' | 'unknown';

export interface ISystemUpstreamServerConnection {
  status: SystemUpstreamServerConnectionStatus;

  // details, already translated
  message: string;
}
