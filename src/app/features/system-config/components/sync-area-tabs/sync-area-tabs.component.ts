import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { SyncReviewCountService } from '../../../../core/services/helper/sync-review-count.service';
import { ISyncAreaTab, SYNC_AREAS, SyncArea } from '../../sync-area';

/**
 * Tab as displayed
 */
interface ISyncAreaTabItem extends ISyncAreaTab {
  // number displayed next to the label (e.g. received outbreaks waiting for review)
  count?: number;

  // warning: waits for the user; info: waits for another instance
  countType?: 'warning' | 'info';
  countTooltip?: string;
}

/**
 * Menu of a sync area (receive / send), so each responsibility has its own page
 */
@Component({
  selector: 'app-sync-area-tabs',
  templateUrl: './sync-area-tabs.component.html',
  styleUrls: ['./sync-area-tabs.component.scss']
})
export class SyncAreaTabsComponent implements OnInit, OnDestroy {
  // area
  @Input() area: SyncArea = 'receive';

  // tab of the current page
  @Input() active: ISyncAreaTab['key'];

  // tabs the user can open
  tabs: ISyncAreaTabItem[] = [];

  // subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private authDataService: AuthDataService,
    private syncReviewCountService: SyncReviewCountService
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    // tabs the user can open
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    const canOpen: {
      [key in ISyncAreaTab['key']]: boolean
    } = {
      keys: SystemClientApplicationModel.canList(authUser),
      review: SystemClientApplicationModel.canList(authUser),
      servers: SystemUpstreamServerModel.canList(authUser),
      history: SystemSyncLogModel.canList(authUser),
      'how-it-works': true
    };
    this.tabs = SYNC_AREAS[this.area].tabs
      .filter((tab) => canOpen[tab.key])
      .map((tab) => ({ ...tab }));

    // received outbreaks waiting for review
    const reviewTab: ISyncAreaTabItem = this.tabs.find((tab) => tab.key === 'review');
    if (reviewTab) {
      reviewTab.countType = 'warning';
      reviewTab.countTooltip = 'LNG_SYNC_AREA_TAB_REVIEW_COUNT';
      this.syncReviewCountService.count$
        .pipe(takeUntil(this._destroyed$))
        .subscribe((count) => {
          reviewTab.count = count;
        });
    }

    // outbreaks of this instance waiting for the decision of an upstream server
    const serversTab: ISyncAreaTabItem = this.tabs.find((tab) => tab.key === 'servers');
    if (serversTab) {
      serversTab.countType = 'info';
      serversTab.countTooltip = 'LNG_SYNC_AREA_TAB_SERVERS_COUNT';
      this.syncReviewCountService.sendCount$
        .pipe(takeUntil(this._destroyed$))
        .subscribe((count) => {
          serversTab.count = count;
        });
    }
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }
}
