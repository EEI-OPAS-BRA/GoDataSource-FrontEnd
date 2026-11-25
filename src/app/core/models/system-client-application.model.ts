import * as _ from 'lodash';
import { SystemUpstreamServerCredentialsModel } from './system-upstream-server-credentials.model';
import { v4 as uuid } from 'uuid';
import { IPermissionBasic, IPermissionClientApplication } from './permission.interface';
import { UserModel } from './user.model';
import { PERMISSION } from './permission.model';
import { BaseModel } from './base.model';

export class SystemClientApplicationModel
  extends BaseModel
  implements
    IPermissionBasic,
    IPermissionClientApplication {
  // types of key
  static readonly TYPE_INSTANCE: string = 'instance';
  static readonly TYPE_MOBILE: string = 'mobile';

  // data
  id: string;
  name: string;
  credentials: SystemUpstreamServerCredentialsModel;
  active: boolean;
  outbreakIDs: string[];

  // instance: another Go.Data instance, that asks to send each outbreak; mobile: the mobile app (or an older key), limited by outbreakIDs
  type: string;
  autoAcceptSameIdOutbreaks: boolean;

  // keys of other instances: when the instance sends its data (told by it when it syncs)
  senderSyncInterval: number;
  senderSyncEnabled: boolean;
  senderScheduleReportedAt: string;

  // when data was sent with this key the last time & how it went
  lastSyncAt: string;
  lastSyncStatus: string;

  // used by ui
  loading: boolean;

  // outbreaks of the client waiting for a decision / accepted (clients tab)
  pendingCount: number;
  acceptedCount: number;

  /**
   * Static Permissions - IPermissionBasic
   */
  static canView(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_VIEW) : false; }
  static canList(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_LIST) : false; }
  static canCreate(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_CREATE) : false; }
  static canModify(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_MODIFY) : false; }
  static canDelete(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_DELETE) : false; }

  /**
   * Static Permissions - IPermissionClientApplication
   */
  static canDownloadConfFile(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_DOWNLOAD_CONF_FILE) : false; }
  static canEnable(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_ENABLE) : false; }
  static canDisable(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.CLIENT_APPLICATION_DISABLE) : false; }

  /**
   * Constructor
   */
  constructor(data = null) {
    super(data);

    this.id = _.get(data, 'id', uuid());
    this.name = _.get(data, 'name');
    this.credentials = new SystemUpstreamServerCredentialsModel(_.get(data, 'credentials'));
    this.active = _.get(data, 'active', true);
    this.outbreakIDs = _.get(data, 'outbreakIDs', []);
    this.type = _.get(data, 'type');
    this.autoAcceptSameIdOutbreaks = _.get(data, 'autoAcceptSameIdOutbreaks', false);
    this.senderSyncInterval = _.get(data, 'senderSyncInterval');
    this.senderSyncEnabled = _.get(data, 'senderSyncEnabled');
    this.senderScheduleReportedAt = _.get(data, 'senderScheduleReportedAt');
    this.lastSyncAt = _.get(data, 'lastSyncAt');
    this.lastSyncStatus = _.get(data, 'lastSyncStatus');
  }

  /**
   * When the data is sent with this key (text to translate & its data)
   */
  get schedule(): { token: string, data?: { [key: string]: any } } {
    // the mobile app sends its data when the user syncs it
    if (!this.usesRequests) {
      return { token: 'LNG_SYNC_CLIENT_SCHEDULE_MOBILE' };
    }

    // older versions don't tell when they send their data, neither an instance that didn't sync yet
    if (
      this.senderSyncInterval === undefined ||
      this.senderSyncInterval === null
    ) {
      return { token: 'LNG_SYNC_CLIENT_SCHEDULE_UNKNOWN' };
    }

    // paused at the instance that sends the data
    if (this.senderSyncEnabled === false) {
      return { token: 'LNG_SYNC_CLIENT_SCHEDULE_PAUSED' };
    }

    return this.senderSyncInterval > 0 ?
      { token: 'LNG_SYNC_UPSTREAM_SERVER_EVERY_HOURS', data: { hours: this.senderSyncInterval } } :
      { token: 'LNG_SYNC_UPSTREAM_SERVER_NO_INTERVAL' };
  }

  /**
   * The data should have arrived already ? (more than twice the time between the syncs of the instance)
   */
  get isLate(): boolean {
    if (
      !this.usesRequests ||
      !this.active ||
      this.senderSyncEnabled === false ||
      !(this.senderSyncInterval > 0) ||
      !this.lastSyncAt
    ) {
      return false;
    }

    return Date.now() - new Date(this.lastSyncAt).getTime() > this.senderSyncInterval * 2 * 3600000;
  }

  /**
   * The last data sent with this key failed ?
   */
  get lastSyncFailed(): boolean {
    return this.lastSyncStatus === 'LNG_SYNC_STATUS_FAILED';
  }

  /**
   * The key asks for each outbreak ? (key of another Go.Data instance)
   */
  get usesRequests(): boolean {
    return this.type === SystemClientApplicationModel.TYPE_INSTANCE;
  }

  /**
   * Permissions - IPermissionBasic
   */
  canView(user: UserModel): boolean { return SystemClientApplicationModel.canView(user); }
  canList(user: UserModel): boolean { return SystemClientApplicationModel.canList(user); }
  canCreate(user: UserModel): boolean { return SystemClientApplicationModel.canCreate(user); }
  canModify(user: UserModel): boolean { return SystemClientApplicationModel.canModify(user); }
  canDelete(user: UserModel): boolean { return SystemClientApplicationModel.canDelete(user); }

  /**
   * Permissions - IPermissionClientApplication
   */
  canDownloadConfFile(user: UserModel): boolean { return SystemClientApplicationModel.canDownloadConfFile(user); }
  canEnable(user: UserModel): boolean { return SystemClientApplicationModel.canEnable(user); }
  canDisable(user: UserModel): boolean { return SystemClientApplicationModel.canDisable(user); }
}
