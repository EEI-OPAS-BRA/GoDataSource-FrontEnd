import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SyncOutbreakMappingModel } from '../../../../core/models/sync-outbreak-mapping.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { ClientApplicationDataService } from '../../../../core/services/data/client-application.data.service';
import { SyncOutbreakMappingDataService } from '../../../../core/services/data/sync-outbreak-mapping.data.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';

/**
 * Mapping as displayed in the list
 */
interface IMappingItem {
  mapping: SyncOutbreakMappingModel;
  clientName: string;
  targetOutbreakName: string;
  pendingCount: number;
  updatedAt: string;
}

@Component({
  selector: 'app-sync-outbreak-mappings-list',
  templateUrl: './sync-outbreak-mappings-list.component.html',
  styleUrls: ['./sync-outbreak-mappings-list.component.scss']
})
export class SyncOutbreakMappingsListComponent implements OnInit, OnDestroy {
  // breadcrumbs
  breadcrumbs: IV2Breadcrumb[] = [];

  // data
  loading: boolean = true;
  waitingItems: IMappingItem[] = [];
  approvedItems: IMappingItem[] = [];

  // user
  canModify: boolean = false;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private authDataService: AuthDataService,
    private activatedRoute: ActivatedRoute,
    private syncOutbreakMappingDataService: SyncOutbreakMappingDataService,
    private clientApplicationDataService: ClientApplicationDataService,
    private toastV2Service: ToastV2Service
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.canModify = SystemClientApplicationModel.canModify(authUser);

    // breadcrumbs
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_LAYOUT_MENU_ITEM_SYNC_OUTBREAK_MAPPINGS_LABEL',
        action: null
      }
    ];

    // retrieve data
    const outbreaksMap = (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).map;
    forkJoin([
      this.syncOutbreakMappingDataService.getMappingsList(),
      this.clientApplicationDataService
        .getClientApplicationsList()
        .pipe(
          // the names are only a convenience
          catchError(() => of([]))
        )
    ])
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return of([[], []]);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe(([mappings, clientApplications]: [SyncOutbreakMappingModel[], SystemClientApplicationModel[]]) => {
        // client names
        const clientNames: {
          [clientId: string]: string
        } = {};
        clientApplications.forEach((clientApplication) => {
          clientNames[clientApplication.credentials?.clientId] = clientApplication.name;
        });

        // items
        const items: IMappingItem[] = mappings.map((mapping) => ({
          mapping,
          clientName: clientNames[mapping.clientId] || mapping.clientId,
          targetOutbreakName: mapping.targetOutbreakId ?
            (outbreaksMap[mapping.targetOutbreakId]?.name || mapping.targetOutbreakId) :
            undefined,
          pendingCount: mapping.pendingQuestions.length,
          updatedAt: LocalizationHelper.displayDateTime(mapping.updatedAt)
        }));

        // waiting for the user first
        this.waitingItems = items.filter((item) => item.mapping.status !== 'APPROVED');
        this.approvedItems = items.filter((item) => item.mapping.status === 'APPROVED');
        this.loading = false;
      });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }
}
