import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import * as _ from 'lodash';
import { Subscription, Observable, throwError } from 'rxjs';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { Router } from '@angular/router';
import { Constants } from '../../../../core/models/constants';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { UserModel } from '../../../../core/models/user.model';
import { CaseModel } from '../../../../core/models/case.model';
import { catchError, map } from 'rxjs/operators';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';

/**
 * Bar item (one location)
 */
export interface ICasesByLocationBarItem {
  // location id
  key: string;

  // location name
  label: string;

  // position in ranking (1 = most cases)
  rank: number;

  // number of cases
  value: number;

  // share of total cases (0 - 100)
  percent: number;

  // bar width relative to the location with most cases (0 - 100)
  barWidth: number;
}

@Component({
  selector: 'app-case-by-geographic-location-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './case-by-geographic-location-dashlet.component.html',
  styleUrls: ['./case-by-geographic-location-dashlet.component.scss']
})
export class CasesByGeographicLocationDashletComponent
implements OnInit, OnDestroy {
  // number of locations displayed before "Others"
  static readonly TOP_LIMIT: number = 10;

  // Global filters => Date
  private _globalFilterDate: Moment | string;
  @Input() set globalFilterDate(globalFilterDate: Moment | string) {
    this._globalFilterDate = globalFilterDate;
    this.refreshDataCaller.call();
  }
  get globalFilterDate(): Moment | string {
    return this._globalFilterDate;
  }

  // Global Filters => Location
  private _globalFilterLocationId: string;
  @Input() set globalFilterLocationId(globalFilterLocationId: string) {
    this._globalFilterLocationId = globalFilterLocationId;
    this.refreshDataCaller.call();
  }
  get globalFilterLocationId(): string {
    return this._globalFilterLocationId;
  }

  // Global Filters => Case Classification
  private _globalFilterClassificationId: string[];
  @Input() set globalFilterClassificationId(globalFilterClassificationId: string[]) {
    this._globalFilterClassificationId = globalFilterClassificationId;
    this.refreshDataCaller.call();
  }
  get globalFilterClassificationId(): string[] {
    return this._globalFilterClassificationId;
  }

  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // all locations sorted by number of cases (desc)
  items: ICasesByLocationBarItem[] = [];

  // total number of cases (with a known location)
  total: number = 0;

  // display all locations instead of top + others ?
  showAll: boolean = false;

  // loading data ?
  loadingData: boolean = true;

  // can click on a location to see the cases ?
  canListCases: boolean = false;

  // expanded / collapsed ?
  private _expanded: boolean = false;
  set expanded(expanded: boolean) {
    this._expanded = expanded;

    // retrieve data if expanded and data not retrieved
    this.retrieveData();
  }
  get expanded(): boolean {
    return this._expanded;
  }

  /**
   * Kept for compatibility with dashboard "expand / collapse all" (dashboard.component.ts uses dashlet.expanded)
   */
  get dashlet(): CasesByGeographicLocationDashletComponent {
    return this;
  }

  /**
   * Locations displayed in top mode
   */
  get topItems(): ICasesByLocationBarItem[] {
    return this.items.slice(0, CasesByGeographicLocationDashletComponent.TOP_LIMIT);
  }

  /**
   * Locations aggregated under "Others"
   */
  get othersLocationsCount(): number {
    return Math.max(this.items.length - CasesByGeographicLocationDashletComponent.TOP_LIMIT, 0);
  }

  /**
   * Number of cases aggregated under "Others"
   */
  get othersValue(): number {
    return this.items
      .slice(CasesByGeographicLocationDashletComponent.TOP_LIMIT)
      .reduce((acc, item) => acc + item.value, 0);
  }

  /**
   * Share of "Others" from total (0 - 100)
   */
  get othersPercent(): number {
    return this.total > 0 ?
      this.othersValue * 100 / this.total :
      0;
  }

  // outbreak
  private _outbreakId: string;

  // subscribers
  private _outbreakSubscriber: Subscription;
  private _getDataSubscription: Subscription;

  // data request
  private _getData$: Observable<ICasesByLocationBarItem[]>;
  private _retrievedData: boolean = false;

  // authenticated user
  private _authUser: UserModel;

  /**
   * Global Filters changed
   */
  protected refreshDataCaller = new DebounceTimeCaller(() => {
    this.refreshData();
  }, 100);

  /**
   * Constructor
   */
  constructor(
    private outbreakDataService: OutbreakDataService,
    private caseDataService: CaseDataService,
    private router: Router,
    private authDataService: AuthDataService,
    private toastV2Service: ToastV2Service
  ) {}

  /**
   * Component initialized
   */
  ngOnInit() {
    // get the authenticated user
    this._authUser = this.authDataService.getAuthenticatedUser();
    this.canListCases = CaseModel.canList(this._authUser);

    // outbreak
    this._outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        if (selectedOutbreak) {
          this._outbreakId = selectedOutbreak.id;
          this.refreshDataCaller.call();
        }
      });
  }

  /**
   * Component destroyed
   */
  ngOnDestroy() {
    // outbreak subscriber
    if (this._outbreakSubscriber) {
      this._outbreakSubscriber.unsubscribe();
      this._outbreakSubscriber = null;
    }

    // data request
    if (this._getDataSubscription) {
      this._getDataSubscription.unsubscribe();
      this._getDataSubscription = null;
    }

    // debounce caller
    if (this.refreshDataCaller) {
      this.refreshDataCaller.unsubscribe();
      this.refreshDataCaller = null;
    }
  }

  /**
   * Track by
   */
  trackByKey(_index: number, item: ICasesByLocationBarItem): string {
    return item.key;
  }

  /**
   * Redirect to cases page filtered by the clicked location
   */
  onLocationClick(item: ICasesByLocationBarItem): void {
    // we need case list permission to redirect
    if (!this.canListCases) {
      return;
    }

    // construct redirect global filter
    const global: {
      date?: Moment | string,
      locationId?: string,
      classificationId?: string[]
    } = {};

    // do we have a global date set ?
    if (!_.isEmpty(this.globalFilterDate)) {
      global.date = this.globalFilterDate;
    }

    // do we have a global location Id set ?
    if (!_.isEmpty(this.globalFilterLocationId)) {
      global.locationId = this.globalFilterLocationId;
    }

    // do we have a global classification Ids set ?
    if (!_.isEmpty(this.globalFilterClassificationId)) {
      global.classificationId = this.globalFilterClassificationId;
    }

    // redirect
    this.router.navigate(['cases'],
      {
        queryParams: {
          global: JSON.stringify(global),
          applyListFilter: Constants.APPLY_LIST_FILTER.CASES_BY_LOCATION,
          [Constants.DONT_LOAD_STATIC_FILTERS_KEY]: true,
          locationId: item.key
        }
      });
  }

  /**
   * Refresh Data
   */
  refreshData() {
    if (!this._outbreakId) {
      return;
    }

    // construct query builder
    const qb = new RequestQueryBuilder();

    // date
    if (this.globalFilterDate) {
      qb.filter.byDateRange(
        'dateOfReporting', {
          endDate: LocalizationHelper.toMoment(this.globalFilterDate).endOf('day').format()
        }
      );
    }

    // location
    if (this.globalFilterLocationId) {
      qb.filter.byEquality(
        'addresses.parentLocationIdFilter',
        this.globalFilterLocationId
      );
    }

    // exclude discarded cases
    qb.filter.where({
      classification: {
        neq: Constants.CASE_CLASSIFICATION.NOT_A_CASE
      }
    });

    // classification
    if (!_.isEmpty(this.globalFilterClassificationId)) {
      qb.filter.bySelect(
        'classification',
        this.globalFilterClassificationId,
        false,
        null
      );
    }

    // data request
    this._getData$ = this.caseDataService
      .getCasesPerLocation(this._outbreakId, qb)
      .pipe(map((locationsMetric) => {
        // keep only locations with cases
        const locations = (locationsMetric.locations || [])
          .filter((locationMetric) => locationMetric.casesCount > 0);

        // sort by number of cases (desc), then by name
        locations.sort((a, b) => {
          return b.casesCount - a.casesCount ||
            (a.location.name || '').localeCompare(b.location.name || '');
        });

        // totals
        const total: number = locations.reduce((acc, locationMetric) => acc + locationMetric.casesCount, 0);
        const max: number = locations.length > 0 ?
          locations[0].casesCount :
          0;

        // format data
        return locations.map((locationMetric, index): ICasesByLocationBarItem => ({
          key: locationMetric.location.id,
          label: locationMetric.location.name,
          rank: index + 1,
          value: locationMetric.casesCount,
          percent: total > 0 ?
            locationMetric.casesCount * 100 / total :
            0,
          barWidth: max > 0 ?
            locationMetric.casesCount * 100 / max :
            0
        }));
      }));

    // retrieve again
    this._retrievedData = false;
    this.retrieveData();
  }

  /**
   * Retrieve data (only when expanded and not retrieved yet)
   */
  private retrieveData(): void {
    // nothing to do ?
    if (
      !this.expanded ||
      !this._getData$ ||
      this._retrievedData
    ) {
      return;
    }

    // release previous request if in progress
    if (this._getDataSubscription) {
      this._getDataSubscription.unsubscribe();
      this._getDataSubscription = undefined;
    }

    // retrieve data
    this._retrievedData = true;
    this.loadingData = true;
    this.detectChanges.emit();
    this._getDataSubscription = this._getData$
      .pipe(catchError((err) => {
        // show error
        this.toastV2Service.error(err);

        // stop loading
        this.loadingData = false;
        this.detectChanges.emit();

        // send error down the road
        return throwError(err);
      }))
      .subscribe((items) => {
        // update data
        this.items = items || [];
        this.total = this.items.reduce((acc, item) => acc + item.value, 0);

        // finished
        this.loadingData = false;
        this.detectChanges.emit();
      });
  }
}