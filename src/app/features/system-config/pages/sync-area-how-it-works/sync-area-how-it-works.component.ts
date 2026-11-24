import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';
import { ISyncAreaConfig, SYNC_AREAS, SyncArea } from '../../sync-area';

/**
 * How it works tab of a sync area
 */
@Component({
  selector: 'app-sync-area-how-it-works',
  templateUrl: './sync-area-how-it-works.component.html',
  styleUrls: ['../sync-area-page.scss']
})
export class SyncAreaHowItWorksComponent implements OnInit {
  // area
  area: SyncArea;
  config: ISyncAreaConfig;

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
        label: 'LNG_SYNC_AREA_TAB_HOW_IT_WORKS',
        action: null
      }
    ];
  }
}
