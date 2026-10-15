import { Component, OnInit } from '@angular/core';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';

/**
 * Page that one of the steps / features points to
 */
interface ISyncDocumentationLink {
  label: string;
  link: string[];
  visible: boolean;
}

/**
 * Step of the setup
 */
interface ISyncDocumentationStep {
  icon: string;
  where: string;
  title: string;
  description: string;
  link?: ISyncDocumentationLink;
}

/**
 * Feature of the sync
 */
interface ISyncDocumentationFeature {
  icon: string;
  title: string;
  description: string;
  items: string[];
  link: ISyncDocumentationLink;
}

@Component({
  selector: 'app-sync-documentation',
  templateUrl: './sync-documentation.component.html',
  styleUrls: ['./sync-documentation.component.scss']
})
export class SyncDocumentationComponent implements OnInit {
  // breadcrumbs
  breadcrumbs: IV2Breadcrumb[] = [];

  // pages
  receiveLink: ISyncDocumentationLink;
  sendLink: ISyncDocumentationLink;
  trackLink: ISyncDocumentationLink;

  // content
  steps: ISyncDocumentationStep[] = [];
  features: ISyncDocumentationFeature[] = [];
  questions: {
    question: string,
    answer: string
  }[] = [
      {
        question: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_DIRECTION_QUESTION',
        answer: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_DIRECTION_ANSWER'
      }, {
        question: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_WHAT_IS_SENT_QUESTION',
        answer: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_WHAT_IS_SENT_ANSWER'
      }, {
        question: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_OUTBREAKS_QUESTION',
        answer: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_OUTBREAKS_ANSWER'
      }, {
        question: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_OVERWRITE_QUESTION',
        answer: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_OVERWRITE_ANSWER'
      }, {
        question: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_FAILED_QUESTION',
        answer: 'LNG_PAGE_SYNC_DOCUMENTATION_FAQ_FAILED_ANSWER'
      }
    ];

  // authenticated user
  private _authUser: UserModel;

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
    // the links are displayed only for the pages the user can open
    this._authUser = this.authDataService.getAuthenticatedUser();
    this.receiveLink = {
      label: 'LNG_LAYOUT_MENU_ITEM_CLIENT_APPLICATIONS_LABEL',
      link: ['/system-config/client-applications'],
      visible: SystemClientApplicationModel.canList(this._authUser)
    };
    this.sendLink = {
      label: 'LNG_LAYOUT_MENU_ITEM_UPSTREAM_SERVERS_LABEL',
      link: ['/system-config/upstream-servers'],
      visible: SystemUpstreamServerModel.canList(this._authUser)
    };
    this.trackLink = {
      label: 'LNG_LAYOUT_MENU_ITEM_SYNC_LABEL',
      link: ['/system-config/sync-logs'],
      visible: SystemSyncLogModel.canList(this._authUser)
    };

    // setup, in the order it must be done
    this.steps = [
      {
        icon: 'vpn_key',
        where: 'LNG_PAGE_SYNC_DOCUMENTATION_WHERE_RECEIVER',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_1_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_1_DESCRIPTION',
        link: this.receiveLink
      }, {
        icon: 'dns',
        where: 'LNG_PAGE_SYNC_DOCUMENTATION_WHERE_SENDER',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_2_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_2_DESCRIPTION',
        link: this.sendLink
      }, {
        icon: 'schedule',
        where: 'LNG_PAGE_SYNC_DOCUMENTATION_WHERE_SENDER',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_3_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_3_DESCRIPTION',
        link: this.sendLink
      }, {
        icon: 'history',
        where: 'LNG_PAGE_SYNC_DOCUMENTATION_WHERE_BOTH',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_4_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_STEP_4_DESCRIPTION',
        link: this.trackLink
      }
    ];

    // features
    this.features = [
      {
        icon: 'cloud_upload',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_SEND_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_SEND_DESCRIPTION',
        items: [
          'LNG_PAGE_SYNC_DOCUMENTATION_SEND_ITEM_1',
          'LNG_PAGE_SYNC_DOCUMENTATION_SEND_ITEM_2',
          'LNG_PAGE_SYNC_DOCUMENTATION_SEND_ITEM_3',
          'LNG_PAGE_SYNC_DOCUMENTATION_SEND_ITEM_4'
        ],
        link: this.sendLink
      }, {
        icon: 'cloud_download',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_RECEIVE_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_RECEIVE_DESCRIPTION',
        items: [
          'LNG_PAGE_SYNC_DOCUMENTATION_RECEIVE_ITEM_1',
          'LNG_PAGE_SYNC_DOCUMENTATION_RECEIVE_ITEM_2',
          'LNG_PAGE_SYNC_DOCUMENTATION_RECEIVE_ITEM_3',
          'LNG_PAGE_SYNC_DOCUMENTATION_RECEIVE_ITEM_4'
        ],
        link: this.receiveLink
      }, {
        icon: 'assessment',
        title: 'LNG_PAGE_SYNC_DOCUMENTATION_TRACK_TITLE',
        description: 'LNG_PAGE_SYNC_DOCUMENTATION_TRACK_DESCRIPTION',
        items: [
          'LNG_PAGE_SYNC_DOCUMENTATION_TRACK_ITEM_1',
          'LNG_PAGE_SYNC_DOCUMENTATION_TRACK_ITEM_2',
          'LNG_PAGE_SYNC_DOCUMENTATION_TRACK_ITEM_3',
          'LNG_PAGE_SYNC_DOCUMENTATION_TRACK_ITEM_4'
        ],
        link: this.trackLink
      }
    ];

    // breadcrumbs
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this._authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_LAYOUT_MENU_ITEM_SYNC_DOCUMENTATION_LABEL',
        action: null
      }
    ];
  }
}
