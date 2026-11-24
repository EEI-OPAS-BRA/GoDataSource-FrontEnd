import { Injectable, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { RequestQueryBuilder } from '../../helperClasses/request-query-builder';
import { SyncOutbreakMappingModel } from '../../models/sync-outbreak-mapping.model';
import { SystemClientApplicationModel } from '../../models/system-client-application.model';
import { AuthDataService } from '../data/auth.data.service';
import { SyncOutbreakMappingDataService } from '../data/sync-outbreak-mapping.data.service';

/**
 * Number of outbreaks received from other instances that wait for the user to review where their data goes
 * Shared by the main menu and the tabs of the receive area, so they always display the same number
 */
@Injectable({
  providedIn: 'root'
})
export class SyncReviewCountService implements OnDestroy {
  // don't ask the api again when the user navigates quickly between pages
  private static readonly MIN_REFRESH_INTERVAL: number = 15000;

  // number
  private _count$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private _lastRefresh: number = 0;

  // subscriptions
  private _request: Subscription;
  private _navigation: Subscription;

  /**
   * Constructor
   */
  constructor(
    private router: Router,
    private authDataService: AuthDataService,
    private syncOutbreakMappingDataService: SyncOutbreakMappingDataService
  ) {
    // received data might arrive at any time, so the number is checked again when the user changes page
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
    this.stopRequest();
  }

  /**
   * Number of received outbreaks waiting for review
   */
  get count$(): Observable<number> {
    return this._count$.asObservable();
  }

  /**
   * Ask the api for the number
   * @param force Don't wait for the minimum interval (e.g. a review was just approved)
   */
  refresh(force?: boolean): void {
    // only users that can review received data
    if (!SystemClientApplicationModel.canList(this.authDataService.getAuthenticatedUser())) {
      if (this._count$.value) {
        this._count$.next(0);
      }
      return;
    }

    // asked recently ?
    const now: number = Date.now();
    if (
      !force &&
      now - this._lastRefresh < SyncReviewCountService.MIN_REFRESH_INTERVAL
    ) {
      return;
    }
    this._lastRefresh = now;

    // retrieve
    const qb = new RequestQueryBuilder();
    qb.fields('id');
    qb.filter.where({
      status: {
        neq: 'APPROVED'
      }
    });
    this.stopRequest();
    this._request = this.syncOutbreakMappingDataService
      .getMappingsList(qb)
      .pipe(
        // the number is only a convenience
        catchError(() => of(undefined))
      )
      .subscribe((mappings: SyncOutbreakMappingModel[]) => {
        this._request = undefined;
        if (
          mappings &&
          mappings.length !== this._count$.value
        ) {
          this._count$.next(mappings.length);
        }
      });
  }

  /**
   * Stop asking the api
   */
  private stopRequest(): void {
    if (this._request) {
      this._request.unsubscribe();
      this._request = undefined;
    }
  }
}
