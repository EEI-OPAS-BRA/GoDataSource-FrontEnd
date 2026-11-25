import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ModelHelperService } from '../helper/model-helper.service';
import { RequestQueryBuilder } from '../../helperClasses/request-query-builder';
import {
  ISyncOutbreakAccessWaitingCount,
  SyncOutbreakAccessModel,
  UpstreamOutbreakAccessModel
} from '../../models/sync-outbreak-access.model';

/**
 * Outbreaks other Go.Data instances ask to send (receiver) & decisions of the upstream servers about the outbreaks of this instance (sender)
 */
@Injectable({
  providedIn: 'root'
})
export class SyncOutbreakAccessDataService {
  /**
   * Constructor
   */
  constructor(
    private http: HttpClient,
    private modelHelper: ModelHelperService
  ) {}

  /**
   * Receiver - outbreaks other instances asked to send
   */
  getAccessList(
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<SyncOutbreakAccessModel[]> {
    const filter = queryBuilder.buildQuery();
    return this.modelHelper.mapObservableListToModel(
      this.http.get(`sync-outbreak-accesses?filter=${filter}`),
      SyncOutbreakAccessModel
    );
  }

  /**
   * Receiver - number of received outbreaks waiting for the user
   */
  getWaitingCount(): Observable<ISyncOutbreakAccessWaitingCount> {
    return this.http.get('sync-outbreak-accesses/waiting-count') as Observable<ISyncOutbreakAccessWaitingCount>;
  }

  /**
   * Receiver - accept an outbreak that exists in this instance with the same id (the others are accepted when their review is approved)
   */
  accept(id: string): Observable<SyncOutbreakAccessModel> {
    return this.http
      .post(`sync-outbreak-accesses/${id}/accept`, {})
      .pipe(map((data) => new SyncOutbreakAccessModel(data)));
  }

  /**
   * Receiver - refuse the data of an outbreak
   */
  refuse(id: string): Observable<SyncOutbreakAccessModel> {
    return this.http
      .post(`sync-outbreak-accesses/${id}/refuse`, {})
      .pipe(map((data) => new SyncOutbreakAccessModel(data)));
  }

  /**
   * Receiver - stop receiving the data of an accepted outbreak until it is resumed (what was received is kept)
   */
  pause(id: string): Observable<SyncOutbreakAccessModel> {
    return this.http
      .post(`sync-outbreak-accesses/${id}/pause`, {})
      .pipe(map((data) => new SyncOutbreakAccessModel(data)));
  }

  /**
   * Receiver - receive again the data of a paused outbreak (the other instance sends what changed meanwhile)
   */
  resume(id: string): Observable<SyncOutbreakAccessModel> {
    return this.http
      .post(`sync-outbreak-accesses/${id}/resume`, {})
      .pipe(map((data) => new SyncOutbreakAccessModel(data)));
  }

  /**
   * Receiver - remove the decision about an outbreak (what was received is kept; if the other instance still wants to send it, it is asked again)
   */
  remove(id: string): Observable<SyncOutbreakAccessModel> {
    return this.http
      .post(`sync-outbreak-accesses/${id}/remove`, {})
      .pipe(map((data) => new SyncOutbreakAccessModel(data)));
  }

  /**
   * Sender - last known decisions of the upstream servers
   */
  getUpstreamAccessList(): Observable<UpstreamOutbreakAccessModel[]> {
    return this.modelHelper.mapObservableListToModel(
      this.http.get('upstream-outbreak-accesses'),
      UpstreamOutbreakAccessModel
    );
  }

  /**
   * Sender - ask an upstream server for its decisions; the outbreaks it doesn't know yet are requested
   */
  checkUpstreamAccess(upstreamServerURL: string): Observable<UpstreamOutbreakAccessModel> {
    return this.http
      .post('sync/upstream-servers/outbreak-access', {
        upstreamServerURL
      })
      .pipe(map((data) => new UpstreamOutbreakAccessModel(data)));
  }
}
