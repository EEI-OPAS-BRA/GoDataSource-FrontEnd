import { Component, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import {
  forkJoin,
  merge,
  Observable,
  of,
  Subject
} from 'rxjs';
import {
  catchError,
  map,
  switchMap,
  takeUntil,
  tap
} from 'rxjs/operators';
import { ListComponent } from '../../../../core/helperClasses/list-component';
import { RequestQueryBuilder, RequestSortDirection } from '../../../../core/helperClasses/request-query-builder';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SyncOutbreakAccessStatus, UpstreamOutbreakAccessModel } from '../../../../core/models/sync-outbreak-access.model';
import { SyncOutbreakAccessDataService } from '../../../../core/services/data/sync-outbreak-access.data.service';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SystemSyncLogDataService } from '../../../../core/services/data/system-sync-log.data.service';
import { SystemSyncDataService } from '../../../../core/services/data/system-sync.data.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { SystemSyncLogHelperService } from '../../../../core/services/helper/system-sync-log-helper.service';
import { UpstreamServerCheckHelperService } from '../../../../core/services/helper/upstream-server-check-helper.service';
import { SystemUpstreamServerConnectionStatus } from '../../../../core/models/system-upstream-server-check.model';
import { ListHelperService } from '../../../../core/services/helper/list-helper.service';
import { AppListTableV2Component } from '../../../../shared/components-v2/app-list-table-v2/app-list-table-v2.component';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
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

  // table
  @ViewChild('listTable', { static: true }) listTable: AppListTableV2Component;

  // stops the checks that are still running, when the list is refreshed or the page is closed
  private _stopConnectionChecks$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    protected listHelperService: ListHelperService,
    private systemSettingsDataService: SystemSettingsDataService,
    private systemSyncDataService: SystemSyncDataService,
    private systemSyncLogDataService: SystemSyncLogDataService,
    private i18nService: I18nService,
    private systemSyncLogHelperService: SystemSyncLogHelperService,
    private upstreamServerCheckHelperService: UpstreamServerCheckHelperService,
    private activatedRoute: ActivatedRoute,
    private syncOutbreakAccessDataService: SyncOutbreakAccessDataService
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
        // Page of the server
        {
          type: V2ActionType.ICON,
          icon: 'visibility',
          iconTooltip: 'LNG_SYNC_UPSTREAM_SERVER_OPEN',
          action: {
            link: (item: SystemUpstreamServerModel): string[] => ['/system-config/upstream-servers/server', item.url]
          },
          visible: (): boolean => {
            return SystemUpstreamServerModel.canList(this.authUser);
          }
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
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_NAME',
        link: (item: SystemUpstreamServerModel) => `/system-config/upstream-servers/server/${encodeURIComponent(item.url)}`
      },
      {
        // which outbreaks the server accepts
        field: 'access',
        label: 'LNG_SYNC_UPSTREAM_SERVER_COLUMN_APPROVAL',
        format: {
          type: V2ColumnFormat.HTML
        },
        html: (item: SystemUpstreamServerModel) => this.getApprovalHtml(item.access)
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
        field: 'outbreakIDs',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_OUTBREAKS_TO_SYNC',
        format: {
          type: (item: SystemUpstreamServerModel) => {
            if (!item.outbreakIDs?.length) {
              // the outbreaks must be chosen (none doesn't mean all of them)
              return this.i18nService.instant('LNG_SYNC_NO_OUTBREAKS_CHOSEN');
            }

            // outbreaks that can't be displayed are shown by id
            const outbreaksMap = (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).map;
            return item.outbreakIDs
              .map((outbreakId) => outbreaksMap[outbreakId]?.name || outbreakId)
              .join(', ');
          }
        }
      },
      {
        field: 'description',
        label: 'LNG_UPSTREAM_SERVER_FIELD_LABEL_DESCRIPTION',
        // on the page of the server (settings)
        notVisible: true
      },
      {
        field: 'syncInterval',
        label: 'LNG_SYNC_UPSTREAM_SERVER_FIELD_SCHEDULE',
        // on the page of the server (settings)
        notVisible: true,
        format: {
          type: (item: SystemUpstreamServerModel) => item.syncInterval > 0 ?
            this.i18nService.instant('LNG_SYNC_UPSTREAM_SERVER_EVERY_HOURS', { hours: item.syncInterval }) :
            this.i18nService.instant('LNG_SYNC_UPSTREAM_SERVER_NO_INTERVAL')
        }
      },
      {
        field: 'syncEnabled',
        notVisible: true,
        label: 'LNG_SYNC_UPSTREAM_SERVER_FIELD_ACTIVE',
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
      label: 'LNG_SYNC_ADD_DESTINATION',
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

        // which outbreaks each server accepts (the new outbreaks are requested); the last known decisions when it can't be asked
        switchMap((upstreamServers: SystemUpstreamServerModel[]): Observable<SystemUpstreamServerModel[]> => {
          if (!upstreamServers.length) {
            return of(upstreamServers);
          }

          return this.syncOutbreakAccessDataService
            .getUpstreamAccessList()
            .pipe(
              catchError(() => of([])),
              switchMap((states: UpstreamOutbreakAccessModel[]) => forkJoin(
                upstreamServers.map((upstreamServer) => {
                  upstreamServer.access = states.find((state) => state.upstreamServerUrl === upstreamServer.url);
                  if (!upstreamServer.syncEnabled) {
                    return of(upstreamServer);
                  }

                  return this.syncOutbreakAccessDataService
                    .checkUpstreamAccess(upstreamServer.url)
                    .pipe(
                      map((state) => {
                        upstreamServer.access = state;
                        return upstreamServer;
                      }),
                      catchError(() => of(upstreamServer))
                    );
                })
              ))
            );
        }),

        // check if each server is online & accepts its credentials
        tap((upstreamServers: SystemUpstreamServerModel[]) => this.startConnectionChecks(upstreamServers)),

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
   * Summary of the decisions of a server about the outbreaks of this instance
   */
  private getApprovalHtml(access: UpstreamOutbreakAccessModel): string {
    // not asked yet
    if (!access?.mode) {
      return '<span class="gd-list-table-sync-none">-</span>';
    }

    // the server receives the outbreaks without approval
    if (access.mode !== 'request') {
      return `<span class="gd-list-table-sync-approval"><span class="gd-list-table-sync-approval-refused">${_.escape(this.i18nService.instant('LNG_SYNC_UPSTREAM_SERVER_APPROVAL_NOT_NEEDED'))}</span></span>`;
    }

    // numbers
    const chip = (count: number, cssClass: string, token: string) => count ?
      `<span class="gd-list-table-sync-approval-${cssClass}">${_.escape(this.i18nService.instant(token, { count }))}</span>` :
      '';
    const html: string = chip(access.outbreaksWithStatus(SyncOutbreakAccessStatus.PENDING).length, 'pending', 'LNG_SYNC_UPSTREAM_SERVER_APPROVAL_PENDING') +
      chip(access.outbreaksWithStatus(SyncOutbreakAccessStatus.ACCEPTED).length, 'accepted', 'LNG_SYNC_UPSTREAM_SERVER_APPROVAL_ACCEPTED') +
      chip(
        access.outbreaksWithStatus(SyncOutbreakAccessStatus.REFUSED).length + access.outbreaksWithStatus(SyncOutbreakAccessStatus.PAUSED).length,
        'refused',
        'LNG_SYNC_UPSTREAM_SERVER_APPROVAL_REFUSED'
      );
    // the last check failed: the numbers are the last known ones
    const unreachable: string = access.errorCode ?
      `<span class="gd-list-table-sync-approval-refused" title="${_.escape(access.error || '')}">${_.escape(this.i18nService.instant('LNG_SYNC_UPSTREAM_SERVER_APPROVAL_UNREACHABLE'))}</span>` :
      '';
    return html || unreachable ?
      `<span class="gd-list-table-sync-approval">${unreachable}${html}</span>` :
      '<span class="gd-list-table-sync-none">-</span>';
  }

  /**
   * Check the servers in background, updating only their connection cell when each check finishes
   * Note: the list isn't emitted again, so the table isn't redrawn and keeps the selected rows
   */
  private startConnectionChecks(upstreamServers: SystemUpstreamServerModel[]): void {
    if (
      !upstreamServers.length ||
      !SystemUpstreamServerModel.canModify(this.authUser)
    ) {
      return;
    }

    upstreamServers.forEach((upstreamServer) => {
      upstreamServer.connection = {
        status: 'checking',
        message: this.i18nService.instant('LNG_UPSTREAM_SERVER_CONNECTION_CHECKING_MESSAGE')
      };
    });

    merge(
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
            }),

            // one server that can't be checked must not affect the others
            catchError(() => {
              upstreamServer.connection = {
                status: 'unknown',
                message: ''
              };
              return of(undefined);
            })
          );
      })
    )
      .pipe(
        takeUntil(this._stopConnectionChecks$)
      )
      .subscribe(() => {
        // the row might not be rendered yet, in which case it is rendered with the updated connection
        this.listTable?.agTable?.api.refreshCells({
          columns: ['connection'],
          force: true
        });
      });
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
}
