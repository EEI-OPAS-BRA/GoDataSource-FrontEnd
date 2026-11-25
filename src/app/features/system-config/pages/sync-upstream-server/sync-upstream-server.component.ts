import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { IV2ActionIconLabel, V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';

/**
 * Page of a destination server: where this instance sends its data, which outbreaks it accepts & what was sent to it
 */
@Component({
  selector: 'app-sync-upstream-server',
  templateUrl: './sync-upstream-server.component.html',
  styleUrls: ['../sync-area-page.scss', '../sync-client/sync-client.component.scss']
})
export class SyncUpstreamServerComponent implements OnInit, OnDestroy {
  // number of syncs on each page of the history
  static readonly PAGE_SIZE: number = 10;

  // page
  breadcrumbs: IV2Breadcrumb[] = [];
  actionButton: IV2ActionIconLabel;
  pageSize: number = SyncUpstreamServerComponent.PAGE_SIZE;

  // data
  loading: boolean = true;
  serverUrl: string;
  server: SystemUpstreamServerModel;
  outbreakNames: string[] = [];

  // permissions
  canListSyncs: boolean = false;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

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
    private authDataService: AuthDataService,
    private systemSettingsDataService: SystemSettingsDataService,
    private outbreakDataService: OutbreakDataService,
    private toastV2Service: ToastV2Service
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.canListSyncs = SystemSyncLogModel.canList(authUser);
    this.serverUrl = SyncUpstreamServerComponent.decodeServerUrl(this.activatedRoute.snapshot.params.serverUrl);

    // edit the server
    if (SystemUpstreamServerModel.canModify(authUser)) {
      this.actionButton = {
        type: V2ActionType.ICON_LABEL,
        icon: 'edit',
        label: 'LNG_SYNC_UPSTREAM_SERVER_EDIT_BUTTON',
        action: {
          link: () => ['/system-config/upstream-servers/modify'],
          linkQueryParams: () => ({
            url: this.serverUrl
          })
        }
      };
    }

    // breadcrumbs (the name is added when the server is retrieved)
    this.setBreadcrumbs(authUser);

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
        this.loading = false;
        this.setBreadcrumbs(authUser);
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
   * Breadcrumbs
   */
  private setBreadcrumbs(authUser: UserModel): void {
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_LAYOUT_MENU_ITEM_UPSTREAM_SERVERS_LABEL',
        action: {
          link: ['/system-config/upstream-servers']
        }
      }, {
        label: this.server?.name || 'LNG_SYNC_AREA_TAB_SERVERS',
        action: null
      }
    ];
  }
}
