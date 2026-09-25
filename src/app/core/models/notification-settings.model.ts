import * as _ from 'lodash';

export class NotificationSettingsModel {
  historyCount: number;
  checkInterval: number;
  checkIntervalUnit: string;

  /**
     * Constructor
     */
  constructor(data = null) {
    this.historyCount = _.get(data, 'historyCount');
    this.checkInterval = _.get(data, 'checkInterval');
    this.checkIntervalUnit = _.get(data, 'checkIntervalUnit');
  }
}
