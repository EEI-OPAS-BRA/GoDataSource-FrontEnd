import * as _ from 'lodash';
import { LocalizationHelper, Moment } from '../helperClasses/localization-helper';

export class TeamNotificationOccurrenceModel {
  id: string;
  teamNotificationId: string;
  teamId: string;
  title: string;
  message: string;
  severity: string;
  triggeredAt: Moment;
  readBy: string[];

  /**
     * Constructor
     */
  constructor(data = null) {
    this.id = _.get(data, 'id');
    this.teamNotificationId = _.get(data, 'teamNotificationId');
    this.teamId = _.get(data, 'teamId');
    this.title = _.get(data, 'title');
    this.message = _.get(data, 'message');
    this.severity = _.get(data, 'severity');
    this.readBy = _.get(data, 'readBy', []);

    // triggered at
    this.triggeredAt = _.get(data, 'triggeredAt');
    if (this.triggeredAt) {
      this.triggeredAt = LocalizationHelper.toMoment(this.triggeredAt);
    }
  }

  /**
   * Check if occurrence was read by a given user
   */
  isReadByUser(userId: string): boolean {
    return !!userId && this.readBy?.indexOf(userId) > -1;
  }
}
