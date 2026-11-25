import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';
import {
  IUpstreamOutbreakAccessOutbreak,
  SyncOutbreakAccessStatus,
  UpstreamOutbreakAccessModel
} from '../../../../core/models/sync-outbreak-access.model';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { SyncOutbreakAccessDataService } from '../../../../core/services/data/sync-outbreak-access.data.service';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SyncReviewCountService } from '../../../../core/services/helper/sync-review-count.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { UpstreamServerCheckHelperService } from '../../../../core/services/helper/upstream-server-check-helper.service';

/**
 * Upstream server as displayed
 */
interface IUpstreamAccessItem {
  server: SystemUpstreamServerModel;
  state: UpstreamOutbreakAccessModel;

  // outbreaks by decision
  pending: IUpstreamOutbreakAccessOutbreak[];
  accepted: IUpstreamOutbreakAccessOutbreak[];
  refused: IUpstreamOutbreakAccessOutbreak[];
  paused: IUpstreamOutbreakAccessOutbreak[];

  checkedAt: string;
  requestedAt: string;

  // why the last decisions couldn't be retrieved
  errorReason: string;

  // asking the upstream server
  checking: boolean;
}

/**
 * Decisions of the upstream servers about the outbreaks of this instance: what is waiting for approval, what is sent, what was refused
 */
@Component({
  selector: 'app-sync-upstream-access-panel',
  templateUrl: './sync-upstream-access-panel.component.html',
  styleUrls: ['./sync-upstream-access-panel.component.scss']
})
export class SyncUpstreamAccessPanelComponent implements OnInit, AfterViewInit, OnDestroy {
  // only one upstream server (its page)
  @Input() serverUrl: string;

  // height changed
  @Output() resized = new EventEmitter<void>();

  // permissions
  canList: boolean = false;

  // data
  loading: boolean = true;
  items: IUpstreamAccessItem[] = [];

  // observer
  private _resizeObserver: ResizeObserver;

  // subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private authDataService: AuthDataService,
    private systemSettingsDataService: SystemSettingsDataService,
    private syncOutbreakAccessDataService: SyncOutbreakAccessDataService,
    private syncReviewCountService: SyncReviewCountService,
    private toastV2Service: ToastV2Service,
    private upstreamServerCheckHelperService: UpstreamServerCheckHelperService
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    // permissions
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.canList = SystemUpstreamServerModel.canList(authUser);
    if (!this.canList) {
      this.loading = false;
      return;
    }

    // last known decisions, then the current ones
    forkJoin([
      this.systemSettingsDataService
        .getSystemSettings()
        .pipe(catchError(() => of(undefined))),
      this.syncOutbreakAccessDataService
        .getUpstreamAccessList()
        .pipe(catchError(() => of([])))
    ])
      .pipe(takeUntil(this._destroyed$))
      .subscribe(([settings, states]: [SystemSettingsModel, UpstreamOutbreakAccessModel[]]) => {
        const statesMap: {
          [url: string]: UpstreamOutbreakAccessModel
        } = {};
        states.forEach((state) => {
          statesMap[state.upstreamServerUrl] = state;
        });
        this.items = (settings?.upstreamServers || [])
          .filter((server) => !this.serverUrl || server.url === this.serverUrl)
          .map((server) => this.toItem(server, statesMap[server.url]));
        this.loading = false;

        // ask the servers for their current decisions (the new outbreaks are requested)
        this.items
          .filter((item) => item.server.syncEnabled)
          .forEach((item) => this.check(item, true));
      });
  }

  /**
   * View initialized
   */
  ngAfterViewInit(): void {
    // parent needs to know when our height changes, so it can resize the table placed below
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    // nothing to detect, so stay out of angular zone
    this.ngZone.runOutsideAngular(() => {
      this._resizeObserver = new ResizeObserver(() => {
        this.resized.emit();
      });
      this._resizeObserver.observe(this.elementRef.nativeElement);
    });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }

    this._destroyed$.next();
    this._destroyed$.complete();
  }

  /**
   * Ask an upstream server for its decisions (the outbreaks it doesn't know yet are requested)
   * @param item
   * @param silent don't display errors (automatic check)
   */
  check(
    item: IUpstreamAccessItem,
    silent?: boolean
  ): void {
    item.checking = true;
    this.syncOutbreakAccessDataService
      .checkUpstreamAccess(item.server.url)
      .pipe(
        catchError((err) => {
          item.checking = false;
          if (!silent) {
            this.toastV2Service.error(err);
          }

          // the error is saved with the last known decisions
          this.syncOutbreakAccessDataService
            .getUpstreamAccessList()
            .pipe(catchError(() => of([])))
            .subscribe((states: UpstreamOutbreakAccessModel[]) => {
              const state = states.find((value) => value.upstreamServerUrl === item.server.url);
              if (state) {
                Object.assign(item, this.toItem(item.server, state));
              }
            });
          return of(undefined);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe((state: UpstreamOutbreakAccessModel) => {
        if (!state) {
          return;
        }

        Object.assign(item, this.toItem(item.server, state));
        item.checking = false;
        this.syncReviewCountService.refresh(true);
      });
  }

  /**
   * Item tracking
   */
  trackByItem(_index: number, item: IUpstreamAccessItem): string {
    return item.server.url;
  }

  /**
   * Upstream server to item
   */
  private toItem(
    server: SystemUpstreamServerModel,
    state: UpstreamOutbreakAccessModel
  ): IUpstreamAccessItem {
    return {
      server,
      state,
      pending: state ? state.outbreaksWithStatus(SyncOutbreakAccessStatus.PENDING) : [],
      accepted: state ? state.outbreaksWithStatus(SyncOutbreakAccessStatus.ACCEPTED) : [],
      refused: state ? state.outbreaksWithStatus(SyncOutbreakAccessStatus.REFUSED) : [],
      paused: state ? state.outbreaksWithStatus(SyncOutbreakAccessStatus.PAUSED) : [],
      checkedAt: state?.checkedAt ? LocalizationHelper.displayDateTime(state.checkedAt) : undefined,
      requestedAt: state?.requestedAt ? LocalizationHelper.displayDateTime(state.requestedAt) : undefined,
      errorReason: state?.errorCode ? this.upstreamServerCheckHelperService.getErrorMessage(state.errorCode) : undefined,
      checking: false
    };
  }
}
