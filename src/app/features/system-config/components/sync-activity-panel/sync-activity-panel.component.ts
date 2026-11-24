import { Component, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash';
import { forkJoin, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';
import { RequestQueryBuilder, RequestSortDirection } from '../../../../core/helperClasses/request-query-builder';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';
import { Constants } from '../../../../core/models/constants';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { ISystemSyncLogReceivedOutbreak, SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { ClientApplicationDataService } from '../../../../core/services/data/client-application.data.service';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { SyncOutbreakMappingDataService } from '../../../../core/services/data/sync-outbreak-mapping.data.service';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SystemSyncLogDataService } from '../../../../core/services/data/system-sync-log.data.service';
import { SystemSyncLogHelperService } from '../../../../core/services/helper/system-sync-log-helper.service';

/**
 * Which syncs are displayed
 * - sent: this instance sent data to an upstream server
 * - received: another instance (or the mobile app / an imported package) sent data to this instance
 */
export type SyncActivityDirection = 'sent' | 'received';

/**
 * Outbreak of a sync, as displayed
 */
interface ISyncActivityOutbreak {
  // name used by the sender
  name: string;

  // name of the outbreak of this instance where the data went, when it's another one
  localName?: string;

  // where the user reviews where the data goes
  mappingId?: string;

  // number of records (received syncs)
  counts?: ISystemSyncLogReceivedOutbreak;
}

/**
 * Sync as displayed
 */
interface ISyncActivityItem {
  log: SystemSyncLogModel;
  who: string;

  // when
  day: string;
  time: string;

  status: 'success' | 'warning' | 'failed' | 'progress';

  // what happened, in plain words
  result: string;

  // outbreaks of the sync
  outbreaks: ISyncActivityOutbreak[];
  allOutbreaks: boolean;
  otherImported: number;
  failedRecords: number;

  // only the first outbreaks are displayed until the user asks for all of them
  showAllOutbreaks: boolean;

  hasError: boolean;

  // received before the api saved the number of imported records of each outbreak
  partialDetails: boolean;
}

/**
 * Names used by the list
 */
interface ISyncActivityNames {
  // server url / client id => name
  who: {
    [key: string]: string
  };

  // outbreak id => name
  outbreaks: {
    [outbreakId: string]: string
  };

  // name used by the sender => review of where its data goes
  mappings: {
    [sourceOutbreakName: string]: string
  };
}

/**
 * History of the syncs of one direction (received / sent), page by page
 */
@Component({
  selector: 'app-sync-activity-panel',
  templateUrl: './sync-activity-panel.component.html',
  styleUrls: ['./sync-activity-panel.component.scss']
})
export class SyncActivityPanelComponent implements OnInit, OnDestroy {
  // texts the api saved in the logs before it saved the details of each outbreak
  private static readonly STAGED_TEXT: RegExp = /Records waiting for the approval of the outbreak \/ questionnaire mapping: (.*?)\.\s*$/;
  private static readonly FAILED_TEXT: RegExp = /Failed records: (.*?)(Records waiting for the approval|Failed collections with related files|$)/;

  // outbreaks displayed for a sync before the user asks for all of them
  readonly OUTBREAKS_LIMIT: number = 4;

  // which syncs
  @Input() direction: SyncActivityDirection = 'sent';

  // number of syncs on each page
  @Input() pageSize: number = 10;

  // permissions
  canList: boolean = false;
  canViewError: boolean = false;
  canReview: boolean = false;

  // data
  loading: boolean = true;
  items: ISyncActivityItem[] = [];

  // pages
  pageIndex: number = 0;
  total: number;

  // only the syncs of a server / client
  focusKey: string;
  focusLabel: string;

  // names
  private _names: ISyncActivityNames = {
    who: {},
    outbreaks: {},
    mappings: {}
  };
  private _namesLoaded: boolean = false;

  // subscriptions
  private _loadSubscription: Subscription;
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private elementRef: ElementRef,
    private authDataService: AuthDataService,
    private systemSyncLogDataService: SystemSyncLogDataService,
    private systemSettingsDataService: SystemSettingsDataService,
    private clientApplicationDataService: ClientApplicationDataService,
    private outbreakDataService: OutbreakDataService,
    private syncOutbreakMappingDataService: SyncOutbreakMappingDataService,
    private systemSyncLogHelperService: SystemSyncLogHelperService
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    // permissions
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.canList = SystemSyncLogModel.canList(authUser);
    this.canViewError = SystemSyncLogModel.canView(authUser);
    this.canReview = SystemClientApplicationModel.canList(authUser);
    if (!this.canList) {
      return;
    }

    // names first, so the syncs are displayed with them
    this.loadNames()
      .pipe(takeUntil(this._destroyed$))
      .subscribe((names) => {
        this._names = names;
        this._namesLoaded = true;
        this.refresh();
      });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this.stopLoading();
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  /**
   * Show only the syncs of a server (sent) / client (received)
   */
  focus(
    key: string,
    label?: string
  ): void {
    this.focusKey = key;
    this.focusLabel = label || this._names.who[key] || key;
    this.pageIndex = 0;
    if (this._namesLoaded) {
      this.refresh();
    }
  }

  /**
   * Show the syncs of all servers / clients
   */
  clearFocus(): void {
    this.focusKey = undefined;
    this.focusLabel = undefined;
    this.pageIndex = 0;
    this.refresh();
  }

  /**
   * Change page
   */
  changePage(pageIndex: number): void {
    if (
      pageIndex < 0 ||
      pageIndex === this.pageIndex
    ) {
      return;
    }

    this.pageIndex = pageIndex;
    this.refresh();

    // the first sync of the page must be visible
    this.elementRef.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  /**
   * Number of the first / last sync of the page
   */
  get firstOnPage(): number {
    return this.items.length ?
      this.pageIndex * this.pageSize + 1 :
      0;
  }
  get lastOnPage(): number {
    return this.pageIndex * this.pageSize + this.items.length;
  }
  get hasNextPage(): boolean {
    return this.total !== undefined ?
      this.lastOnPage < this.total :
      this.items.length === this.pageSize;
  }

  /**
   * Reload the syncs
   */
  refresh(): void {
    // nothing to do ?
    if (!this.canList) {
      return;
    }

    // condition
    const field: string = this.direction === 'sent' ?
      'syncServerUrl' :
      'syncClientId';
    const qb = new RequestQueryBuilder();
    qb.filter.where({
      [field]: this.focusKey ?
        this.focusKey :
        { neq: null }
    });

    // number of syncs
    const countQb: RequestQueryBuilder = _.cloneDeep(qb);

    // page
    qb.sort.by(
      'actionStartDate',
      RequestSortDirection.DESC
    );
    qb.paginator.setPage(
      {
        pageSize: this.pageSize,
        pageIndex: this.pageIndex
      },
      true
    );

    // retrieve
    this.stopLoading();
    this.loading = true;
    this._loadSubscription = forkJoin([
      this.systemSyncLogDataService
        .getSyncLogList(qb)
        .pipe(catchError(() => of([]))),
      this.systemSyncLogDataService
        .getSyncLogsCount(countQb)
        .pipe(catchError(() => of(undefined)))
    ])
      .pipe(takeUntil(this._destroyed$))
      .subscribe(([logs, count]: [SystemSyncLogModel[], { count: number }]) => {
        this._loadSubscription = undefined;
        this.items = logs.map((log) => this.toItem(log));
        this.total = count?.count;
        this.loading = false;
      });
  }

  /**
   * Error / warning details
   */
  viewError(item: ISyncActivityItem): void {
    this.systemSyncLogHelperService.viewError(item.log);
  }

  /**
   * Item tracking
   */
  trackByItem(_index: number, item: ISyncActivityItem): string {
    return item.log.id;
  }

  /**
   * Sync to item
   */
  private toItem(log: SystemSyncLogModel): ISyncActivityItem {
    // who
    const key: string = this.direction === 'sent' ?
      log.syncServerUrl :
      log.syncClientId;

    // outbreaks
    let outbreaks: ISyncActivityOutbreak[] = [];
    let otherImported: number = 0;
    let failedRecords: number = 0;
    let staged: number = 0;
    let partialDetails: boolean = false;
    if (this.direction === 'received') {
      if (log.receivedSummary) {
        // what happened to the records of each outbreak
        outbreaks = (log.receivedSummary.outbreaks || []).map((outbreak) => {
          staged += outbreak.staged || 0;
          failedRecords += (outbreak.failed || 0) + (outbreak.notAllowed || 0);
          const localName: string = outbreak.outbreakId ?
            this._names.outbreaks[outbreak.outbreakId] :
            undefined;
          const name: string = outbreak.sourceOutbreakName || localName || outbreak.sourceOutbreakId;
          return {
            name,
            localName: localName && localName !== name ?
              localName :
              undefined,
            mappingId: outbreak.staged ?
              outbreak.mappingId :
              undefined,
            counts: outbreak
          };
        });
        otherImported = log.receivedSummary.otherImported || 0;
        failedRecords += log.receivedSummary.otherFailed || 0;
      } else {
        // older syncs: only the warning text tells what didn't get in
        partialDetails = true;
        const fromText = this.readOlderLogText(log);
        outbreaks = fromText.outbreaks;
        staged = fromText.staged;
        failedRecords = fromText.failed;
      }

      // what needs attention first, then the outbreaks with more data
      outbreaks.sort((a, b) => {
        const attentionA: number = (a.counts?.staged || 0) + (a.counts?.failed || 0) + (a.counts?.notAllowed || 0) > 0 ? 1 : 0;
        const attentionB: number = (b.counts?.staged || 0) + (b.counts?.failed || 0) + (b.counts?.notAllowed || 0) > 0 ? 1 : 0;
        return attentionB - attentionA ||
          (b.counts?.imported || 0) - (a.counts?.imported || 0);
      });
    } else {
      // outbreaks chosen for the sync; none means all
      outbreaks = (log.outbreakIDs || []).map((outbreakId) => ({
        name: this._names.outbreaks[outbreakId] || outbreakId
      }));
    }

    // status
    let status: ISyncActivityItem['status'];
    let result: string;
    const receivedNothing: boolean = this.direction === 'received' &&
      !!log.receivedSummary &&
      !outbreaks.length &&
      !otherImported &&
      !failedRecords;
    switch (log.status) {
      case Constants.SYSTEM_SYNC_LOG_STATUS.IN_PROGRESS.value:
        status = 'progress';
        result = 'LNG_SYNC_ACTIVITY_RESULT_IN_PROGRESS';
        break;

      case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS.value:
      case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS_WITH_WARNINGS.value:
        status = log.status === Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS.value ?
          'success' :
          'warning';
        if (this.direction === 'sent') {
          result = status === 'success' ?
            'LNG_SYNC_ACTIVITY_RESULT_SENT' :
            'LNG_SYNC_ACTIVITY_RESULT_SENT_WITH_WARNINGS';
        } else if (receivedNothing) {
          result = 'LNG_SYNC_ACTIVITY_RESULT_NOTHING_RECEIVED';
        } else if (
          failedRecords > 0 || (
            status === 'warning' &&
            !staged
          )
        ) {
          result = 'LNG_SYNC_ACTIVITY_RESULT_PARTIAL';
        } else if (staged > 0) {
          result = 'LNG_SYNC_ACTIVITY_RESULT_WAITING';
        } else {
          result = 'LNG_SYNC_ACTIVITY_RESULT_RECEIVED';
        }
        break;

      default:
        // older logs saved "nothing to send" as a failure
        if (this.systemSyncLogHelperService.isNoDataToSync(log)) {
          status = 'success';
          result = 'LNG_SYNC_ACTIVITY_RESULT_NOTHING_TO_SEND';
        } else {
          status = 'failed';
          result = 'LNG_SYNC_ACTIVITY_RESULT_FAILED';
        }
    }

    // when
    const startedAt = log.actionStartDate ?
      LocalizationHelper.toMoment(log.actionStartDate) :
      undefined;

    // finished
    return {
      log,
      who: this._names.who[key] || key,
      day: startedAt ?
        LocalizationHelper.displayDate(startedAt) :
        '',
      time: startedAt ?
        startedAt.format('HH:mm') :
        '',
      status,
      result,
      outbreaks,
      allOutbreaks: this.direction === 'sent' && !outbreaks.length,
      otherImported,
      failedRecords,
      showAllOutbreaks: false,
      hasError: this.systemSyncLogHelperService.hasError(log),
      partialDetails: partialDetails && status !== 'progress'
    };
  }

  /**
   * Older syncs: outbreaks waiting for review & records with errors, as written in the warning of the log
   */
  private readOlderLogText(log: SystemSyncLogModel): {
    outbreaks: ISyncActivityOutbreak[],
    staged: number,
    failed: number
  } {
    const outbreaks: ISyncActivityOutbreak[] = [];
    let staged: number = 0;
    let failed: number = 0;
    const text: string = typeof log.error === 'string' ?
      log.error :
      '';

    // e.g. "Records waiting for the approval of the outbreak / questionnaire mapping: Dengue (1), Zika (visual) (2). "
    const stagedMatch = SyncActivityPanelComponent.STAGED_TEXT.exec(text);
    if (stagedMatch) {
      stagedMatch[1].split(/,\s+(?=[^,]+\(\d+\)(?:,|$))/).forEach((part) => {
        const outbreakMatch = /^(.*)\s\((\d+)\)$/.exec(part.trim());
        if (!outbreakMatch) {
          return;
        }
        const count: number = parseInt(outbreakMatch[2], 10);
        staged += count;
        outbreaks.push({
          name: outbreakMatch[1],
          mappingId: this._names.mappings[outbreakMatch[1]],
          counts: {
            sourceOutbreakId: undefined,
            imported: 0,
            staged: count,
            failed: 0,
            notAllowed: 0
          }
        });
      });
    }

    // e.g. "Failed records: Collection person. Records: ID: "1". Error: ...; ID: "2". Error: ..."
    const failedMatch = SyncActivityPanelComponent.FAILED_TEXT.exec(text);
    if (failedMatch) {
      failed = (failedMatch[1].match(/ID: "/g) || []).length;
    }

    // finished
    return {
      outbreaks,
      staged,
      failed
    };
  }

  /**
   * Names of the servers / clients, of the outbreaks and of the reviews
   */
  private loadNames(): Observable<ISyncActivityNames> {
    // sent - upstream servers, received - client applications
    const who$: Observable<{ [key: string]: string }> = this.direction === 'sent' ?
      this.systemSettingsDataService
        .getSystemSettings()
        .pipe(
          map((settings: SystemSettingsModel) => {
            const names: { [key: string]: string } = {};
            (settings?.upstreamServers || []).forEach((server) => {
              names[server.url] = server.name;
            });
            return names;
          }),
          catchError(() => of({}))
        ) :
      this.clientApplicationDataService
        .getClientApplicationsList()
        .pipe(
          map((clientApplications: SystemClientApplicationModel[]) => {
            const names: { [key: string]: string } = {};
            clientApplications.forEach((clientApplication) => {
              if (clientApplication.credentials?.clientId) {
                names[clientApplication.credentials.clientId] = clientApplication.name;
              }
            });
            return names;
          }),
          catchError(() => of({}))
        );

    // outbreaks
    const outbreaks$: Observable<{ [outbreakId: string]: string }> = this.outbreakDataService
      .getOutbreaksListReduced()
      .pipe(
        map((outbreaks: OutbreakModel[]) => {
          const names: { [outbreakId: string]: string } = {};
          outbreaks.forEach((outbreak) => {
            names[outbreak.id] = outbreak.name;
          });
          return names;
        }),
        catchError(() => of({}))
      );

    // reviews of the received outbreaks (older syncs only have the outbreak name)
    const mappings$: Observable<{ [sourceOutbreakName: string]: string }> = this.direction === 'received' && this.canReview ?
      this.syncOutbreakMappingDataService
        .getMappingsList()
        .pipe(
          map((mappings) => {
            const names: { [sourceOutbreakName: string]: string } = {};
            mappings.forEach((mapping) => {
              if (mapping.sourceOutbreakName) {
                names[mapping.sourceOutbreakName] = mapping.id;
              }
            });
            return names;
          }),
          catchError(() => of({}))
        ) :
      of({});

    // retrieve
    return forkJoin([who$, outbreaks$, mappings$])
      .pipe(
        map(([who, outbreaks, mappings]) => ({
          who,
          outbreaks,
          mappings
        }))
      );
  }

  /**
   * Stop retrieving data
   */
  private stopLoading(): void {
    if (this._loadSubscription) {
      this._loadSubscription.unsubscribe();
      this._loadSubscription = undefined;
    }
  }
}
