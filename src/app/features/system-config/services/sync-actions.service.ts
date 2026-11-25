import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import * as _ from 'lodash';
import { Observable, of, Subject, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ISyncProgressDialogData, SyncProgressDialogComponent } from '../components/sync-progress-dialog/sync-progress-dialog.component';
import { IV2BottomDialogConfigButtonType } from '../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';
import {
  IV2SideDialogConfigButtonType,
  IV2SideDialogConfigInputDate,
  IV2SideDialogConfigInputMultiDropdown,
  IV2SideDialogConfigInputSingleDropdown,
  IV2SideDialogData,
  V2SideDialogConfigInput,
  V2SideDialogConfigInputType
} from '../../../shared/components-v2/app-side-dialog-v2/models/side-dialog-config.model';
import { ILabelValuePairModel } from '../../../shared/forms-v2/core/label-value-pair.model';
import { LocalizationHelper } from '../../../core/helperClasses/localization-helper';
import { Constants } from '../../../core/models/constants';
import { SystemClientApplicationModel } from '../../../core/models/system-client-application.model';
import { SystemSettingsModel } from '../../../core/models/system-settings.model';
import { SystemSyncLogModel } from '../../../core/models/system-sync-log.model';
import { SystemUpstreamServerModel } from '../../../core/models/system-upstream-server.model';
import { ClientApplicationDataService } from '../../../core/services/data/client-application.data.service';
import { SystemSettingsDataService } from '../../../core/services/data/system-settings.data.service';
import { DialogV2Service } from '../../../core/services/helper/dialog-v2.service';
import { I18nService } from '../../../core/services/helper/i18n.service';
import { SystemSyncLogHelperService } from '../../../core/services/helper/system-sync-log-helper.service';
import { ToastV2Service } from '../../../core/services/helper/toast-v2.service';

/**
 * Actions of a client (instance / mobile app that sends data here) and of a destination server (where this instance sends its data)
 * Note: they are made from the page of each one, so the lists only open them
 */
@Injectable({
  providedIn: 'root'
})
export class SyncActionsService {
  // sync dialog - which data is sent
  private static readonly SYNC_DIALOG_MODE_INPUT: string = 'sendMode';
  private static readonly SYNC_DIALOG_FROM_DATE_INPUT: string = 'fromDate';
  private static readonly SYNC_DIALOG_OUTBREAKS_INPUT: string = 'outbreakIDs';
  private static readonly SYNC_MODE_SINCE_LAST: string = 'sinceLast';
  private static readonly SYNC_MODE_FROM_DATE: string = 'fromDate';
  private static readonly SYNC_MODE_ALL: string = 'all';

  /**
   * Constructor
   */
  constructor(
    private clientApplicationDataService: ClientApplicationDataService,
    private systemSettingsDataService: SystemSettingsDataService,
    private dialogV2Service: DialogV2Service,
    private toastV2Service: ToastV2Service,
    private i18nService: I18nService,
    private systemSyncLogHelperService: SystemSyncLogHelperService,
    private matDialog: MatDialog
  ) {}

  /**
   * Activate / deactivate a client; emits the new value
   */
  toggleClientActive(client: SystemClientApplicationModel): Observable<boolean> {
    const active: boolean = !client.active;
    return this.clientApplicationDataService
      .modifyClientApplication(client.id, { active })
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return throwError(err);
        }),
        map(() => {
          this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_TOGGLE_ENABLED_SUCCESS_MESSAGE');
          return active;
        })
      );
  }

  /**
   * Delete a client after confirmation; emits true when deleted
   */
  deleteClient(client: SystemClientApplicationModel): Observable<boolean> {
    return this.confirmDelete(
      client.name,
      'LNG_DIALOG_CONFIRM_DELETE_CLIENT_APPLICATION'
    ).pipe(
      switchMap((confirmed: boolean) => {
        if (!confirmed) {
          return of(false);
        }

        const loading = this.dialogV2Service.showLoadingDialog();
        return this.clientApplicationDataService
          .deleteClientApplication(client.id)
          .pipe(
            catchError((err) => {
              this.toastV2Service.error(err);
              loading.close();
              return throwError(err);
            }),
            map(() => {
              this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_DELETE_SUCCESS_MESSAGE');
              loading.close();
              return true;
            })
          );
      })
    );
  }

  /**
   * Enable / disable the automatic syncs with a server; emits the new value
   */
  toggleServerSync(server: SystemUpstreamServerModel): Observable<boolean> {
    const syncEnabled: boolean = !server.syncEnabled;
    return this.saveServers((servers) => {
      const item: SystemUpstreamServerModel = servers.find((entry) => entry.url === server.url);
      if (item) {
        item.syncEnabled = syncEnabled;
      }
      return servers;
    }).pipe(
      map(() => {
        this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_TOGGLE_SYNC_ENABLED_SUCCESS_MESSAGE');
        return syncEnabled;
      })
    );
  }

  /**
   * Delete a server after confirmation; emits true when deleted
   */
  deleteServer(server: SystemUpstreamServerModel): Observable<boolean> {
    return this.confirmDelete(
      server.name,
      'LNG_DIALOG_CONFIRM_DELETE_SYSTEM_UPSTREAM_SERVER'
    ).pipe(
      switchMap((confirmed: boolean) => {
        if (!confirmed) {
          return of(false);
        }

        const loading = this.dialogV2Service.showLoadingDialog();
        return this.saveServers((servers) => servers.filter((entry) => entry.url !== server.url))
          .pipe(
            catchError((err) => {
              loading.close();
              return throwError(err);
            }),
            map(() => {
              this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_DELETE_SUCCESS_MESSAGE');
              loading.close();
              return true;
            })
          );
      })
    );
  }

  /**
   * Choose what is sent & send it, displaying the progress; emits when the progress dialog is closed (nothing if canceled)
   * @param server Server, with its last sync (lastSyncLog)
   * @param outbreakOptions Outbreaks that can be chosen
   */
  startSync(
    server: SystemUpstreamServerModel,
    outbreakOptions: ILabelValuePairModel[]
  ): Observable<void> {
    const done$: Subject<void> = new Subject<void>();
    this.dialogV2Service.showSideDialog({
      title: {
        get: () => 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_TITLE'
      },
      hideInputFilter: true,
      width: '55rem',
      inputs: [
        {
          // server that receives the data & its last sync
          type: V2SideDialogConfigInputType.HTML,
          name: 'server',
          placeholder: this.getSyncDialogServerHtml(server)
        }, {
          type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
          name: SyncActionsService.SYNC_DIALOG_MODE_INPUT,
          placeholder: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE',
          tooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_TOOLTIP',
          options: [
            {
              label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_SINCE_LAST',
              value: SyncActionsService.SYNC_MODE_SINCE_LAST
            }, {
              label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_FROM_DATE',
              value: SyncActionsService.SYNC_MODE_FROM_DATE
            }, {
              label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_ALL',
              value: SyncActionsService.SYNC_MODE_ALL
            }
          ],
          value: SyncActionsService.SYNC_MODE_SINCE_LAST,
          validators: {
            required: () => true
          }
        }, {
          type: V2SideDialogConfigInputType.DATE,
          name: SyncActionsService.SYNC_DIALOG_FROM_DATE_INPUT,
          placeholder: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_FROM_DATE',
          tooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_FROM_DATE_TOOLTIP',
          value: undefined,
          visible: (data) => this.getSyncMode(data) === SyncActionsService.SYNC_MODE_FROM_DATE,
          validators: {
            required: (data) => this.getSyncMode(data) === SyncActionsService.SYNC_MODE_FROM_DATE
          }
        }, {
          type: V2SideDialogConfigInputType.DROPDOWN_MULTI,
          name: SyncActionsService.SYNC_DIALOG_OUTBREAKS_INPUT,
          // nothing chosen means all the outbreaks
          placeholder: this.getSyncOutbreaksPlaceholder(server.outbreakIDs),
          tooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_OUTBREAKS_TOOLTIP',
          options: outbreakOptions,
          // outbreaks configured for the server
          values: [...(server.outbreakIDs || [])],
          change: (_data, _handler, item) => {
            item.placeholder = this.getSyncOutbreaksPlaceholder((item as IV2SideDialogConfigInputMultiDropdown).values);
          }
        },

        // what is sent with the chosen option
        this.getSyncDialogHint(
          SyncActionsService.SYNC_MODE_SINCE_LAST,
          'info',
          'update',
          'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_HINT_SINCE_LAST'
        ),
        this.getSyncDialogHint(
          SyncActionsService.SYNC_MODE_FROM_DATE,
          'info',
          'event',
          'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_HINT_FROM_DATE'
        ),
        this.getSyncDialogHint(
          SyncActionsService.SYNC_MODE_ALL,
          'warning',
          'warning',
          'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_HINT_ALL'
        ),

        // only some outbreaks
        {
          type: V2SideDialogConfigInputType.HTML,
          name: 'partialSync',
          placeholder: this.getSyncDialogHintHtml(
            'warning',
            'filter_alt',
            'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_HINT_PARTIAL'
          ),
          visible: (data) => this.isPartialSync(
            server,
            this.getSyncOutbreakIDs(data)
          )
        },

        // without a successful sync everything is sent, whatever the option
        {
          type: V2SideDialogConfigInputType.HTML,
          name: 'firstSync',
          placeholder: this.getSyncDialogHintHtml(
            'warning',
            'new_releases',
            'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_HINT_FIRST_SYNC'
          ),
          visible: (data) => !server.lastSyncLog &&
            this.getSyncMode(data) !== SyncActionsService.SYNC_MODE_ALL
        }
      ],
      bottomButtons: [
        {
          type: IV2SideDialogConfigButtonType.OTHER,
          label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_START_BUTTON',
          color: 'primary',
          key: 'start',
          disabled: (_data, handler): boolean => {
            return !handler.form || handler.form.invalid;
          }
        }, {
          type: IV2SideDialogConfigButtonType.CANCEL,
          label: 'LNG_COMMON_BUTTON_CANCEL',
          color: 'text'
        }
      ]
    }).subscribe((response) => {
      // canceled ?
      if (response.button.type === IV2SideDialogConfigButtonType.CANCEL) {
        done$.complete();
        return;
      }

      // what should be sent; nothing means only what changed since the last sync
      const syncMode: string = this.getSyncMode(response.data);
      let syncOptions: {
        fromDate?: string,
        fullSync?: boolean,
        outbreakIDs?: string[]
      };
      if (syncMode === SyncActionsService.SYNC_MODE_ALL) {
        syncOptions = {
          fullSync: true
        };
      } else if (syncMode === SyncActionsService.SYNC_MODE_FROM_DATE) {
        syncOptions = {
          fromDate: LocalizationHelper
            .toMoment((response.data.map[SyncActionsService.SYNC_DIALOG_FROM_DATE_INPUT] as IV2SideDialogConfigInputDate).value)
            .startOf('day')
            .toISOString()
        };
      }

      // outbreaks to send; always sent, since nothing chosen means all of them and not the ones configured for the server
      syncOptions = {
        ...syncOptions,
        outbreakIDs: this.getSyncOutbreakIDs(response.data)
      };

      // close dialog
      response.handler.hide();

      // display the progress of each step; the sync might continue in background after the dialog is closed
      this.matDialog
        .open<SyncProgressDialogComponent, ISyncProgressDialogData, boolean>(
        SyncProgressDialogComponent, {
          data: {
            upstreamServer: server,
            syncOptions
          },
          width: '64rem',
          maxWidth: '95vw',
          disableClose: true,
          autoFocus: false,
          restoreFocus: false,
          panelClass: 'gd-sync-progress-dialog-panel'
        }
      )
        .afterClosed()
        .subscribe(() => {
          done$.next();
          done$.complete();
        });
    });

    return done$.asObservable();
  }

  /**
   * Ask before deleting
   */
  private confirmDelete(
    name: string,
    message: string
  ): Observable<boolean> {
    return this.dialogV2Service
      .showConfirmDialog({
        config: {
          title: {
            get: () => 'LNG_COMMON_LABEL_DELETE',
            data: () => ({ name })
          },
          message: {
            get: () => message,
            data: () => ({ name })
          }
        }
      })
      .pipe(
        map((response) => response.button.type !== IV2BottomDialogConfigButtonType.CANCEL)
      );
  }

  /**
   * Change the servers (they are saved in the system settings)
   */
  private saveServers(change: (servers: SystemUpstreamServerModel[]) => SystemUpstreamServerModel[]): Observable<void> {
    return this.systemSettingsDataService
      .getSystemSettings()
      .pipe(
        switchMap((settings: SystemSettingsModel) => this.systemSettingsDataService.modifySystemSettings({
          upstreamServers: change(settings.upstreamServers || [])
        })),
        catchError((err) => {
          this.toastV2Service.error(err);
          return throwError(err);
        }),
        map(() => undefined)
      );
  }

  /**
   * Which data was chosen in the sync dialog
   */
  private getSyncMode(data: IV2SideDialogData): string {
    return (data.map[SyncActionsService.SYNC_DIALOG_MODE_INPUT] as IV2SideDialogConfigInputSingleDropdown)?.value;
  }

  /**
   * Outbreaks chosen in the sync dialog; nothing means all of them
   */
  private getSyncOutbreakIDs(data: IV2SideDialogData): string[] {
    return (data.map[SyncActionsService.SYNC_DIALOG_OUTBREAKS_INPUT] as IV2SideDialogConfigInputMultiDropdown)?.values || [];
  }

  /**
   * Sync dialog - label of the outbreaks field; nothing chosen means all the outbreaks
   */
  private getSyncOutbreaksPlaceholder(outbreakIDs: string[]): string {
    return outbreakIDs?.length > 0 ?
      'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_OUTBREAKS' :
      'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_OUTBREAKS_ALL';
  }

  /**
   * The chosen outbreaks don't include all the ones configured for the server
   */
  private isPartialSync(
    server: SystemUpstreamServerModel,
    outbreakIDs: string[]
  ): boolean {
    // all outbreaks
    if (!outbreakIDs.length) {
      return false;
    }

    // configured to sync all outbreaks
    const configuredOutbreakIDs: string[] = server.outbreakIDs || [];
    if (!configuredOutbreakIDs.length) {
      return true;
    }

    return configuredOutbreakIDs.some((outbreakId) => !outbreakIDs.includes(outbreakId));
  }

  /**
   * Sync dialog - server that receives the data & its last sync
   */
  private getSyncDialogServerHtml(server: SystemUpstreamServerModel): string {
    // last sync
    let lastSyncHtml: string;
    const lastSyncLog: SystemSyncLogModel = server.lastSyncLog;
    if (!lastSyncLog) {
      lastSyncHtml = `<span>${_.escape(this.i18nService.instant('LNG_UPSTREAM_SERVER_LAST_SYNC_NEVER'))}</span>`;
    } else {
      // status
      let statusClass: string;
      let statusLabel: string;
      if (this.systemSyncLogHelperService.isNoDataToSync(lastSyncLog)) {
        statusClass = 'success';
        statusLabel = 'LNG_UPSTREAM_SERVER_LAST_SYNC_UP_TO_DATE';
      } else {
        switch (lastSyncLog.status) {
          case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS.value:
            statusClass = 'success';
            break;
          case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS_WITH_WARNINGS.value:
            statusClass = 'warning';
            break;
          case Constants.SYSTEM_SYNC_LOG_STATUS.FAILED.value:
            statusClass = 'danger';
            break;
          default:
            statusClass = 'secondary';
        }
        statusLabel = lastSyncLog.status;
      }

      lastSyncHtml = `<span>${_.escape(this.i18nService.instant('LNG_UPSTREAM_SERVER_FIELD_LABEL_LAST_SYNC_DATE'))}: ` +
        `<strong>${_.escape(LocalizationHelper.displayDateTime(lastSyncLog.actionStartDate))}</strong></span>` +
        `<span class="gd-sync-dialog-status gd-sync-dialog-status-${statusClass}">${_.escape(this.i18nService.instant(statusLabel))}</span>`;
    }

    // render
    return '<div class="gd-sync-dialog-server">' +
      '<span class="material-icons gd-sync-dialog-server-icon">cloud_upload</span>' +
      '<div class="gd-sync-dialog-server-info">' +
      `<div class="gd-sync-dialog-server-name">${_.escape(server.name)}</div>` +
      `<div class="gd-sync-dialog-server-url">${_.escape(server.url)}</div>` +
      '</div>' +
      '</div>' +
      '<div class="gd-sync-dialog-last">' +
      '<span class="material-icons">history</span>' +
      lastSyncHtml +
      '</div>';
  }

  /**
   * Sync dialog - box with an explanation
   */
  private getSyncDialogHintHtml(
    type: 'info' | 'warning',
    icon: string,
    message: string
  ): string {
    return `<div class="gd-sync-dialog-hint gd-sync-dialog-hint-${type}">` +
      `<span class="material-icons">${icon}</span>` +
      `<span>${_.escape(this.i18nService.instant(message))}</span>` +
      '</div>';
  }

  /**
   * Sync dialog - explanation visible only for an option
   */
  private getSyncDialogHint(
    syncMode: string,
    type: 'info' | 'warning',
    icon: string,
    message: string
  ): V2SideDialogConfigInput {
    return {
      type: V2SideDialogConfigInputType.HTML,
      name: `hint-${syncMode}`,
      placeholder: this.getSyncDialogHintHtml(
        type,
        icon,
        message
      ),
      visible: (data) => this.getSyncMode(data) === syncMode
    };
  }
}
