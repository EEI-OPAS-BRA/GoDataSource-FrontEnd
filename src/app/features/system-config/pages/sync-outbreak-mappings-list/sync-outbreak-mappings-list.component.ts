import { Component, OnInit } from '@angular/core';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';

/**
 * Pending tab of the receive area: what waits for a decision, of all the clients
 * (the page of each client displays all its outbreaks)
 */
@Component({
  selector: 'app-sync-outbreak-mappings-list',
  templateUrl: './sync-outbreak-mappings-list.component.html',
  styleUrls: ['../sync-area-page.scss']
})
export class SyncOutbreakMappingsListComponent implements OnInit {
  // breadcrumbs
  breadcrumbs: IV2Breadcrumb[] = [];

  /**
   * Constructor
   */
  constructor(
    private authDataService: AuthDataService
  ) {}

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
        label: 'LNG_LAYOUT_MENU_ITEM_CLIENT_APPLICATIONS_LABEL',
        action: {
          link: ['/system-config/client-applications']
        }
      }, {
        label: 'LNG_SYNC_AREA_TAB_REVIEW',
        action: null
      }
    ];
  }
}
