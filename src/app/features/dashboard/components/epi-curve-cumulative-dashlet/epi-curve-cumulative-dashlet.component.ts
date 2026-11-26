import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import * as _ from 'lodash';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import { MetricCasesCountStratified } from '../../../../core/models/metrics/metric-cases-count-stratified.model';
import { Constants } from '../../../../core/models/constants';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { EpiCurveHelper } from '../../helperClasses/epi-curve-helper';

/**
 * Date used to build the curve
 */
type CumulativeDateBase = 'onset' | 'reporting';

@Component({
  selector: 'app-epi-curve-cumulative-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './epi-curve-cumulative-dashlet.component.html',
  styleUrls: ['./epi-curve-cumulative-dashlet.component.scss']
})
export class EpiCurveCumulativeDashletComponent implements OnInit, OnDestroy {
  // color used when the theme color can't be determined
  private static readonly FALLBACK_PRIMARY_COLOR: string = '#2F7977';

  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // Global filters => Date
  private _globalFilterDate: Moment | string;
  @Input() set globalFilterDate(globalFilterDate: Moment | string) {
    this._globalFilterDate = globalFilterDate;
    this.refreshDataCaller.call();
  }
  get globalFilterDate(): Moment | string {
    return this._globalFilterDate;
  }

  // Global filters => Location
  private _globalFilterLocationId: string;
  @Input() set globalFilterLocationId(globalFilterLocationId: string) {
    this._globalFilterLocationId = globalFilterLocationId;
    this.refreshDataCaller.call();
  }
  get globalFilterLocationId(): string {
    return this._globalFilterLocationId;
  }

  // Global filters => Case classification
  private _globalFilterClassificationId: string[];
  @Input() set globalFilterClassificationId(globalFilterClassificationId: string[]) {
    this._globalFilterClassificationId = globalFilterClassificationId;
    this.refreshDataCaller.call();
  }
  get globalFilterClassificationId(): string[] {
    return this._globalFilterClassificationId;
  }

  // year filter (null / undefined => all years)
  private _filterYear: number;
  @Input() set filterYear(filterYear: number) {
    this._filterYear = filterYear;
    this.refreshDataCaller.call();
  }
  get filterYear(): number {
    return this._filterYear;
  }

  // user can see data by reporting date ?
  @Input() allowReporting: boolean = true;

  // selected grouping / date base
  viewType: string = Constants.EPI_CURVE_VIEW_TYPE.WEEK.value;
  dateBase: CumulativeDateBase = 'onset';

  // options
  viewTypeOptions: ILabelValuePairModel[] = [
    {
      label: 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_WEEK',
      value: Constants.EPI_CURVE_VIEW_TYPE.WEEK.value
    },
    {
      label: 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_MONTH',
      value: Constants.EPI_CURVE_VIEW_TYPE.MONTH.value
    },
    {
      label: 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_DAY',
      value: Constants.EPI_CURVE_VIEW_TYPE.DAY.value
    }
  ];
  dateBaseOptions: ILabelValuePairModel[] = [];

  // chart data
  categories: string[] = [];
  values: number[] = [];
  chartColor: string;

  // summary
  total: number = 0;
  lastPeriodNew: number = 0;
  lastPeriodLabel: string = '';
  growthRate: number = null;

  // loading data
  displayLoading: boolean = true;

  // outbreak
  private _selectedOutbreak: OutbreakModel;

  // subscribers
  private _outbreakSubscriber: Subscription;
  private _dataSubscriber: Subscription;

  // refresh data (debounced)
  refreshDataCaller = new DebounceTimeCaller(() => {
    this.refreshData();
  }, 100);

  /**
   * x axis period token (week / month / day)
   */
  get xAxisPeriodToken(): string {
    return EpiCurveHelper.getAxisPeriodToken(this.viewType);
  }

  /**
   * x axis date base token
   */
  get xAxisBaseToken(): string {
    return this.dateBase === 'reporting' ?
      'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_BASE_REPORTING' :
      'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_BASE_ONSET';
  }

  /**
   * Constructor
   */
  constructor(
    private caseDataService: CaseDataService,
    private outbreakDataService: OutbreakDataService,
    private i18nService: I18nService
  ) {}

  /**
   * Component initialized
   */
  ngOnInit(): void {
    // color
    this.chartColor = this.getPrimaryColor();

    // date base options
    this.dateBaseOptions = [
      {
        label: 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_CUMULATIVE_DATE_BASE_ONSET',
        value: 'onset'
      }
    ];
    if (this.allowReporting) {
      this.dateBaseOptions.push({
        label: 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_CUMULATIVE_DATE_BASE_REPORTING',
        value: 'reporting'
      });
    }

    // outbreak
    this._outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        this._selectedOutbreak = selectedOutbreak;
        this.refreshDataCaller.call();
      });
  }

  /**
   * Component destroyed
   */
  ngOnDestroy(): void {
    if (this._outbreakSubscriber) {
      this._outbreakSubscriber.unsubscribe();
      this._outbreakSubscriber = null;
    }
    this.stopDataSubscriber();
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
   * Retrieve data
   */
  private refreshData(): void {
    // nothing to do
    if (!this._selectedOutbreak?.id) {
      return;
    }

    // release previous request
    this.stopDataSubscriber();

    // date field / week type
    const dateField: string = this.dateBase === 'reporting' ?
      'dateOfReporting' :
      'dateOfOnset';
    const weekType: string = Constants.EPI_CURVE_WEEK_TYPES.EPI.value;

    // filters
    const qb = new RequestQueryBuilder();
    qb.filter.firstLevelConditions();

    // reference date (global filter) or today
    const referenceDate: Moment = this.globalFilterDate ?
      LocalizationHelper.toMoment(this.globalFilterDate).clone().endOf('day') :
      LocalizationHelper.now().endOf('day');

    // year filter ?
    let endDate: Moment = referenceDate;
    if (this.filterYear) {
      const yearInterval = EpiCurveHelper.getYearInterval(
        referenceDate,
        this.filterYear,
        this.viewType,
        weekType
      );
      if (yearInterval.end.isBefore(endDate)) {
        endDate = yearInterval.end;
      }
      qb.filter.where({
        [dateField]: {
          gte: yearInterval.start.toISOString()
        }
      });
    }
    qb.filter.byEquality(
      'endDate',
      endDate.toISOString()
    );

    // location
    if (this.globalFilterLocationId) {
      qb.filter.byEquality(
        'addresses.parentLocationIdFilter',
        this.globalFilterLocationId
      );
    }

    // period type
    qb.filter.byEquality(
      'periodType',
      this.viewType
    );
    if (this.viewType === Constants.EPI_CURVE_VIEW_TYPE.WEEK.value) {
      qb.filter.where({
        weekType
      });
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

    // retrieve data
    this.displayLoading = true;
    this.detectChanges.emit();
    const request$ = this.dateBase === 'reporting' ?
      this.caseDataService.getCasesStratifiedByClassificationOverReportingTime(this._selectedOutbreak.id, qb) :
      this.caseDataService.getCasesStratifiedByClassificationOverTime(this._selectedOutbreak.id, qb);
    this._dataSubscriber = request$
      .subscribe((results: MetricCasesCountStratified[]) => {
        // process
        this.processResults(results);

        // finished
        this.displayLoading = false;
        this.detectChanges.emit();
      });
  }

  /**
   * Build cumulative curve and summary
   */
  private processResults(results: MetricCasesCountStratified[]): void {
    const weekPrefix: string = this.i18nService.instant('LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_WEEK_SHORT_LABEL');
    const categories: string[] = [];
    const values: number[] = [];
    let cumulative: number = 0;
    let lastPeriodNew: number = 0;
    let lastPeriodLabel: string = '';

    // go through periods
    (results || []).forEach((metric) => {
      const label: string = EpiCurveHelper.getPeriodLabel(
        metric.start,
        this.viewType,
        Constants.EPI_CURVE_WEEK_TYPES.EPI.value,
        weekPrefix,
        !this.filterYear
      );
      const periodTotal: number = metric.total || 0;
      cumulative += periodTotal;
      categories.push(label);
      values.push(cumulative);
      lastPeriodNew = periodTotal;
      lastPeriodLabel = label;
    });

    // chart
    this.categories = categories;
    this.values = values;

    // summary
    this.total = cumulative;
    this.lastPeriodNew = lastPeriodNew;
    this.lastPeriodLabel = lastPeriodLabel;
    const previousTotal: number = cumulative - lastPeriodNew;
    this.growthRate = previousTotal > 0 ?
      (lastPeriodNew / previousTotal) * 100 :
      null;
  }

  /**
   * Theme primary color
   */
  private getPrimaryColor(): string {
    const color: string = getComputedStyle(document.body).getPropertyValue('--gd-primary');
    return color && color.trim() ?
      color.trim() :
      EpiCurveCumulativeDashletComponent.FALLBACK_PRIMARY_COLOR;
  }
}