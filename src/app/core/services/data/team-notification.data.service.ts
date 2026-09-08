import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ModelHelperService } from '../helper/model-helper.service';
import { RequestQueryBuilder } from '../../helperClasses/request-query-builder';
import { TeamNotificationModel } from '../../models/team-notification.model';
import { TeamNotificationOccurrenceModel } from '../../models/team-notification-occurrence.model';
import { IBasicCount } from '../../models/basic-count.interface';

@Injectable()
export class TeamNotificationDataService {

  constructor(
    private http: HttpClient,
    private modelHelper: ModelHelperService
  ) {
  }

  /**
   * Retrieve the list of Team Notifications
   */
  getTeamNotificationsList(
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<TeamNotificationModel[]> {
    const filter = queryBuilder.buildQuery();
    return this.modelHelper.mapObservableListToModel(
      this.http.get(`team-notifications?filter=${filter}`),
      TeamNotificationModel
    );
  }

  /**
     * Return total number of team notifications
     */
  getTeamNotificationsCount(
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<IBasicCount> {
    const whereFilter = queryBuilder.filter.generateCondition(true);
    return this.http.get(`team-notifications/count?where=${whereFilter}`);
  }

  /**
     * Retrieve a Team Notification
     */
  getTeamNotification(
    teamNotificationId: string,
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<TeamNotificationModel> {
    const filter = queryBuilder.buildQuery();
    return this.modelHelper.mapObservableToModel(
      this.http.get(`team-notifications/${teamNotificationId}?filter=${filter}`),
      TeamNotificationModel
    );
  }

  /**
     * Create a new Team Notification
     */
  createTeamNotification(data: any): Observable<any> {
    return this.http.post('team-notifications', data);
  }

  /**
     * Modify an existing Team Notification
     */
  modifyTeamNotification(teamNotificationId: string, data: any): Observable<TeamNotificationModel> {
    return this.modelHelper.mapObservableToModel(
      this.http.patch(`team-notifications/${teamNotificationId}`, data),
      TeamNotificationModel
    );
  }

  /**
     * Delete an existing Team Notification
     */
  deleteTeamNotification(teamNotificationId: string): Observable<any> {
    return this.http.delete(`team-notifications/${teamNotificationId}`);
  }

  /**
   * Retrieve the current user's notification occurrences ( unread count + history )
   */
  getMyOccurrences(): Observable<{
    unreadCount: number,
    history: TeamNotificationOccurrenceModel[]
  }> {
    return this.http
      .get('team-notifications/my-occurrences')
      .pipe(
        map((response: {
          unreadCount: number,
          history: any[]
        }) => {
          return {
            unreadCount: response?.unreadCount ?? 0,
            history: (response?.history ?? []).map((item) => new TeamNotificationOccurrenceModel(item))
          };
        })
      );
  }

  /**
   * Mark a single occurrence as read for the current user
   */
  markOccurrenceRead(occurrenceId: string): Observable<any> {
    return this.http.post(`team-notifications/occurrences/${occurrenceId}/mark-read`, {});
  }

  /**
   * Mark all occurrences as read for the current user
   */
  markAllOccurrencesRead(): Observable<any> {
    return this.http.post('team-notifications/mark-all-read', {});
  }
}
