import * as _ from 'lodash';
import { UserModel } from './user.model';
import { IPermissionBasic } from './permission.interface';
import { PERMISSION } from './permission.model';
import { BaseModel } from './base.model';
import { Constants } from './constants';

export class TeamNotificationModel
  extends BaseModel
  implements IPermissionBasic {
  id: string;
  teamId: string;
  title: string;
  message: string;
  severity: string;
  recurring: boolean;
  recurrenceInterval: number;
  recurrenceUnit: string;
  active: boolean;
  lastTriggeredAt: string;

  // UI state only - not persisted
  loading?: boolean;

  /**
     * Static Permissions - IPermissionBasic
     */
  static canView(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.TEAM_NOTIFICATION_VIEW) : false; }
  static canList(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.TEAM_NOTIFICATION_LIST) : false; }
  static canCreate(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.TEAM_NOTIFICATION_CREATE) : false; }
  static canModify(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.TEAM_NOTIFICATION_MODIFY) : false; }
  static canDelete(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.TEAM_NOTIFICATION_DELETE) : false; }

  /**
     * Constructor
     */
  constructor(data = null) {
    // parent
    super(data);

    // data
    this.id = _.get(data, 'id');
    this.teamId = _.get(data, 'teamId');
    this.title = _.get(data, 'title');
    this.message = _.get(data, 'message');
    this.severity = _.get(data, 'severity');
    this.recurring = _.get(data, 'recurring', false);
    this.recurrenceInterval = _.get(data, 'recurrenceInterval');
    this.recurrenceUnit = _.get(data, 'recurrenceUnit');
    this.active = _.get(data, 'active', true);
    this.lastTriggeredAt = _.get(data, 'lastTriggeredAt');
  }

  /**
   * Severity color - used by the color column format in the list table
   */
  get severityColor(): string {
    switch (this.severity) {
      case Constants.TEAM_NOTIFICATION_SEVERITY.YELLOW.value:
        return Constants.TEAM_NOTIFICATION_SEVERITY.YELLOW.color;
      case Constants.TEAM_NOTIFICATION_SEVERITY.RED.value:
        return Constants.TEAM_NOTIFICATION_SEVERITY.RED.color;
      default:
        return Constants.TEAM_NOTIFICATION_SEVERITY.GREEN.color;
    }
  }

  /**
     * Permissions - IPermissionBasic
     */
  canView(user: UserModel): boolean { return TeamNotificationModel.canView(user); }
  canList(user: UserModel): boolean { return TeamNotificationModel.canList(user); }
  canCreate(user: UserModel): boolean { return TeamNotificationModel.canCreate(user); }
  canModify(user: UserModel): boolean { return TeamNotificationModel.canModify(user); }
  canDelete(user: UserModel): boolean { return TeamNotificationModel.canDelete(user); }
}
