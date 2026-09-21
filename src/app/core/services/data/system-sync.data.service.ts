import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ModelHelperService } from '../helper/model-helper.service';
import { SystemSyncModel } from '../../models/system-sync.model';
import { ISystemUpstreamServerCheck } from '../../models/system-upstream-server-check.model';

@Injectable()
export class SystemSyncDataService {
  /**
     * Constructor
     */
  constructor(
    private http: HttpClient,
    private modelHelper: ModelHelperService
  ) {
  }

  /**
     * Start sync process
     */
  sync(upstreamServerURL: string): Observable<SystemSyncModel> {
    return this.modelHelper.mapObservableToModel(
      this.http.post('sync', {
        upstreamServerURL: upstreamServerURL
      }),
      SystemSyncModel
    );
  }

  /**
     * Check if an upstream server is online and, when the client id & secret are sent, if they are accepted
     */
  checkUpstreamServer(data: {
    url: string,
    clientId?: string,
    clientSecret?: string
  }): Observable<ISystemUpstreamServerCheck> {
    return this.http.post<ISystemUpstreamServerCheck>(
      'sync/check-upstream-server',
      data
    );
  }
}

