import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import * as _ from 'lodash';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { Constants } from '../../../../core/models/constants';
import { IBasicCount } from '../../../../core/models/basic-count.interface';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { I18nService } from '../../../../core/services/helper/i18n.service';

/**
 * Overview indicators
 */
interface IOutbreakOverview {
  total: number;
  confirmed: number;
  investigation: number;
  newLast7Days: number;
  newLast14Days: number;
  deaths: number;
  confirmedPercentage: string;
  investigationPercentage: string;
  caseFatalityRate: string | null;
}

@Component({
  selector: 'app-outbreak-overview-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './outbreak-overview-dashlet.component.html',
  styleUrls: ['./outbreak-overview-dashlet.component.scss']
})
export class OutbreakOverviewDashletComponent implements OnInit, OnDestroy {
  // year filter value used for "all years"
  static readonly ALL_YEARS: string = 'ALL';

  // number of previous years displayed when the outbreak has no start date
  private static readonly DEFAULT_PREVIOUS_YEARS: number = 5;

  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // data
  overview: IOutbreakOverview = null;
  displayLoading: boolean = false;

  // year filter (year of symptom onset) - starts with the current year
  selectedYear: string = String(LocalizationHelper.now().year());
  yearOptions: ILabelValuePairModel[] = [];

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
  private _outbreakId: string;

  // subscribers
  private _outbreakSubscriber: Subscription;
  private _dataSubscriber: Subscription;

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
    private i18nService: I18nService
  ) {}

  /**
   * Component initialized
   */
  ngOnInit(): void {
    this._outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        if (selectedOutbreak?.id) {
          this._outbreakId = selectedOutbreak.id;
          this.buildYearOptions(selectedOutbreak);
          this.refreshDataCaller.call();
        }
      });
  }

  /**
   * Component destroyed
   */
  ngOnDestroy(): void {
    // outbreak subscriber
    if (this._outbreakSubscriber) {
      this._outbreakSubscriber.unsubscribe();
      this._outbreakSubscriber = null;
    }

    // data
    this.stopDataSubscriber();

    // debounce caller
    if (this.refreshDataCaller) {
      this.refreshDataCaller.unsubscribe();
      this.refreshDataCaller = null;
    }
  }

  /**
   * Year options: all years + from the outbreak start year until the current year (most recent first)
   */
  private buildYearOptions(outbreak: OutbreakModel): void {
    // interval
    const currentYear: number = LocalizationHelper.now().year();
    let firstYear: number = outbreak.startDate ?
      LocalizationHelper.toMoment(outbreak.startDate).year() :
      currentYear - OutbreakOverviewDashletComponent.DEFAULT_PREVIOUS_YEARS;
    firstYear = Math.min(firstYear, currentYear);

    // options
    this.yearOptions = [{
      label: this.i18nService.instant('LNG_PAGE_DASHBOARD_OVERVIEW_ALL_YEARS_LABEL'),
      value: OutbreakOverviewDashletComponent.ALL_YEARS
    }];
    for (let year = currentYear; year >= firstYear; year--) {
      this.yearOptions.push({
        label: String(year),
        value: String(year)
      });
    }
  }

  /**
   * Year changed
   */
  changeYear(): void {
    this.refreshDataCaller.call();
  }

  /**
   * Selected year (null for all years)
   */
  private getSelectedYear(): number | null {
    return !this.selectedYear || this.selectedYear === OutbreakOverviewDashletComponent.ALL_YEARS ?
      null :
      Number(this.selectedYear);
  }

  /**
   * Stop data subscriber
   */
  private stopDataSubscriber(): void {
    if (this._dataSubscriber) {
      this._dataSubscriber.unsubscribe();
      this._dataSubscriber = null;
    }
  }

  /**
   * Query with the global filters (same rules as the case summary dashlet)
   */
  private buildQuery(
    referenceDate: Moment,
    extraConditions: any,
    reportedInLastDays?: number
  ): RequestQueryBuilder {
    const qb = new RequestQueryBuilder();

    // selected year (date of symptom onset)
    const year: number | null = this.getSelectedYear();
    if (year) {
      const yearStart: Moment = LocalizationHelper.now().year(year).startOf('year');
      qb.filter.byDateRange(
        'dateOfOnset', {
          startDate: yearStart.format(),
          endDate: yearStart.clone().endOf('year').format()
        }
      );
    }

    // date of reporting
    qb.filter.byDateRange(
      'dateOfReporting', reportedInLastDays ? {
        startDate: referenceDate.clone().subtract(reportedInLastDays - 1, 'days').startOf('day').format(),
        endDate: referenceDate.clone().endOf('day').format()
      } : {
        endDate: referenceDate.clone().endOf('day').format()
      }
    );

    // location
    if (this.globalFilterLocationId) {
      qb.filter.byEquality(
        'addresses.parentLocationIdFilter',
        this.globalFilterLocationId
      );
    }

    // ignore not a case records
    qb.filter.where({
      classification: {
        neq: Constants.CASE_CLASSIFICATION.NOT_A_CASE
      }
    });

    // classification
    if (!_.isEmpty(this.globalFilterClassificationId)) {
      qb.filter.where({
        and: [{
          classification: {
            inq: this.globalFilterClassificationId
          }
        }]
      });
    }

    // indicator specific conditions
    if (extraConditions) {
      qb.filter.where(extraConditions);
    }

    // finished
    return qb;
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    // outbreak not selected yet ?
    if (!this._outbreakId) {
      return;
    }

    // release previous request
    this.stopDataSubscriber();

    // reference date (global date filter or today)
    // - for a past year the reference is the last day of that year (new cases of that year)
    let referenceDate: Moment = this.globalFilterDate ?
      LocalizationHelper.toMoment(this.globalFilterDate) :
      LocalizationHelper.now();
    const year: number | null = this.getSelectedYear();
    if (
      year &&
      referenceDate.year() > year
    ) {
      referenceDate = LocalizationHelper.now().year(year).endOf('year');
    }

    // confirmed condition
    const confirmedCondition = {
      classification: Constants.CASE_CLASSIFICATION.CONFIRMED
    };

    // retrieve all indicators in parallel
    this.displayLoading = true;
    this.detectChanges.emit();
    this._dataSubscriber = forkJoin({
      total: this.caseDataService.getCasesCount(this._outbreakId, this.buildQuery(referenceDate, null)),
      confirmed: this.caseDataService.getCasesCount(this._outbreakId, this.buildQuery(referenceDate, confirmedCondition)),
      newLast7Days: this.caseDataService.getCasesCount(this._outbreakId, this.buildQuery(referenceDate, null, 7)),
      newLast14Days: this.caseDataService.getCasesCount(this._outbreakId, this.buildQuery(referenceDate, null, 14)),
      deaths: this.caseDataService.getCasesCount(this._outbreakId, this.buildQuery(referenceDate, {
        and: [
          confirmedCondition, {
            outcomeId: Constants.OUTCOME_STATUS.DECEASED
          }
        ]
      }))
    }).subscribe({
      next: (data: {
        total: IBasicCount,
        confirmed: IBasicCount,
        newLast7Days: IBasicCount,
        newLast14Days: IBasicCount,
        deaths: IBasicCount
      }) => {
        // counts
        const total: number = data.total?.count || 0;
        const confirmed: number = data.confirmed?.count || 0;
        const investigation: number = Math.max(total - confirmed, 0);
        const deaths: number = data.deaths?.count || 0;

        // set data
        this._dataSubscriber = null;
        this.overview = {
          total,
          confirmed,
          investigation,
          newLast7Days: data.newLast7Days?.count || 0,
          newLast14Days: data.newLast14Days?.count || 0,
          deaths,
          confirmedPercentage: this.formatPercentage(confirmed, total),
          investigationPercentage: this.formatPercentage(investigation, total),
          caseFatalityRate: confirmed > 0 ?
            this.formatPercentage(deaths, confirmed) :
            null
        };
        this.displayLoading = false;
        this.detectChanges.emit();
      },
      error: () => {
        // finished
        this._dataSubscriber = null;
        this.overview = null;
        this.displayLoading = false;
        this.detectChanges.emit();
      }
    });
  }

  /**
   * Percentage with one decimal
   */
  private formatPercentage(value: number, total: number): string {
    return total > 0 ?
      ((value * 100) / total).toFixed(1) :
      '0.0';
  }
}