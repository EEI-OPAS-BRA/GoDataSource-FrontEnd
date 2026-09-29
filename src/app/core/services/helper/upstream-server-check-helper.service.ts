import { Injectable } from '@angular/core';
import { I18nService } from './i18n.service';
import {
  ISystemUpstreamServerCheck,
  ISystemUpstreamServerConnection
} from '../../models/system-upstream-server-check.model';

@Injectable({
  providedIn: 'root'
})
export class UpstreamServerCheckHelperService {
  // message for each error code returned by the api when checking a server
  private static readonly ERROR_MESSAGES: {
    [errorCode: string]: string
  } = {
      CONNECTION_REFUSED: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_CONNECTION_REFUSED',
      HOST_NOT_FOUND: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_HOST_NOT_FOUND',
      TIMEOUT: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_TIMEOUT',
      CERTIFICATE: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_CERTIFICATE',
      UNEXPECTED_RESPONSE: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_NOT_GODATA',
      HTTP_ERROR: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_NOT_GODATA',
      INVALID_CREDENTIALS: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_INVALID_CREDENTIALS',
      API_NOT_FOUND: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_API_NOT_FOUND'
    };

  /**
   * Constructor
   */
  constructor(
    private i18nService: I18nService
  ) {}

  /**
   * Message for an error code returned by the api when checking a server
   */
  getErrorMessage(
    errorCode: string,
    code?: string
  ): string {
    const token: string = UpstreamServerCheckHelperService.ERROR_MESSAGES[errorCode];
    const message: string = this.i18nService.instant(
      token ||
      'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_CONNECTION_FAILED'
    );

    // technical code helps to find out what is wrong
    return !token && code ?
      `${message} (${code})` :
      message;
  }

  /**
   * Message for a server that is online
   */
  getServerOnlineMessage(responseTimeMs: number): string {
    return this.i18nService.instant(
      'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_ONLINE_MESSAGE', {
        ms: responseTimeMs
      }
    );
  }

  /**
   * Message for credentials that were accepted
   */
  getCredentialsAcceptedMessage(outbreakIDs: string[]): string {
    const outbreaksCount: number = outbreakIDs?.length || 0;
    return this.i18nService.instant(
      outbreaksCount > 0 ?
        'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_CREDENTIALS_ACCEPTED_SOME_OUTBREAKS' :
        'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_CREDENTIALS_ACCEPTED_ALL_OUTBREAKS', {
        count: outbreaksCount
      }
    );
  }

  /**
   * Summarize a check made with the credentials: a server is only usable if it is online & accepts the credentials
   */
  summarize(check: ISystemUpstreamServerCheck): ISystemUpstreamServerConnection {
    // server isn't online
    if (!check.server.online) {
      return {
        status: 'offline',
        message: this.getErrorMessage(
          check.server.errorCode,
          check.server.code
        )
      };
    }

    // credentials weren't checked
    if (!check.credentials) {
      return {
        status: 'unknown',
        message: this.getServerOnlineMessage(check.server.responseTimeMs)
      };
    }

    // accepted
    if (check.credentials.valid) {
      return {
        status: 'online',
        message: this.getCredentialsAcceptedMessage(check.credentials.outbreakIDs)
      };
    }

    // rejected
    const message: string = this.getErrorMessage(
      check.credentials.errorCode,
      check.credentials.code
    );
    switch (check.credentials.errorCode) {
      case 'INVALID_CREDENTIALS':
        return {
          status: 'invalid_credentials',
          message
        };

      case 'API_NOT_FOUND':
        return {
          status: 'api_not_found',
          message
        };

      // the server answered to the status route, but the api can't be reached
      default:
        return {
          status: 'offline',
          message
        };
    }
  }
}
