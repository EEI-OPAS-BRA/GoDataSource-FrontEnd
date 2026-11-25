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

  // used by ui
  loading: boolean;

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
