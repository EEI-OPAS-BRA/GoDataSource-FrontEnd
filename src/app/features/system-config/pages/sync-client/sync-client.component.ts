import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { IV2ActionIconLabel, V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';

/**
 * Page of a client (key of another Go.Data instance or of the mobile app): its key, its outbreaks & what it sent
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

  // data
  loading: boolean = true;
  client: SystemClientApplicationModel;
  outbreakNames: string[] = [];

  // permissions
  canListSyncs: boolean = false;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private activatedRoute: ActivatedRoute,
    private authDataService: AuthDataService,
    private clientApplicationDataService: ClientApplicationDataService,
    private outbreakDataService: OutbreakDataService,
    private toastV2Service: ToastV2Service
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.canListSyncs = SystemSyncLogModel.canList(authUser);
    const clientApplicationId: string = this.activatedRoute.snapshot.params.clientApplicationId;

    // edit the key
    if (SystemClientApplicationModel.canModify(authUser)) {
      this.actionButton = {
        type: V2ActionType.ICON_LABEL,
        icon: 'edit',
        label: 'LNG_SYNC_CLIENT_EDIT_BUTTON',
        action: {
          link: () => ['/system-config/client-applications', clientApplicationId, 'modify']
        }
      };
    }

    // breadcrumbs (the name is added when the client is retrieved)
    this.setBreadcrumbs(authUser);

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
        this.loading = false;
        this.setBreadcrumbs(authUser);

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
        label: 'LNG_LAYOUT_MENU_ITEM_CLIENT_APPLICATIONS_LABEL',
        action: {
          link: ['/system-config/client-applications']
        }
      }, {
        label: this.client?.name || 'LNG_SYNC_AREA_TAB_KEYS',
        action: null
      }
    ];
  }
}
