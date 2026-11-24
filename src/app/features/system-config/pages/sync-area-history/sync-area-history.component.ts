import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { SyncActivityPanelComponent } from '../../components/sync-activity-panel/sync-activity-panel.component';
import { ISyncAreaConfig, SYNC_AREAS, SyncArea } from '../../sync-area';

/**
 * History tab of a sync area: what was received / sent and how it went
 */
@Component({
  selector: 'app-sync-area-history',
  templateUrl: './sync-area-history.component.html',
  styleUrls: ['../sync-area-page.scss']
})
export class SyncAreaHistoryComponent implements OnInit, AfterViewInit {
  // number of syncs on each page
  static readonly PAGE_SIZE: number = 10;

  // syncs
  @ViewChild('activityPanel', { static: true }) activityPanel: SyncActivityPanelComponent;

  // area
  area: SyncArea;
  config: ISyncAreaConfig;
  pageSize: number = SyncAreaHistoryComponent.PAGE_SIZE;

  // breadcrumbs
  breadcrumbs: IV2Breadcrumb[] = [];

  /**
   * Constructor
   */
  constructor(
    private activatedRoute: ActivatedRoute,
    private authDataService: AuthDataService
  ) {
    this.area = this.activatedRoute.snapshot.data.area;
    this.config = SYNC_AREAS[this.area];
  }

  /**
   * Initialized
   */
  ngOnInit(): void {
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: this.config.title,
        action: {
          link: this.config.link
        }
      }, {
        label: 'LNG_SYNC_AREA_TAB_HISTORY',
        action: null
      }
    ];
  }

  /**
   * View initialized
   */
  ngAfterViewInit(): void {
    // only the syncs of a server / client (e.g. opened from a row of the list)
    const key: string = this.activatedRoute.snapshot.queryParams.key;
    if (key) {
      this.activityPanel.focus(
        key,
        this.activatedRoute.snapshot.queryParams.name
      );
    }
  }
}
