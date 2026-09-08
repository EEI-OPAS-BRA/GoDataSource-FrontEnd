import { Component, OnDestroy } from '@angular/core';
import { Subject, throwError } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { PERMISSION } from '../../../../core/models/permission.model';
import { UserModel } from '../../../../core/models/user.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { Constants } from '../../../../core/models/constants';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { IV2ActionIconLabel, V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import {
  IV2SideDialogConfigButtonType,
  IV2SideDialogConfigInputKeyValue,
  IV2SideDialogConfigInputNumber,
  IV2SideDialogConfigInputSingleDropdown,
  V2SideDialogConfigInputType
} from '../../../../shared/components-v2/app-side-dialog-v2/models/side-dialog-config.model';

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html'
})
export class NotificationSettingsComponent implements OnDestroy {
  // constants
  PERMISSION = PERMISSION;
  V2ActionType = V2ActionType;

  // breadcrumbs
  breadcrumbs: IV2Breadcrumb[] = [];

  // action button
  actionButton: IV2ActionIconLabel;

  // authenticated user
  private authUser: UserModel;

  // destroy
  private destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private authDataService: AuthDataService,
    private systemSettingsDataService: SystemSettingsDataService,
    private dialogV2Service: DialogV2Service,
    private toastV2Service: ToastV2Service
  ) {
    // authenticated user
    this.authUser = this.authDataService.getAuthenticatedUser();

    // breadcrumbs
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this.authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_PAGE_NOTIFICATION_SETTINGS_TITLE',
        action: null
      }
    ];

    // action button
    this.actionButton = {
      type: V2ActionType.ICON_LABEL,
      label: 'LNG_PAGE_NOTIFICATION_SETTINGS_ACTION_CONFIGURE_BUTTON',
      icon: 'settings',
      action: {
        click: () => {
          this.configureNotificationSettings();
        }
      },
      visible: (): boolean => this.canConfigure()
    };
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /**
   * Check if the current user can configure the notification settings
   */
  canConfigure(): boolean {
    return this.authUser ?
      this.authUser.hasPermissions(PERMISSION.SYSTEM_SETTINGS_MODIFY) :
      false;
  }

  /**
   * Configure team notification settings
   */
  configureNotificationSettings(): void {
    let currentSettings: SystemSettingsModel;
    this.dialogV2Service
      .showSideDialog({
        // title
        title: {
          get: () => 'LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_TITLE'
        },

        // width
        width: '60rem',

        // hide search bar
        hideInputFilter: true,

        // inputs
        inputs: [
          // info
          {
            type: V2SideDialogConfigInputType.DIVIDER,
            placeholder: 'LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_EXISTING_CONFIGURATION_INFO'
          },
          {
            type: V2SideDialogConfigInputType.KEY_VALUE,
            name: 'historyCountLabel',
            placeholder: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_HISTORY_COUNT',
            value: undefined
          },
          {
            type: V2SideDialogConfigInputType.KEY_VALUE,
            name: 'checkIntervalLabel',
            placeholder: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL',
            value: undefined
          },

          // change section
          {
            type: V2SideDialogConfigInputType.DIVIDER,
            placeholder: 'LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_TITLE'
          },

          // history count
          {
            type: V2SideDialogConfigInputType.NUMBER,
            name: 'historyCount',
            placeholder: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_HISTORY_COUNT',
            tooltip: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_HISTORY_COUNT_DESCRIPTION',
            value: undefined,
            validators: {
              required: () => true
            }
          },

          // check interval
          {
            type: V2SideDialogConfigInputType.NUMBER,
            name: 'checkInterval',
            placeholder: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL',
            tooltip: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL_DESCRIPTION',
            value: undefined,
            validators: {
              required: () => true
            }
          },

          // check interval unit
          {
            type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
            name: 'checkIntervalUnit',
            placeholder: 'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL_UNIT',
            options: [
              Constants.NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT.MINUTES,
              Constants.NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT.HOURS,
              Constants.NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT.DAYS
            ],
            value: undefined,
            validators: {
              required: () => true
            }
          }
        ],

        // buttons
        bottomButtons: [
          {
            label: 'LNG_COMMON_BUTTON_SAVE',
            type: IV2SideDialogConfigButtonType.OTHER,
            color: 'primary',
            key: 'save',
            disabled: (_data, handler): boolean => {
              return !handler.form || handler.form.invalid;
            }
          }, {
            type: IV2SideDialogConfigButtonType.CANCEL,
            label: 'LNG_COMMON_BUTTON_CANCEL',
            color: 'text'
          }
        ],
        initialized: (handler) => {
          // display loading
          handler.loading.show();

          // retrieve system settings
          this.systemSettingsDataService
            .getSystemSettings()
            .pipe(
              catchError((err) => {
                this.toastV2Service.error(err);
                return throwError(err);
              }),

              // should be the last pipe
              takeUntil(this.destroyed$)
            )
            .subscribe((settings) => {
              // used for visualization
              currentSettings = settings;

              // set data - key value
              (handler.data.map.historyCountLabel as IV2SideDialogConfigInputKeyValue).value = settings.notificationSettings?.historyCount !== undefined ?
                settings.notificationSettings.historyCount.toString() :
                '';
              (handler.data.map.checkIntervalLabel as IV2SideDialogConfigInputKeyValue).value = settings.notificationSettings?.checkInterval !== undefined ?
                `${settings.notificationSettings.checkInterval} ${settings.notificationSettings.checkIntervalUnit || ''}` :
                '';

              // set data - inputs
              (handler.data.map.historyCount as IV2SideDialogConfigInputNumber).value = settings.notificationSettings?.historyCount;
              (handler.data.map.checkInterval as IV2SideDialogConfigInputNumber).value = settings.notificationSettings?.checkInterval;
              (handler.data.map.checkIntervalUnit as IV2SideDialogConfigInputSingleDropdown).value = settings.notificationSettings?.checkIntervalUnit ||
                Constants.NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT.HOURS.value;

              // hide loading
              handler.loading.hide();
            });
        }
      })
      .subscribe((response) => {
        // cancelled ?
        if (response.button.type === IV2SideDialogConfigButtonType.CANCEL) {
          return;
        }

        // determine new settings
        const notificationSettings = {
          ...currentSettings.notificationSettings,
          historyCount: (response.data.map.historyCount as IV2SideDialogConfigInputNumber).value,
          checkInterval: (response.data.map.checkInterval as IV2SideDialogConfigInputNumber).value,
          checkIntervalUnit: (response.data.map.checkIntervalUnit as IV2SideDialogConfigInputSingleDropdown).value
        };

        // save
        this.systemSettingsDataService
          .modifySystemSettings({
            notificationSettings
          })
          .pipe(
            catchError((err) => {
              this.toastV2Service.error(err);
              return throwError(err);
            })
          )
          .subscribe(() => {
            // success message
            this.toastV2Service.success('LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_SUCCESS_MESSAGE');

            // close popup
            response.handler.hide();
          });
      });
  }
}
