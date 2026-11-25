import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';
import { RequestQueryBuilder, RequestSortDirection } from '../../../../core/helperClasses/request-query-builder';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SyncOutbreakAccessStatus, UpstreamOutbreakAccessModel } from '../../../../core/models/sync-outbreak-access.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SystemUpstreamServerConnectionStatus } from '../../../../core/models/system-upstream-server-check.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { SyncOutbreakAccessDataService } from '../../../../core/services/data/sync-outbreak-access.data.service';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SystemSyncDataService } from '../../../../core/services/data/system-sync.data.service';
import { SystemSyncLogDataService } from '../../../../core/services/data/system-sync-log.data.service';
import { SyncReviewCountService } from '../../../../core/services/helper/sync-review-count.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { UpstreamServerCheckHelperService } from '../../../../core/services/helper/upstream-server-check-helper.service';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { IV2ActionIconLabel, V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { ISyncTab } from '../../components/sync-tabs/sync-tabs.component';
import { SyncActionsService } from '../../services/sync-actions.service';

/**
 * Tabs of the page
 */
type SyncUpstreamServerTab = 'outbreaks' | 'history' | 'settings';

/**
 * Page of a destination server: everything about it is seen & done here
 * - outbreaks: which outbreaks of this instance it accepts
 * - history: what was sent to it
 * - settings: where & when the data is sent & what can be done with it (sync now, automatic syncs, edit, delete)
 */
@Component({
  selector: 'app-sync-upstream-server',
  templateUrl: './sync-upstream-server.component.html',
  styleUrls: ['../sync-area-page.scss', '../sync-client/sync-client.component.scss']
})
export class SyncUpstreamServerComponent implements OnInit, OnDestroy {
  // number of syncs on each page of the history
  static readonly PAGE_SIZE: number = 10;

  // icon & text of each status of the connection
  static readonly CONNECTION_STATUS: {
    [status in SystemUpstreamServerConnectionStatus]: {
      icon: string,
      label: string,
      type: 'success' | 'danger' | 'neutral'
    }
  } = {
      checking: { icon: 'sync', label: 'LNG_UPSTREAM_SERVER_CONNECTION_CHECKING', type: 'neutral' },
      online: { icon: 'cloud_done', label: 'LNG_UPSTREAM_SERVER_CONNECTION_ONLINE', type: 'success' },
      invalid_credentials: { icon: 'vpn_key', label: 'LNG_UPSTREAM_SERVER_CONNECTION_INVALID_CREDENTIALS', type: 'danger' },
      api_not_found: { icon: 'error_outline', label: 'LNG_UPSTREAM_SERVER_CONNECTION_API_NOT_FOUND', type: 'danger' },
      offline: { icon: 'cloud_off', label: 'LNG_UPSTREAM_SERVER_CONNECTION_OFFLINE', type: 'danger' },
      unknown: { icon: 'info_outline', label: 'LNG_UPSTREAM_SERVER_CONNECTION_UNKNOWN', type: 'neutral' }
    };

  // page
  breadcrumbs: IV2Breadcrumb[] = [];
  actionButton: IV2ActionIconLabel;
  pageSize: number = SyncUpstreamServerComponent.PAGE_SIZE;

  // tabs
  tabs: ISyncTab[] = [];
  tab: SyncUpstreamServerTab = 'outbreaks';

  // data
  loading: boolean = true;
  serverUrl: string;
  server: SystemUpstreamServerModel;
  outbreakNames: string[] = [];
  outbreakOptions: ILabelValuePairModel[] = [];
  waitingCount: number = 0;
  connection: {
    icon: string,
    label: string,
    type: 'success' | 'danger' | 'neutral',
    message: string
  };
  lastSyncDate: string;
  showSecret: boolean = false;
  saving: boolean = false;

  // the outbreaks & the history are displayed again after a sync
  refreshKeys: number[] = [0];

  // permissions
  canListSyncs: boolean = false;
  canModify: boolean = false;
  canSync: boolean = false;
  canToggle: boolean = false;
  canDelete: boolean = false;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();
  private _authUser: UserModel;

  /**
   * Url of the server from the route
   * Note: some links encode it before the router encodes it again (e.g. the links of the tables), so it's decoded until it doesn't change
   */
  private static decodeServerUrl(value: string): string {
    let url: string = value || '';
    for (let i = 0; i < 3 && url.includes('%'); i++) {
      try {
        const decoded: string = decodeURIComponent(url);
        if (decoded === url) {
          break;
        }
        url = decoded;
      } catch (e) {
        break;
      }
    }
    return url;
  }

  /**
   * Constructor
   */
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private authDataService: AuthDataService,
    private systemSettingsDataService: SystemSettingsDataService,
    private systemSyncDataService: SystemSyncDataService,
    private systemSyncLogDataService: SystemSyncLogDataService,
    private syncOutbreakAccessDataService: SyncOutbreakAccessDataService,
    private outbreakDataService: OutbreakDataService,
    private upstreamServerCheckHelperService: UpstreamServerCheckHelperService,
    private syncActionsService: SyncActionsService,
    private syncReviewCountService: SyncReviewCountService,
    private toastV2Service: ToastV2Service
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    this._authUser = this.authDataService.getAuthenticatedUser();
    this.canListSyncs = SystemSyncLogModel.canList(this._authUser);
    this.canModify = SystemUpstreamServerModel.canModify(this._authUser);
    this.canSync = SystemUpstreamServerModel.canSync(this._authUser);
    this.canDelete = SystemUpstreamServerModel.canDelete(this._authUser);
    this.serverUrl = SyncUpstreamServerComponent.decodeServerUrl(this.activatedRoute.snapshot.params.serverUrl);

    // tab from the address, so links & the back button open it
    const tab: string = this.activatedRoute.snapshot.queryParams.tab;
    if (
      (tab === 'history' && this.canListSyncs) ||
      tab === 'settings'
    ) {
      this.tab = tab;
    }
    this.setTabs();

    // send now
    if (this.canSync) {
      this.actionButton = {
        type: V2ActionType.ICON_LABEL,
        icon: 'sync',
        label: 'LNG_SYNC_UPSTREAM_SERVER_ACTION_SYNC_TITLE',
        action: {
          click: () => this.startSync()
        },
        disable: () => !this.server
      };
    }

    // breadcrumbs (the name is added when the server is retrieved)
    this.setBreadcrumbs();

    // retrieve
    forkJoin([
      this.systemSettingsDataService.getSystemSettings(),
      this.outbreakDataService
        .getOutbreaksListReduced()
        .pipe(catchError(() => of([])))
    ])
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return of([undefined, []]);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe(([settings, outbreaks]: [SystemSettingsModel, OutbreakModel[]]) => {
        this.server = (settings?.upstreamServers || []).find((server) => server.url === this.serverUrl);
        this.outbreakNames = outbreaks
          .filter((outbreak) => (this.server?.outbreakIDs || []).includes(outbreak.id))
          .map((outbreak) => outbreak.name);
        this.outbreakOptions = outbreaks.map((outbreak) => ({
          label: outbreak.name,
          value: outbreak.id
        }));
        this.loading = false;
        this.setBreadcrumbs();
        this.setToggleRight();

        if (this.server) {
          this.loadLastSync();
          this.loadWaitingCount();
          this.checkConnection();
        }
      });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  /**
   * Open a tab
   */
  openTab(tab: string): void {
    this.tab = tab as SyncUpstreamServerTab;
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        tab: tab === 'outbreaks' ? null : tab
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Choose what is sent & send it
   */
  startSync(): void {
    if (!this.server) {
      return;
    }

    this.syncActionsService
      .startSync(this.server, this.outbreakOptions)
      .pipe(takeUntil(this._destroyed$))
      .subscribe(() => {
        // the decisions & the history might have changed
        this.refreshKeys = [this.refreshKeys[0] + 1];
        this.loadLastSync();
        this.loadWaitingCount();
        this.syncReviewCountService.refresh(true);
      });
  }

  /**
   * Enable / disable the automatic syncs
   */
  toggleSync(): void {
    this.saving = true;
    this.syncActionsService
      .toggleServerSync(this.server)
      .pipe(
        catchError(() => of(this.server.syncEnabled)),
        takeUntil(this._destroyed$)
      )
      .subscribe((syncEnabled: boolean) => {
        this.server.syncEnabled = syncEnabled;
        this.saving = false;
        this.setToggleRight();
      });
  }

  /**
   * Copy a value of the credentials
   */
  copy(value: string): void {
    navigator.clipboard
      ?.writeText(value)
      .then(() => this.toastV2Service.success('LNG_SYNC_CREDENTIALS_COPIED'))
      .catch(() => {});
  }

  /**
   * Delete
   */
  delete(): void {
    this.syncActionsService
      .deleteServer(this.server)
      .pipe(
        catchError(() => of(false)),
        takeUntil(this._destroyed$)
      )
      .subscribe((deleted: boolean) => {
        if (deleted) {
          this.syncReviewCountService.refresh(true);
          this.router.navigate(['/system-config/upstream-servers']);
        }
      });
  }

  /**
   * Last sync (the sync dialog displays it)
   */
  private loadLastSync(): void {
    if (!this.canListSyncs) {
      return;
    }

    const qb = new RequestQueryBuilder();
    qb.filter.byEquality('syncServerUrl', this.server.url);
    qb.sort.by('actionStartDate', RequestSortDirection.DESC);
    qb.limit(1);
    this.systemSyncLogDataService
      .getSyncLogList(qb)
      .pipe(
        catchError(() => of([])),
        takeUntil(this._destroyed$)
      )
      .subscribe((syncLogs: SystemSyncLogModel[]) => {
        this.server.lastSyncLog = syncLogs[0];
        this.lastSyncDate = syncLogs[0]?.actionStartDate ?
          LocalizationHelper.displayDateTime(syncLogs[0].actionStartDate) :
          undefined;
      });
  }

  /**
   * Outbreaks waiting for the decision of the server (last known decisions)
   */
  private loadWaitingCount(): void {
    this.syncOutbreakAccessDataService
      .getUpstreamAccessList()
      .pipe(
        map((states: UpstreamOutbreakAccessModel[]) => states.find((state) => state.upstreamServerUrl === this.server.url)),
        catchError(() => of(undefined)),
        takeUntil(this._destroyed$)
      )
      .subscribe((state: UpstreamOutbreakAccessModel) => {
        this.waitingCount = state?.mode === 'request' ?
          state.outbreaksWithStatus(SyncOutbreakAccessStatus.PENDING).length :
          0;
        this.setTabs();
      });
  }

  /**
   * Is the server online & does it accept the credentials
   */
  private checkConnection(): void {
    // the check is made by the api, and it needs the same permission used to save the servers
    if (!this.canModify) {
      return;
    }

    this.setConnection('checking', '');
    (this.systemSyncDataService.checkUpstreamServer({
      url: this.server.url,
      clientId: this.server.credentials?.clientId,
      clientSecret: this.server.credentials?.clientSecret
    }) as Observable<any>)
      .pipe(
        map((check) => this.upstreamServerCheckHelperService.summarize(check)),
        catchError(() => of({
          status: 'unknown' as SystemUpstreamServerConnectionStatus,
          message: ''
        })),
        takeUntil(this._destroyed$)
      )
      .subscribe((connection) => {
        this.setConnection(connection.status, connection.message);
      });
  }

  /**
   * Connection as displayed
   */
  private setConnection(
    status: SystemUpstreamServerConnectionStatus,
    message: string
  ): void {
    this.connection = {
      ...SyncUpstreamServerComponent.CONNECTION_STATUS[status],
      message
    };
  }

  /**
   * Can the automatic syncs be enabled / disabled by the user
   */
  private setToggleRight(): void {
    this.canToggle = !!this.server && (
      this.server.syncEnabled ?
        SystemUpstreamServerModel.canDisableSync(this._authUser) :
        SystemUpstreamServerModel.canEnableSync(this._authUser)
    );
  }

  /**
   * Tabs
   */
  private setTabs(): void {
    this.tabs = [
      {
        key: 'outbreaks',
        icon: 'coronavirus',
        label: 'LNG_SYNC_TAB_OUTBREAKS',
        count: this.waitingCount,
        countType: 'info',
        countTooltip: 'LNG_SYNC_TAB_WAITING_SERVER_COUNT'
      },
      ...(this.canListSyncs ? [{
        key: 'history',
        icon: 'history',
        label: 'LNG_SYNC_TAB_HISTORY'
      }] : []),
      {
        key: 'settings',
        icon: 'tune',
        label: 'LNG_SYNC_TAB_SETTINGS'
      }
    ];
  }

  /**
   * Breadcrumbs
   */
  private setBreadcrumbs(): void {
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this._authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_LAYOUT_MENU_ITEM_UPSTREAM_SERVERS_LABEL',
        action: {
          link: ['/system-config/upstream-servers']
        }
      }, {
        label: this.server?.name || 'LNG_SYNC_UPSTREAM_SERVER_TITLE',
        action: null
      }
    ];
  }
}
