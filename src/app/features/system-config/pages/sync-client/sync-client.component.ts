import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { ClientApplicationDataService } from '../../../../core/services/data/client-application.data.service';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { ClientApplicationHelperService } from '../../../../core/services/helper/client-application-helper.service';
import { SyncReviewCountService } from '../../../../core/services/helper/sync-review-count.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { IV2ActionIconLabel, V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import { ISyncTab } from '../../components/sync-tabs/sync-tabs.component';
import { SyncActionsService } from '../../services/sync-actions.service';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';

/**
 * Tabs of the page
 */
type SyncClientTab = 'outbreaks' | 'history' | 'settings';

/**
 * Page of a client (key of another Go.Data instance or of the mobile app): everything about it is seen & done here
 * - outbreaks: what it asked to send & the decisions
 * - history: what it sent
 * - settings: its key & what can be done with it (edit, activate / deactivate, configuration file, delete)
 */
@Component({
  selector: 'app-sync-client',
  templateUrl: './sync-client.component.html',
  styleUrls: ['../sync-area-page.scss', './sync-client.component.scss']
})
export class SyncClientComponent implements OnInit, OnDestroy {
  // number of syncs on each page of the history
  static readonly PAGE_SIZE: number = 10;

  // page
  breadcrumbs: IV2Breadcrumb[] = [];
  actionButton: IV2ActionIconLabel;
  pageSize: number = SyncClientComponent.PAGE_SIZE;

  // tabs
  tabs: ISyncTab[] = [];
  tab: SyncClientTab = 'outbreaks';

  // data
  loading: boolean = true;
  client: SystemClientApplicationModel;
  outbreakNames: string[] = [];
  waitingCount: number = 0;
  showSecret: boolean = false;
  saving: boolean = false;

  // permissions
  canListSyncs: boolean = false;
  canModify: boolean = false;
  canToggle: boolean = false;
  canDownloadConfFile: boolean = false;
  canDelete: boolean = false;

  // when data was sent with this key the last time
  lastSyncDate: string;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();
  private _authUser: UserModel;

  /**
   * Constructor
   */
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private authDataService: AuthDataService,
    private clientApplicationDataService: ClientApplicationDataService,
    private clientApplicationHelperService: ClientApplicationHelperService,
    private outbreakDataService: OutbreakDataService,
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
    this.canModify = SystemClientApplicationModel.canModify(this._authUser);
    this.canDownloadConfFile = SystemClientApplicationModel.canDownloadConfFile(this._authUser);
    this.canDelete = SystemClientApplicationModel.canDelete(this._authUser);

    // tab from the address, so links & the back button open it
    const tab: string = this.activatedRoute.snapshot.queryParams.tab;
    if (
      (tab === 'history' && this.canListSyncs) ||
      tab === 'settings'
    ) {
      this.tab = tab;
    }
    this.setTabs();

    // edit
    const clientApplicationId: string = this.activatedRoute.snapshot.params.clientApplicationId;
    if (this.canModify) {
      this.actionButton = {
        type: V2ActionType.ICON_LABEL,
        icon: 'edit',
        label: 'LNG_SYNC_CLIENT_ACTION_EDIT_TITLE',
        action: {
          link: () => ['/system-config/client-applications', clientApplicationId, 'modify']
        }
      };
    }

    // breadcrumbs (the name is added when the client is retrieved)
    this.setBreadcrumbs();

    // retrieve
    this.clientApplicationDataService
      .getClientApplication(clientApplicationId)
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return of(undefined);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe((client: SystemClientApplicationModel) => {
        this.client = client;
        this.lastSyncDate = client?.lastSyncAt ?
          LocalizationHelper.displayDateTime(client.lastSyncAt) :
          undefined;
        this.loading = false;
        this.setBreadcrumbs();
        this.setToggleRight();

        // outbreaks of a key of the mobile app
        if (
          client &&
          !client.usesRequests &&
          client.outbreakIDs?.length
        ) {
          this.outbreakDataService
            .getOutbreaksListReduced()
            .pipe(
              catchError(() => of([])),
              takeUntil(this._destroyed$)
            )
            .subscribe((outbreaks: OutbreakModel[]) => {
              this.outbreakNames = outbreaks
                .filter((outbreak) => client.outbreakIDs.includes(outbreak.id))
                .map((outbreak) => outbreak.name);
            });
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
    this.tab = tab as SyncClientTab;
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
   * Number of outbreaks waiting for the user
   */
  setWaitingCount(count: number): void {
    this.waitingCount = count;
    this.setTabs();
  }

  /**
   * Activate / deactivate
   */
  toggleActive(): void {
    this.saving = true;
    this.syncActionsService
      .toggleClientActive(this.client)
      .pipe(
        catchError(() => of(this.client.active)),
        takeUntil(this._destroyed$)
      )
      .subscribe((active: boolean) => {
        this.client.active = active;
        this.saving = false;
        this.setToggleRight();
      });
  }

  /**
   * Configuration file (mobile app)
   */
  downloadConfFile(): void {
    this.clientApplicationHelperService.downloadConfFile(this.client);
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
      .deleteClient(this.client)
      .pipe(
        catchError(() => of(false)),
        takeUntil(this._destroyed$)
      )
      .subscribe((deleted: boolean) => {
        if (deleted) {
          this.syncReviewCountService.refresh(true);
          this.router.navigate(['/system-config/client-applications']);
        }
      });
  }

  /**
   * Can the client be activated / deactivated by the user
   */
  private setToggleRight(): void {
    this.canToggle = !!this.client && (
      this.client.active ?
        SystemClientApplicationModel.canDisable(this._authUser) :
        SystemClientApplicationModel.canEnable(this._authUser)
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
        countType: 'warning',
        countTooltip: 'LNG_SYNC_TAB_WAITING_COUNT'
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
        label: 'LNG_LAYOUT_MENU_ITEM_CLIENT_APPLICATIONS_LABEL',
        action: {
          link: ['/system-config/client-applications']
        }
      }, {
        label: this.client?.name || 'LNG_SYNC_CLIENT_TITLE',
        action: null
      }
    ];
  }
}
