import { Component, OnDestroy } from '@angular/core';
import * as _ from 'lodash';
import { forkJoin, merge, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ListComponent } from '../../../../core/helperClasses/list-component';
import { RequestQueryBuilder, RequestSortDirection } from '../../../../core/helperClasses/request-query-builder';
import { Constants } from '../../../../core/models/constants';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SystemSyncLogDataService } from '../../../../core/services/data/system-sync-log.data.service';
import { SystemSyncDataService } from '../../../../core/services/data/system-sync.data.service';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { SystemSyncLogHelperService } from '../../../../core/services/helper/system-sync-log-helper.service';
import { UpstreamServerCheckHelperService } from '../../../../core/services/helper/upstream-server-check-helper.service';
import { SystemUpstreamServerConnectionStatus } from '../../../../core/models/system-upstream-server-check.model';
import { ListHelperService } from '../../../../core/services/helper/list-helper.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IV2BottomDialogConfigButtonType } from '../../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';
import { IV2InfoBannerStep } from '../../../../shared/components-v2/app-info-banner-v2/models/info-banner.model';
import {
  IV2SideDialogConfigButtonType,
  IV2SideDialogConfigInputDate,
  IV2SideDialogConfigInputSingleDropdown,
  IV2SideDialogData,
  V2SideDialogConfigInputType
} from '../../../../shared/components-v2/app-side-dialog-v2/models/side-dialog-config.model';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';
import { V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import { IV2Column, V2ColumnFormat } from '../../../../shared/components-v2/app-list-table-v2/models/column.model';

@Component({
  selector: 'app-upstream-servers-list',
  templateUrl: './upstream-servers-list.component.html'
})
export class UpstreamServersListComponent extends ListComponent<SystemUpstreamServerModel, IV2Column> implements OnDestroy {
  // icon & text displayed for each status of the connection column
  private static readonly CONNECTION_STATUS: {
    [status in SystemUpstreamServerConnectionStatus]: {
      icon: string,
      label: string
    }
  } = {
      checking: { icon: 'sync', label: 'LNG_UPSTREAM_SERVER_CONNECTION_CHECKING' },
      online: { icon: 'check_circle', label: 'LNG_UPSTREAM_SERVER_CONNECTION_ONLINE' },
      invalid_credentials: { icon: 'vpn_key', label: 'LNG_UPSTREAM_SERVER_CONNECTION_INVALID_CREDENTIALS' },
      api_not_found: { icon: 'error_outline', label: 'LNG_UPSTREAM_SERVER_CONNECTION_API_NOT_FOUND' },
      offline: { icon: 'cloud_off', label: 'LNG_UPSTREAM_SERVER_CONNECTION_OFFLINE' },
      unknown: { icon: 'info_outline', label: 'LNG_UPSTREAM_SERVER_CONNECTION_UNKNOWN' }
    };

  // sync dialog - which data is sent
  private static readonly SYNC_DIALOG_MODE_INPUT: string = 'sendMode';
  private static readonly SYNC_DIALOG_FROM_DATE_INPUT: string = 'fromDate';
  private static readonly SYNC_MODE_SINCE_LAST: string = 'sinceLast';
  private static readonly SYNC_MODE_FROM_DATE: string = 'fromDate';
  private static readonly SYNC_MODE_ALL: string = 'all';

  // stops the checks that are still running, when the list is refreshed or the page is closed
  private _stopConnectionChecks$: Subject<void> = new Subject<void>();

  // timers
  private _syncCheckIfDoneTimer: number;

  // info banner
  infoBannerSteps: IV2InfoBannerStep[] = [
    {
      icon: 'dns',
      title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_1_TITLE',
      description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_1_DESCRIPTION'
    }, {
      icon: 'schedule',
      title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_2_TITLE',
      description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_2_DESCRIPTION'
    }, {
      icon: 'cloud_upload',
      title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_3_TITLE',
      description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_3_DESCRIPTION'
    }, {
      icon: 'assignment_turned_in',
      title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_4_TITLE',
      description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_4_DESCRIPTION'
    }
  ];
  infoBannerNotes: string[] = [
    'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_NOTE_1'
  ];

  /**
   * Constructor
   */
  constructor(
    protected listHelperService: ListHelperService,
    private systemSettingsDataService: SystemSettingsDataService,
    private toastV2Service: ToastV2Service,
    private systemSyncDataService: SystemSyncDataService,
    private systemSyncLogDataService: SystemSyncLogDataService,
    private dialogV2Service: DialogV2Service,
    private i18nService: I18nService,
    private systemSyncLogHelperService: SystemSyncLogHelperService,
    private upstreamServerCheckHelperService: UpstreamServerCheckHelperService
  ) {
    super(
      listHelperService, {
        disableWaitForSelectedOutbreakToRefreshList: true
      }
    );
  }

  /**
   * Component initialized
   */
  initialized(): void {
    // initialize pagination
    this.initPaginator();

    // ...and re-load the list when the Selected Outbreak is changed
    this.needsRefreshList(true);
  }

  /**
   * Release resources
   */
  ngOnDestroy() {
    // release parent resources
    super.onDestroy();

    // stop connection checks
    this._stopConnectionChecks$.next();
    this._stopConnectionChecks$.complete();

    // stop timers
    this.stopSyncCheckIfDoneTimer();
  }

  /**
   * Table column - actions
   */
  protected initializeTableColumnActions(): void {
    this.tableColumnActions = {
      format: {
        type: V2ColumnFormat.ACTIONS
      },
      actions: [
        // Modify
        {
          type: V2ActionType.ICON,
          icon: 'edit',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_MODIFY_SERVER',
          action: {
            link: (): string[] => ['/system-config/upstream-servers/modify'],
            linkQueryParams: (item: SystemUpstreamServerModel) => ({
              url: item.url
            })
          },
          visible: (): boolean => {
            return SystemUpstreamServerModel.canModify(this.authUser);
          }
        },

        // Start sync
        {
          type: V2ActionType.ICON,
          icon: 'sync',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_START_SYNC',
          action: {
            click: (item: SystemUpstreamServerModel) => {
              this.startSync(item);
            }
          },
          visible: (): boolean => {
            return SystemUpstreamServerModel.canSync(this.authUser);
          }
        },

        // Disable sync
        {
          type: V2ActionType.ICON,
          icon: 'sync_disabled',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_DISABLE_SYNC',
          action: {
            click: (item: SystemUpstreamServerModel) => {
              this.toggleSyncEnableFlag(item);
            }
          },
          visible: (item: SystemUpstreamServerModel): boolean => {
            return item.syncEnabled &&
              SystemUpstreamServerModel.canDisableSync(this.authUser);
          }
        },

        // Enable sync
        {
          type: V2ActionType.ICON,
          icon: 'alarm_on',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_ENABLE_SYNC',
          action: {
            click: (item: SystemUpstreamServerModel) => {
              this.toggleSyncEnableFlag(item);
            }
          },
          visible: (item: SystemUpstreamServerModel): boolean => {
            return !item.syncEnabled &&
              SystemUpstreamServerModel.canEnableSync(this.authUser);
          }
        },

        // Other actions
        {
          type: V2ActionType.MENU,
          icon: 'more_horiz',
          menuOptions: [
            // Delete
            {
              label: {
                get: () => 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_DELETE_SERVER'
              },
              cssClasses: () => 'gd-list-table-actions-action-menu-warning',
              action: {
                click: (item: SystemUpstreamServerModel): void => {
                  let systemSettings: SystemSettingsModel;

                  // determine what we need to delete
                  this.dialogV2Service.showConfirmDialog({
                    config: {
                      title: {
                        get: () => 'LNG_COMMON_LABEL_DELETE',
                        data: () => ({
                          name: item.name
                        })
                      },
                      message: {
                        get: () => 'LNG_DIALOG_CONFIRM_DELETE_SYSTEM_UPSTREAM_SERVER',
                        data: () => ({
                          name: item.name
                        })
                      }
                    },
                    initialized: (handler) => {
                      // display loading
                      handler.loading.show();

                      // determine if case has exposed contacts
                      this.systemSettingsDataService
                        .getSystemSettings()
                        .pipe(
                          catchError((err) => {
                            // show error
                            this.toastV2Service.error(err);

                            // hide loading
                            handler.loading.hide();

                            // send error down the road
                            return throwError(err);
                          })
                        )
                        .subscribe((settings: SystemSettingsModel) => {
                          systemSettings = settings;

                          // hide loading
                          handler.loading.hide();
                        });
                    }
                  }).subscribe((response) => {
                    // canceled ?
                    if (response.button.type === IV2BottomDialogConfigButtonType.CANCEL) {
                      // finished
                      return;
                    }

                    // show loading
                    const loading = this.dialogV2Service.showLoadingDialog();

                    // filter upstream servers
                    const upstreamServers = systemSettings.upstreamServers.filter((server: SystemUpstreamServerModel) => {
                      return server.url !== item.url;
                    });

                    // save upstream servers
                    this.systemSettingsDataService
                      .modifySystemSettings({
                        upstreamServers
                      })
                      .pipe(
                        catchError((err) => {
                          // show error
                          this.toastV2Service.error(err);

                          // hide loading
                          loading.close();

                          // send error down the road
                          return throwError(err);
                        })
                      )
                      .subscribe(() => {
                        // success
                        this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_DELETE_SUCCESS_MESSAGE');

                        // hide loading
                        loading.close();

                        // reload data
                        this.needsRefreshList(true);
                      });
                  });
                }
              },
              visible: (): boolean => {
                return SystemUpstreamServerModel.canDelete(this.authUser);
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Initialize Side Table Columns
   */
  protected initializeTableColumns() {
    // default table columns
    this.tableColumns = [
      {
        field: 'name',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_NAME'
      },
      {
        // the check is made by the api, and it needs the same permission used to save the servers
        field: 'connection',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_CONNECTION',
        exclude: () => !SystemUpstreamServerModel.canModify(this.authUser),
        width: 190,
        format: {
          type: V2ColumnFormat.HTML
        },
        html: (item: SystemUpstreamServerModel) => this.getConnectionHtml(item)
      },
      {
        field: 'url',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_URL'
      },
      {
        field: 'credentials',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_CREDENTIALS',
        format: {
          obfuscated: true,
          type: (item: SystemUpstreamServerModel) => {
            return `${item.credentials?.clientId}/${item.credentials?.clientSecret}`;
          }
        }
      },
      {
        field: 'description',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_DESCRIPTION'
      },
      {
        field: 'timeout',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_TIMEOUT'
      },
      {
        field: 'syncInterval',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_INTERVAL'
      },
      {
        field: 'syncOnEveryChange',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_ON_EVERY_CHANGE',
        format: {
          type: V2ColumnFormat.BOOLEAN
        }
      },
      {
        field: 'syncEnabled',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_ENABLED',
        format: {
          type: V2ColumnFormat.BOOLEAN
        }
      },
      {
        field: 'lastSyncLog.actionStartDate',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_LAST_SYNC_DATE',
        exclude: () => !SystemSyncLogModel.canList(this.authUser),
        format: {
          type: V2ColumnFormat.DATETIME
        }
      },
      {
        field: 'lastSyncLog.status',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_LAST_SYNC_STATUS',
        exclude: () => !SystemSyncLogModel.canList(this.authUser),
        format: {
          type: (item: SystemUpstreamServerModel) => {
            if (!item.lastSyncLog?.status) {
              return this.i18nService.instant('LNG_UPSTREAM_SERVER_LAST_SYNC_NEVER');
            }

            // nothing changed since the last sync, so there was nothing to send
            return this.systemSyncLogHelperService.isNoDataToSync(item.lastSyncLog) ?
              this.i18nService.instant('LNG_UPSTREAM_SERVER_LAST_SYNC_UP_TO_DATE') :
              this.i18nService.instant(item.lastSyncLog.status);
          }
        }
      },
      {
        field: 'lastSyncLog.error',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_LAST_SYNC_LOGS',
        exclude: () => !SystemSyncLogModel.canList(this.authUser),
        format: {
          type: V2ColumnFormat.BUTTON
        },
        cssCellClass: 'gd-cell-button',
        color: 'text',
        buttonLabel: (item: SystemUpstreamServerModel) => {
          if (this.systemSyncLogHelperService.hasError(item.lastSyncLog)) {
            return this.i18nService.instant('LNG_UPSTREAM_SERVER_LAST_SYNC_VIEW_LOGS');
          }

          if (this.systemSyncLogHelperService.isNoDataToSync(item.lastSyncLog)) {
            return this.i18nService.instant('LNG_UPSTREAM_SERVER_LAST_SYNC_NO_NEW_DATA');
          }

          return item.lastSyncLog?.status === Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS.value ?
            this.i18nService.instant('LNG_UPSTREAM_SERVER_LAST_SYNC_NO_MESSAGES') :
            '';
        },
        disabled: (item: SystemUpstreamServerModel) => !this.systemSyncLogHelperService.hasError(item.lastSyncLog) ||
          !SystemSyncLogModel.canView(this.authUser),
        click: (item: SystemUpstreamServerModel) => this.systemSyncLogHelperService.viewError(item.lastSyncLog)
      }
    ];
  }

  /**
   * Initialize process data
   */
  protected initializeProcessSelectedData(): void {}

  /**
   * Initialize table infos
   */
  protected initializeTableInfos(): void {}

  /**
   * Initialize Table Advanced Filters
   */
  protected initializeTableAdvancedFilters(): void {}

  /**
   * Initialize table quick actions
   */
  protected initializeQuickActions(): void {}

  /**
   * Initialize table group actions
   */
  protected initializeGroupActions(): void {}

  /**
   * Initialize table add action
   */
  protected initializeAddAction(): void {
    this.addAction = {
      type: V2ActionType.ICON_LABEL,
      label: 'LNG_COMMON_BUTTON_ADD',
      icon: 'add_circle_outline',
      action: {
        link: (): string[] => ['./create']
      },
      visible: (): boolean => {
        return SystemUpstreamServerModel.canCreate(this.authUser);
      }
    };
  }

  /**
   * Initialize table grouped data
   */
  protected initializeGroupedData(): void {}

  /**
   * Initialize breadcrumbs
   */
  protected initializeBreadcrumbs(): void {
    // set breadcrumbs
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this.authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_TITLE',
        action: null
      }
    ];
  }

  /**
   * Fields retrieved from api to reduce payload size
   */
  protected refreshListFields(): string[] {
    return [];
  }

  /**
   * Refresh list
   */
  refreshList() {
    // results of the previous refresh don't matter anymore
    this._stopConnectionChecks$.next();

    this.records$ = this.systemSettingsDataService
      .getSystemSettings()
      .pipe(
        // map data
        map((settings: SystemSettingsModel) => {
          return settings.upstreamServers;
        }),

        // retrieve the most recent sync of each server
        switchMap((upstreamServers: SystemUpstreamServerModel[]): Observable<SystemUpstreamServerModel[]> => {
          if (
            !upstreamServers.length ||
            !SystemSyncLogModel.canList(this.authUser)
          ) {
            return of(upstreamServers);
          }

          return forkJoin(
            upstreamServers.map((upstreamServer) => {
              const qb = new RequestQueryBuilder();
              qb.filter.byEquality('syncServerUrl', upstreamServer.url);
              qb.sort.by('actionStartDate', RequestSortDirection.DESC);
              qb.limit(1);

              return this.systemSyncLogDataService
                .getSyncLogList(qb)
                .pipe(
                  map((syncLogs: SystemSyncLogModel[]) => {
                    upstreamServer.lastSyncLog = syncLogs[0];
                    return upstreamServer;
                  }),

                  // the servers list must still be displayed if the logs can't be retrieved
                  catchError(() => of(upstreamServer))
                );
            })
          );
        }),

        // check if each server is online & accepts its credentials
        switchMap((upstreamServers: SystemUpstreamServerModel[]) => this.withConnectionChecks(upstreamServers)),

        // set count
        tap((upstreamServers: SystemUpstreamServerModel[]) => {
          this.pageCount = {
            count: upstreamServers.length,
            hasMore: false
          };
        })
      );
  }

  /**
   * Emit the servers right away, as being checked, and again each time the check of a server finishes
   */
  private withConnectionChecks(upstreamServers: SystemUpstreamServerModel[]): Observable<SystemUpstreamServerModel[]> {
    if (
      !upstreamServers.length ||
      !SystemUpstreamServerModel.canModify(this.authUser)
    ) {
      return of(upstreamServers);
    }

    upstreamServers.forEach((upstreamServer) => {
      upstreamServer.connection = {
        status: 'checking',
        message: this.i18nService.instant('LNG_UPSTREAM_SERVER_CONNECTION_CHECKING_MESSAGE')
      };
    });

    return merge(
      of(upstreamServers),
      ...upstreamServers.map((upstreamServer) => {
        return this.systemSyncDataService
          .checkUpstreamServer({
            url: upstreamServer.url,
            clientId: upstreamServer.credentials?.clientId,
            clientSecret: upstreamServer.credentials?.clientSecret
          })
          .pipe(
            map((check) => {
              upstreamServer.connection = this.upstreamServerCheckHelperService.summarize(check);
              return upstreamServers;
            }),

            // one server that can't be checked must not affect the others
            catchError(() => {
              upstreamServer.connection = {
                status: 'unknown',
                message: ''
              };
              return of(upstreamServers);
            })
          );
      })
    ).pipe(
      takeUntil(this._stopConnectionChecks$)
    );
  }

  /**
   * Status of the connection, displayed as a colored badge with an icon
   */
  private getConnectionHtml(upstreamServer: SystemUpstreamServerModel): string {
    if (!upstreamServer.connection) {
      return '';
    }

    const status = UpstreamServersListComponent.CONNECTION_STATUS[upstreamServer.connection.status];
    return `<span class="gd-list-table-connection-status gd-list-table-connection-status-${upstreamServer.connection.status}" title="${_.escape(upstreamServer.connection.message)}">` +
      `<span class="material-icons">${status.icon}</span>` +
      `<span>${_.escape(this.i18nService.instant(status.label))}</span>` +
      '</span>';
  }

  /**
   * Get total number of items
   */
  refreshListCount() {}

  /**
   * Toggle sync enabled flag
   * @param upstreamServer
   */
  toggleSyncEnableFlag(upstreamServer: SystemUpstreamServerModel) {
    // toggle flag
    upstreamServer.syncEnabled = !upstreamServer.syncEnabled;

    // save sync
    this.systemSettingsDataService
      .getSystemSettings()
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return throwError(err);
        })
      )
      .subscribe((settings: SystemSettingsModel) => {
        // upstream server
        const upstreamItem: SystemUpstreamServerModel = _.find(settings.upstreamServers, { url: upstreamServer.url });
        if (upstreamItem) {
          // set flag
          upstreamItem.syncEnabled = upstreamServer.syncEnabled;

          // save upstream servers
          this.systemSettingsDataService
            .modifySystemSettings({
              upstreamServers: settings.upstreamServers
            })
            .pipe(
              catchError((err) => {
                this.toastV2Service.error(err);
                return throwError(err);
              })
            )
            .subscribe(() => {
              // display success message
              this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_ACTION_TOGGLE_SYNC_ENABLED_SUCCESS_MESSAGE');
            });
          this.needsRefreshList(false, false, true);
        }
      });
  }

  /**
   * Stop timer
   */
  private stopSyncCheckIfDoneTimer(): void {
    if (this._syncCheckIfDoneTimer) {
      clearTimeout(this._syncCheckIfDoneTimer);
      this._syncCheckIfDoneTimer = undefined;
    }
  }

  /**
   * Which data was chosen in the sync dialog
   */
  private getSyncMode(data: IV2SideDialogData): string {
    return (data.map[UpstreamServersListComponent.SYNC_DIALOG_MODE_INPUT] as IV2SideDialogConfigInputSingleDropdown)?.value;
  }

  /**
   * Start sync
   * @param upstreamServer
   */
  startSync(upstreamServer: SystemUpstreamServerModel) {
    this.dialogV2Service.showSideDialog({
      title: {
        get: () => 'LNG_COMMON_LABEL_SYNC'
      },
      hideInputFilter: true,
      width: '55rem',
      inputs: [
        {
          type: V2SideDialogConfigInputType.DIVIDER,
          placeholder: this.i18nService.instant(
            'LNG_DIALOG_CONFIRM_DELETE_SYSTEM_UPSTREAM_SYNC_CONFIRMATION', {
              name: upstreamServer.name
            }
          ),
          placeholderMultipleLines: true
        }, {
          type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
          name: UpstreamServersListComponent.SYNC_DIALOG_MODE_INPUT,
          placeholder: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE',
          tooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_TOOLTIP',
          options: [
            {
              label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_SINCE_LAST',
              value: UpstreamServersListComponent.SYNC_MODE_SINCE_LAST
            }, {
              label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_FROM_DATE',
              value: UpstreamServersListComponent.SYNC_MODE_FROM_DATE
            }, {
              label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_MODE_ALL',
              value: UpstreamServersListComponent.SYNC_MODE_ALL
            }
          ],
          value: UpstreamServersListComponent.SYNC_MODE_SINCE_LAST,
          validators: {
            required: () => true
          }
        }, {
          type: V2SideDialogConfigInputType.DATE,
          name: UpstreamServersListComponent.SYNC_DIALOG_FROM_DATE_INPUT,
          placeholder: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_FROM_DATE',
          tooltip: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_DIALOG_FROM_DATE_TOOLTIP',
          value: undefined,
          visible: (data) => this.getSyncMode(data) === UpstreamServersListComponent.SYNC_MODE_FROM_DATE,
          validators: {
            required: (data) => this.getSyncMode(data) === UpstreamServersListComponent.SYNC_MODE_FROM_DATE
          }
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
        // finished
        return;
      }

      // what should be sent; nothing means only what changed since the last sync
      const syncMode: string = this.getSyncMode(response.data);
      let syncOptions: {
        fromDate?: string,
        fullSync?: boolean
      };
      if (syncMode === UpstreamServersListComponent.SYNC_MODE_ALL) {
        syncOptions = {
          fullSync: true
        };
      } else if (syncMode === UpstreamServersListComponent.SYNC_MODE_FROM_DATE) {
        syncOptions = {
          fromDate: LocalizationHelper
            .toMoment((response.data.map[UpstreamServersListComponent.SYNC_DIALOG_FROM_DATE_INPUT] as IV2SideDialogConfigInputDate).value)
            .startOf('day')
            .toISOString()
        };
      }

      // close dialog
      response.handler.hide();

      // show loading
      const loading = this.dialogV2Service.showLoadingDialog();

      // check if sync is done
      const syncCheckIfDone = (syncLogId: string) => {
        // stop previous
        this.stopSyncCheckIfDoneTimer();

        // call
        this._syncCheckIfDoneTimer = setTimeout(
          () => {
            // reset
            this._syncCheckIfDoneTimer = undefined;

            // check if backup is ready
            this.systemSyncLogDataService
              .getSyncLog(syncLogId)
              .pipe(
                catchError((err) => {
                  // show error
                  this.toastV2Service.error(err);

                  // hide loading
                  loading.close();

                  // send error down the road
                  return throwError(err);
                })
              )
              .subscribe((systemSyncLogModel: SystemSyncLogModel) => {
                switch (systemSyncLogModel.status) {
                  // sync ready ?
                  case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS.value:
                  case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS_WITH_WARNINGS.value:
                    // display success message
                    this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_SUCCESS_MESSAGE');

                    // hide loading
                    loading.close();

                    // reload data
                    this.needsRefreshList(true);
                    break;

                  // sync error ?
                  case Constants.SYSTEM_SYNC_LOG_STATUS.FAILED.value:
                    // nothing changed since the last sync, so it isn't a failure
                    if (this.systemSyncLogHelperService.isNoDataToSync(systemSyncLogModel)) {
                      this.toastV2Service.notice('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_UP_TO_DATE_MESSAGE');
                    } else {
                      this.toastV2Service.error('LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_SYNC_FAILED_MESSAGE');
                    }

                    // hide loading
                    loading.close();

                    // reload data
                    this.needsRefreshList(true);
                    break;

                  // sync isn't ready ?
                  // Constants.SYSTEM_SYNC_LOG_STATUS.IN_PROGRESS.value
                  default:
                    syncCheckIfDone(syncLogId);
                    break;
                }
              });
          },
          Constants.DEFAULT_FILTER_POOLING_MS_CHECK_AGAIN
        );
      };

      // start sync
      this.systemSyncDataService
        .sync(
          upstreamServer.url,
          syncOptions
        )
        .pipe(
          catchError((err) => {
          // show error
            this.toastV2Service.error(err);

            // hide loading
            loading.close();

            // send error down the road
            return throwError(err);
          })
        )
        .subscribe((systemSync) => {
          syncCheckIfDone(systemSync.syncLogId);
        });
    });
  }
}
