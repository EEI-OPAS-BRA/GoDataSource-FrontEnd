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
