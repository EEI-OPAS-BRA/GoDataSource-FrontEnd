import { Injectable } from '@angular/core';
import { SystemSyncLogModel } from '../../models/system-sync-log.model';
import { DialogV2Service } from './dialog-v2.service';
import { IV2SideDialogConfigButtonType, V2SideDialogConfigInputType } from '../../../shared/components-v2/app-side-dialog-v2/models/side-dialog-config.model';
import * as _ from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class SystemSyncLogHelperService {
  /**
   * Constructor
   */
  constructor(
    private dialogV2Service: DialogV2Service
  ) {}

  /**
   * Whether a sync log has an error / warning text to display
   */
  hasError(syncLog: SystemSyncLogModel): boolean {
    return !!syncLog && _.isString(syncLog.error) && !!syncLog.error.trim();
  }

  /**
   * View Error details
   */
  viewError(syncLog: SystemSyncLogModel): void {
    // if not string, then there is no point in continuing
    if (
      !syncLog.error ||
      !_.isString(syncLog.error)
    ) {
      return;
    }

    // fix api issue
    let error: string = syncLog.error.trim();
    let errJson: any;
    const detailsString: string = '"details":{';
    const detailsIndex: number = error.indexOf(detailsString);
    if (detailsIndex > -1) {
      try {
        // split error object & details object
        const detailsText: string = error.substr(detailsIndex, error.length - (detailsIndex + 2));
        const detailsObjectText: string = detailsText.substr(detailsString.length - 1);
        const errorText: string = error.substr(0, detailsIndex - 1) + '}';

        // convert to json
        errJson = JSON.parse(errorText);
        errJson.details = JSON.parse(detailsObjectText);
        error = errorText;
      } catch (e) {
        // not in the expected format, display it as it is
        errJson = undefined;
      }
    }

    this.dialogV2Service
      .showSideDialog({
        // title
        title: {
          get: () => 'LNG_PAGE_LIST_SYSTEM_SYNC_LOGS_ERROR_DETAILS_TITLE',
          data: () => {
            return { count: '?' };
          }
        },

        // hide search bar
        hideInputFilter: true,

        // inputs
        width: '65rem',
        inputs: [
          {
            type: V2SideDialogConfigInputType.HTML,
            name: 'error',
            placeholder: errJson ?
              `<code><pre>${JSON.stringify(errJson, null, 1)}</pre></code>` :
              `<code>${error}</code>`
          }
        ],

        // buttons
        bottomButtons: [
          {
            type: IV2SideDialogConfigButtonType.CANCEL,
            label: 'LNG_COMMON_BUTTON_CANCEL',
            color: 'text'
          }
        ]
      }).subscribe();
  }
}
