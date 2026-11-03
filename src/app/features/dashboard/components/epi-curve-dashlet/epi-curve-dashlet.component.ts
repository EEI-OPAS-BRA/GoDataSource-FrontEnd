import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import { MetricCasesCountStratified } from '../../../../core/models/metrics/metric-cases-count-stratified.model';
import { Constants } from '../../../../core/models/constants';
import { ReferenceDataCategory } from '../../../../core/models/reference-data.model';
import { ReferenceDataDataService } from '../../../../core/services/data/reference-data.data.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import * as _ from 'lodash';
import { Subscription } from 'rxjs';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { ActivatedRoute } from '@angular/router';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { ReferenceDataHelperService } from '../../../../core/services/helper/reference-data-helper.service';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { EpiCurveHelper } from '../../helperClasses/epi-curve-helper';

@Component({
  selector: 'app-epi-curve-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './epi-curve-dashlet.component.html',
  styleUrls: ['./epi-curve-dashlet.component.scss']
})
export class EpiCurveDashletComponent implements OnInit, OnDestroy {
  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  chartData: any = [];
  chartDataCategories: any = [];
  chartDataColumns: any = [];
  viewType = Constants.EPI_CURVE_VIEW_TYPE.WEEK.value;
  // set as default ISO as default option for week type
  epiCurveWeekViewType = Constants.EPI_CURVE_WEEK_TYPES.ISO.value;

  mapCaseClassifications: any = {};
  colorPattern: string[] = [];

  // constants
  Constants = Constants;

  // expanded / collapsed ?
  private _retrievedData: boolean;
  private _expanded: boolean = false;
  set expanded(expanded: boolean) {
    // set data
    this._expanded = expanded;

    // retrieve data if expanded and data not retrieved
    this.refreshData();
  }

  
  get expanded(): boolean {
    return this._expanded;
  }

  // displayed inside another card (e.g. tabs of the "case evolution over time" card) ?
  // - hides the title bar and keeps the chart always expanded
  private _embedded: boolean = false;
  @Input() set embedded(embedded: boolean) {
    this._embedded = embedded;
    if (embedded) {
      // epidemiological week (Sunday to Saturday) by default
      this.epiCurveWeekViewType = Constants.EPI_CURVE_WEEK_TYPES.EPI.value;
      this.expanded = true;
    }
  }
  get embedded(): boolean {
    return this._embedded;
  }
  
  // x axis period token (week / month / day)
  get xAxisPeriodToken(): string {
    return EpiCurveHelper.getAxisPeriodToken(this.viewType);
  }
  
  // year filter (set by the "case evolution over time" card)
  // - null / undefined => all years
  private _filterYear: number;
  @Input() set filterYear(filterYear: number) {
    this._filterYear = filterYear;
    this.refreshDataCaller.call();
  }
  get filterYear(): number {
    return this._filterYear;
  }

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

  // outbreak
  private _selectedOutbreak: OutbreakModel;

  // subscribers
  outbreakSubscriber: Subscription;
  previousSubscriber: Subscription;
  refdataSubscriber: Subscription;

  // loading data
  displayLoading: boolean = true;

  // options
  epiCurveWeekTypesOptions: ILabelValuePairModel[];

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
    private caseDataService: CaseDataService,
    private outbreakDataService: OutbreakDataService,
    private referenceDataDataService: ReferenceDataDataService,
    private i18nService: I18nService,
    private referenceDataHelperService: ReferenceDataHelperService,
    activatedRoute: ActivatedRoute
  ) {
    this.epiCurveWeekTypesOptions = (activatedRoute.snapshot.data.epiCurveWeekTypes as IResolverV2ResponseModel<ILabelValuePairModel>).options;
  }

  /**
     * Component initialized
     */
  ngOnInit() {
    // outbreak
    this.displayLoading = true;
    this.outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        // stop ref data
        this.stopRefDataSubscriber();

        // nothing to do
        if (!selectedOutbreak?.id) {
          return;
        }

        // set outbreak
        this._selectedOutbreak = selectedOutbreak;

        // retrieve ref data
        this.displayLoading = true;
        this.refdataSubscriber = this.referenceDataDataService
          .getReferenceDataByCategory(ReferenceDataCategory.LNG_REFERENCE_DATA_CATEGORY_CASE_CLASSIFICATION)
          .subscribe((caseClassification) => {
            // reset
            this.refdataSubscriber = null;

            // determine outbreak specific entries
            const entries = this.referenceDataHelperService.filterPerOutbreak(
              this._selectedOutbreak,
              caseClassification.entries
            );

            // map classifications to translation and color
            this.mapCaseClassifications = {};
            _.forEach(entries, (caseClassificationItem) => {
              this.mapCaseClassifications[caseClassificationItem.value] = {};
              this.mapCaseClassifications[caseClassificationItem.value].valueTranslated = this.i18nService.instant(caseClassificationItem.value);
              this.mapCaseClassifications[caseClassificationItem.value].colorCode = caseClassificationItem.colorCode;
            });

            // refresh data
            this.refreshDataCaller.call();
          });
      });
  }

  /**
     * Component destroyed
     */
  ngOnDestroy() {
    // outbreak subscriber
    if (this.outbreakSubscriber) {
      this.outbreakSubscriber.unsubscribe();
      this.outbreakSubscriber = null;
    }

    // release previous subscriber
    if (this.previousSubscriber) {
      this.previousSubscriber.unsubscribe();
      this.previousSubscriber = null;
    }

    // stop ref data
    this.stopRefDataSubscriber();

    // debounce caller
    if (this.refreshDataCaller) {
      this.refreshDataCaller.unsubscribe();
      this.refreshDataCaller = null;
    }
  }

  /**
   * Stop ref data subscriber
   */
  private stopRefDataSubscriber(): void {
    // ref data
    if (this.refdataSubscriber) {
      this.refdataSubscriber.unsubscribe();
      this.refdataSubscriber = null;
    }
  }

  /**
     * set the data needed for the chart
     */
  setEpiCurveResults(metricData: MetricCasesCountStratified[]) {
    // initialize data
    this.colorPattern = [];
    this.chartDataCategories = [];
    this.chartDataColumns = [];
    const chartData = {};

    // build chart data
    _.forEach(metricData, (metric: MetricCasesCountStratified) => {
      // create the array with categories ( dates displayed on x axis )
      this.chartDataCategories.push(
        EpiCurveHelper.getPeriodLabel(
          metric.start,
          this.viewType,
          this.epiCurveWeekViewType,
          this.i18nService.instant('LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_WEEK_SHORT_LABEL'),
          !this.filterYear
        )
      );

      // create an array with data for each classification
      _.each(metric.classification, (data, key) => {
        if (this.embedded || key !== Constants.CASE_CLASSIFICATION.NOT_A_CASE) {
          if (this.mapCaseClassifications[key]) {
            const translatedKey = this.mapCaseClassifications[key].valueTranslated;
            if (chartData[translatedKey]) {
              chartData[translatedKey].push(data);
            } else {
              // the first element from the array needs to be the classification
              this.chartDataColumns.push(translatedKey);

              // also push the color corresponding the classification
              this.colorPattern.push(this.mapCaseClassifications[key].colorCode);

              // push first value
              chartData[translatedKey] = [];
              chartData[translatedKey].push(translatedKey);
              chartData[translatedKey].push(data);
            }
          }
        }
      });
    });

    // finished
    return chartData;
  }

  /**
     * trigger change view: days, months, weeks
     * @param viewType
     */
  changeView(viewType) {
    this.viewType = viewType;

    // reset week type if epi view is not weekly anymore
    if (viewType !== Constants.EPI_CURVE_VIEW_TYPE.WEEK.value) {
      this.epiCurveWeekViewType = undefined;
    } else {
      this.epiCurveWeekViewType = this.embedded ?
        Constants.EPI_CURVE_WEEK_TYPES.EPI.value :
        Constants.EPI_CURVE_WEEK_TYPES.ISO.value;
    }

    // re-render chart
    this.refreshDataCaller.call();
  }

  /**
     * Refresh the list after the week type has changed
     */
  changeWeekView() {
    this.refreshDataCaller.call();
  }

  /**
     * Refresh Data
     */
  refreshData() {
    // not expanded ?
    if (
      !this.expanded ||
      this._retrievedData
    ) {
      return;
    }

    if (
      this._selectedOutbreak?.id &&
      !_.isEmpty(this.mapCaseClassifications)
    ) {
      // release previous subscriber
      if (this.previousSubscriber) {
        this.previousSubscriber.unsubscribe();
        this.previousSubscriber = null;
      }

      // add global filters
      const qb = new RequestQueryBuilder();

      // change the way we build query
      qb.filter.firstLevelConditions();

      // date
      // - reference date (global filter) or today
      const referenceDate: Moment = this.globalFilterDate ?
        LocalizationHelper.toMoment(this.globalFilterDate).clone().endOf('day') :
        LocalizationHelper.now().endOf('day');

      // year filter ?
      // - only cases from the selected year (weeks / months / days of that year)
      // - past years end on December 31
      let endDate: Moment = referenceDate;
      if (this.filterYear) {
        const yearInterval = EpiCurveHelper.getYearInterval(
          referenceDate,
          this.filterYear,
          this.viewType,
          this.epiCurveWeekViewType
        );
        if (yearInterval.end.isBefore(endDate)) {
          endDate = yearInterval.end;
        }
        qb.filter.where({
          dateOfOnset: {
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

      // week type
      qb.filter.byEquality(
        'periodType',
        this.viewType
      );

      if (this.epiCurveWeekViewType) {
        qb.filter.where({
          'weekType': this.epiCurveWeekViewType
        });
      }

      // exclude discarded cases
      // - except inside the "case evolution over time" card, where all classifications are displayed (including discarded)
      if (!this.embedded) {
        qb.filter.where({
          classification: {
            neq: Constants.CASE_CLASSIFICATION.NOT_A_CASE
          }
        });
      }

      // classification
      if (!_.isEmpty(this.globalFilterClassificationId)) {
        qb.filter.bySelect(
          'classification',
          this.globalFilterClassificationId,
          false,
          null
        );
      }

      // get data
      this._retrievedData = true;
      this.displayLoading = true;
      this.detectChanges.emit();
      this.previousSubscriber = this.caseDataService
        .getCasesStratifiedByClassificationOverTime(this._selectedOutbreak.id, qb)
        .subscribe((results) => {
          // convert data to chart data format
          this.chartData = [];
          const chartDataObject = this.setEpiCurveResults(results);
          _.each(chartDataObject, (data) => {
            this.chartData.push(data);
          });

          // finished
          this.displayLoading = false;
          this.detectChanges.emit();
        });
    }
  }
}
