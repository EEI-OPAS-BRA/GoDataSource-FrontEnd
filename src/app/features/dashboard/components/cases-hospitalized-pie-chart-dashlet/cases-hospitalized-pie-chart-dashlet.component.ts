import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import { Subscription } from 'rxjs';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { Constants } from '../../../../core/models/constants';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { UserModel } from '../../../../core/models/user.model';
import { CaseModel } from '../../../../core/models/case.model';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { ReferenceDataCategory, ReferenceDataEntryModel } from '../../../../core/models/reference-data.model';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';

/**
 * Hospitalization row (one per person date type: hospitalization, isolation...)
 */
interface ICasesHospitalizedRow {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-cases-hospitalized-pie-chart-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './cases-hospitalized-pie-chart-dashlet.component.html',
  styleUrls: ['./cases-hospitalized-pie-chart-dashlet.component.scss']
})
export class CasesHospitalizedPieChartDashletComponent
implements OnInit, OnDestroy {
  // color used when the reference data item has no color
  private static readonly FALLBACK_PRIMARY_COLOR: string = '#2F7977';

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

  // expanded / collapsed ?
  private _expanded: boolean = false;
  set expanded(expanded: boolean) {
    this._expanded = expanded;
    this.refreshData();
  }
  get expanded(): boolean {
    return this._expanded;
  }

  // kept for compatibility with the dashboard page ("expand all" uses dashlet.expanded)
  get dashlet(): CasesHospitalizedPieChartDashletComponent {
    return this;
  }

  // data
  rows: ICasesHospitalizedRow[] = [];
  total: number = 0;
  displayLoading: boolean = true;
  private _retrievedData: boolean = false;

  // outbreak
  private _selectedOutbreak: OutbreakModel;

  // subscribers
  private _outbreakSubscriber: Subscription;
  private _dataSubscriber: Subscription;

  // authenticated user
  private _authUser: UserModel;

  /**
   * Global Filters changed
   */
  protected refreshDataCaller = new DebounceTimeCaller(() => {
    this._retrievedData = false;
    this.refreshData();
  }, 100);

  /**
   * Constructor
   */
  constructor(
    private outbreakDataService: OutbreakDataService,
    private caseDataService: CaseDataService,
    protected toastV2Service: ToastV2Service,
    private router: Router,
    private authDataService: AuthDataService,
    private activatedRoute: ActivatedRoute
  ) {}

  /**
   * Component initialized
   */
  ngOnInit() {
    // get the authenticated user
    this._authUser = this.authDataService.getAuthenticatedUser();

    // outbreak
    this._outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        if (selectedOutbreak) {
          this._selectedOutbreak = selectedOutbreak;
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

    // data subscriber
    this.stopDataSubscriber();

    // debounce caller
    if (this.refreshDataCaller) {
      this.refreshDataCaller.unsubscribe();
      this.refreshDataCaller = null;
    }
  }

  /**
   * Stop data request
   */
  private stopDataSubscriber(): void {
    if (this._dataSubscriber) {
      this._dataSubscriber.unsubscribe();
      this._dataSubscriber = null;
    }
  }

  /**
   * Redirect to cases page when user clicks on a row to display the cases that represent that row
   */
  onRowPress(row: ICasesHospitalizedRow) {
    // we need case list permission to redirect
    if (!CaseModel.canList(this._authUser)) {
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
          applyListFilter: Constants.APPLY_LIST_FILTER.CASES_DATE_RANGE_SUMMARY,
          x: row.key,
          [Constants.DONT_LOAD_STATIC_FILTERS_KEY]: true
        }
      });
  }

  /**
   * Refresh Data
   */
  refreshData() {
    // not expanded / already retrieved / no outbreak ?
    if (
      !this.expanded ||
      this._retrievedData ||
      !this._selectedOutbreak?.id
    ) {
      return;
    }

    // release previous request
    this.stopDataSubscriber();

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

    // determine hospitalized & isolated for a specific date
    qb.flag(
      'date',
      this.globalFilterDate
    );

    // retrieve data
    this._retrievedData = true;
    this.displayLoading = true;
    this.detectChanges.emit();
    this._dataSubscriber = this.caseDataService
      .getCasesHospitalized(
        this._selectedOutbreak.id,
        qb
      )
      .subscribe({
        next: (response: any) => {
          this.processResponse(response || {});
          this.displayLoading = false;
          this.detectChanges.emit();
        },
        error: (err) => {
          this.toastV2Service.error(err);
          this.rows = [];
          this.total = 0;
          this.displayLoading = false;
          this.detectChanges.emit();
        }
      });
  }

  /**
   * Build rows
   * - one row per person date type (hospitalization, isolation...) allowed for this outbreak
   * - percentage over the total number of cases (a case may appear in more than one row)
   */
  private processResponse(response: { [key: string]: number }): void {
    // total
    this.total = response.total || 0;

    // determine visible date types
    const allowedItems = this._selectedOutbreak.allowedRefDataItems ?
      this._selectedOutbreak.allowedRefDataItems[ReferenceDataCategory.LNG_REFERENCE_DATA_CATEGORY_PERSON_DATE_TYPE] :
      undefined;
    const allVisible: boolean = !allowedItems ||
      Object.keys(allowedItems).length < 1;

    // date type colors
    const dateRangeTypes = this.activatedRoute.snapshot.data.dateRangeType as IResolverV2ResponseModel<ReferenceDataEntryModel>;

    // rows
    this.rows = Object.keys(response)
      .filter((key) => key !== 'total' && (
        allVisible ||
        allowedItems[key]
      ))
      .map((key) => {
        const value: number = response[key] || 0;
        return {
          key,
          label: key,
          value,
          percentage: this.total > 0 ?
            (value / this.total) * 100 :
            0,
          color: dateRangeTypes?.map[key]?.getColorCode() || this.getPrimaryColor()
        };
      })
      .sort((row1, row2) => row2.value - row1.value);
  }

  /**
   * Theme primary color
   */
  private getPrimaryColor(): string {
    const color: string = getComputedStyle(document.body).getPropertyValue('--gd-primary');
    return color && color.trim() ?
      color.trim() :
      CasesHospitalizedPieChartDashletComponent.FALLBACK_PRIMARY_COLOR;
  }
}