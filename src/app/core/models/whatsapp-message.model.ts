import * as _ from 'lodash';
import { UserModel } from './user.model';
import { IPermissionBasic } from './permission.interface';
import { PERMISSION } from './permission.model';
import { BaseModel } from './base.model';
import { Constants } from './constants';

export class WhatsappMessageModel
  extends BaseModel
  implements IPermissionBasic {
  id: string;
  outbreakId: string;
  title: string;
  message: string;
  appliesTo: string;
  active: boolean;

  // UI state only - not persisted
  loading?: boolean;

  /**
   * Static Permissions - IPermissionBasic
   */
  static canView(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.WHATSAPP_MESSAGE_VIEW) : false; }
  static canList(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.WHATSAPP_MESSAGE_LIST) : false; }
  static canCreate(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.WHATSAPP_MESSAGE_CREATE) : false; }
  static canModify(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.WHATSAPP_MESSAGE_MODIFY) : false; }
  static canDelete(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.WHATSAPP_MESSAGE_DELETE) : false; }
  static canSend(user: UserModel): boolean { return user ? user.hasPermissions(PERMISSION.WHATSAPP_MESSAGE_SEND) : false; }

  /**
   * Constructor
   */
  constructor(data = null) {
    // parent
    super(data);

    // data
    this.id = _.get(data, 'id');
    this.outbreakId = _.get(data, 'outbreakId');
    this.title = _.get(data, 'title');
    this.message = _.get(data, 'message');
    this.appliesTo = _.get(data, 'appliesTo') || Constants.WHATSAPP_MESSAGE_APPLIES_TO.ALL.value;
    this.active = _.get(data, 'active', true);
  }

  /**
   * Permissions - IPermissionBasic
   */
  canView(user: UserModel): boolean { return WhatsappMessageModel.canView(user); }
  canList(user: UserModel): boolean { return WhatsappMessageModel.canList(user); }
  canCreate(user: UserModel): boolean { return WhatsappMessageModel.canCreate(user); }
  canModify(user: UserModel): boolean { return WhatsappMessageModel.canModify(user); }
  canDelete(user: UserModel): boolean { return WhatsappMessageModel.canDelete(user); }
}
