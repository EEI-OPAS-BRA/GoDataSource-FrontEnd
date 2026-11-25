import { Injectable, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { ISyncOutbreakAccessWaitingCount, SyncOutbreakAccessStatus, UpstreamOutbreakAccessModel } from '../../models/sync-outbreak-access.model';
import { SystemClientApplicationModel } from '../../models/system-client-application.model';
import { SystemUpstreamServerModel } from '../../models/system-upstream-server.model';
import { UserModel } from '../../models/user.model';
import { AuthDataService } from '../data/auth.data.service';
import { SyncOutbreakAccessDataService } from '../data/sync-outbreak-access.data.service';

/**
 * What waits for someone in the sync areas, shared by the main menu and the tabs, so they always display the same numbers
 * - receive: outbreaks other instances asked to send & received outbreaks whose questions must be reviewed (waiting for this user)
 * - send: outbreaks of this instance waiting for the decision of an upstream server (waiting for the other instance)
 */
@Injectable({
  providedIn: 'root'
})
export class SyncReviewCountService implements OnDestroy {
  // don't ask the api again when the user navigates quickly between pages
  private static readonly MIN_REFRESH_INTERVAL: number = 15000;

  // numbers
  private _count$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private _sendCount$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private _lastRefresh: number = 0;

  // subscriptions
  private _requests: Subscription[] = [];
  private _navigation: Subscription;

  /**
   * Constructor
   */
  constructor(
    private router: Router,
    private authDataService: AuthDataService,
    private syncOutbreakAccessDataService: SyncOutbreakAccessDataService
  ) {
    // received data / decisions might arrive at any time, so the numbers are checked again when the user changes page
    this._navigation = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.refresh();
      });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    if (this._navigation) {
      this._navigation.unsubscribe();
      this._navigation = undefined;
    }
    this.stopRequests();
  }

  /**
   * Received outbreaks waiting for this user (requests & reviews)
   */
  get count$(): Observable<number> {
    return this._count$.asObservable();
  }

  /**
   * Outbreaks of this instance waiting for the decision of an upstream server
   */
  get sendCount$(): Observable<number> {
    return this._sendCount$.asObservable();
  }

  /**
   * Ask the api for the numbers
   * @param force Don't wait for the minimum interval (e.g. a request was just decided)
   */
  refresh(force?: boolean): void {
    // asked recently ?
    const now: number = Date.now();
    if (
      !force &&
      now - this._lastRefresh < SyncReviewCountService.MIN_REFRESH_INTERVAL
    ) {
      return;
    }
    this._lastRefresh = now;
    this.stopRequests();

    // receive - only users that can decide about received data
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    if (SystemClientApplicationModel.canList(authUser)) {
      this._requests.push(
        this.syncOutbreakAccessDataService
          .getWaitingCount()
          .pipe(
            // the number is only a convenience
            catchError(() => of(undefined))
          )
          .subscribe((count: ISyncOutbreakAccessWaitingCount) => {
            if (count) {
              this.emit(this._count$, count.total || 0);
            }
          })
      );
    } else {
      this.emit(this._count$, 0);
    }

    // send - only users that can see the upstream servers
    if (SystemUpstreamServerModel.canList(authUser)) {
      this._requests.push(
        this.syncOutbreakAccessDataService
          .getUpstreamAccessList()
          .pipe(
            // the number is only a convenience
            catchError(() => of(undefined))
          )
          .subscribe((states: UpstreamOutbreakAccessModel[]) => {
            if (states) {
              this.emit(
                this._sendCount$,
                states.reduce((sum, state) => sum + state.outbreaksWithStatus(SyncOutbreakAccessStatus.PENDING).length, 0)
              );
            }
          })
      );
    } else {
      this.emit(this._sendCount$, 0);
    }
  }

  /**
   * Emit only when the number changes
   */
  private emit(
    subject: BehaviorSubject<number>,
    value: number
  ): void {
    if (subject.value !== value) {
      subject.next(value);
    }
  }

  /**
   * Stop asking the api
   */
  private stopRequests(): void {
    this._requests.forEach((request) => request.unsubscribe());
    this._requests = [];
  }
}
