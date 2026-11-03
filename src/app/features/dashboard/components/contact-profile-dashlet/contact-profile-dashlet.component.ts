import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { ContactDataService } from '../../../../core/services/data/contact.data.service';
import { ReferenceDataDataService } from '../../../../core/services/data/reference-data.data.service';
import { ReferenceDataHelperService } from '../../../../core/services/helper/reference-data-helper.service';
import { ReferenceDataCategory, ReferenceDataCategoryModel, ReferenceDataEntryModel } from '../../../../core/models/reference-data.model';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { Constants } from '../../../../core/models/constants';
import { IContactsDemographicsCount } from '../../../../core/models/contacts-demographics-count.interface';
import { IBbDonutChartItem } from '../bb-donut-chart/bb-donut-chart.component';
import { IBbBarChartSeries } from '../bb-bar-chart/bb-bar-chart.component';
import { IBoxplotChartBox, IBoxplotChartLabels } from '../boxplot-chart/boxplot-chart.component';

/**
 * Sex tab - row
 */
interface IContactProfileSexRow {
  key: string;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

/**
 * Age tab - descriptive statistics
 */
interface IContactProfileAgeStats {
  n: number;
  mean: number;
  ciLow: number | null;
  ciHigh: number | null;
  q1: number;
  median: number;
  q3: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: {
    value: number,
    count: number
  }[];
}

@Component({
  selector: 'app-contact-profile-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './contact-profile-dashlet.component.html',
  styleUrls: ['./contact-profile-dashlet.component.scss']
})
export class ContactProfileDashletComponent implements OnInit, OnDestroy {
  // key used for records without sex
  private static readonly NOT_INFORMED_KEY: string = 'NOT_INFORMED';

  // Go.Data default sex reference data values (used by the age pyramid - left / right side)
  private static readonly GENDER_MALE: string = 'LNG_REFERENCE_DATA_CATEGORY_GENDER_MALE';
  private static readonly GENDER_FEMALE: string = 'LNG_REFERENCE_DATA_CATEGORY_GENDER_FEMALE';

  // default colors - used only when the reference data item has no color configured
  private static readonly DEFAULT_GENDER_COLORS: { [value: string]: string } = {
    LNG_REFERENCE_DATA_CATEGORY_GENDER_MALE: '#1976D2',
    LNG_REFERENCE_DATA_CATEGORY_GENDER_FEMALE: '#D32F2F'
  };
  private static readonly NOT_INFORMED_COLOR: string = '#FBC02D';
  private static readonly OTHER_COLORS: string[] = ['#7B1FA2', '#388E3C', '#F57C00', '#5D4037', '#0097A7'];

  // fallback color for single series charts (used if the theme color can't be determined)
  private static readonly FALLBACK_PRIMARY_COLOR: string = '#2F7977';

  // standard age groups (years) - max null means "and over"
  private static readonly AGE_GROUPS: {
    label: string,
    min: number,
    max: number | null
  }[] = [
    { label: '0-4', min: 0, max: 4 },
    { label: '5-9', min: 5, max: 9 },
    { label: '10-19', min: 10, max: 19 },
    { label: '20-29', min: 20, max: 29 },
    { label: '30-39', min: 30, max: 39 },
    { label: '40-49', min: 40, max: 49 },
    { label: '50-59', min: 50, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70+', min: 70, max: null }
  ];

  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // selected tab
  selectedTabIndex: number = 0;

  // loading data
  displayLoading: boolean = false;

  // number of contacts matching the filters
  total: number = 0;

  // sex tab
  sexRows: IContactProfileSexRow[] = [];
  sexChartItems: IBbDonutChartItem[] = [];
  sexChartCenterTitle: string = '';

  // age group tab
  ageGroupCategories: string[] = [];
  ageGroupSeries: IBbBarChartSeries[] = [];
  ageGroupHasData: boolean = false;
  unknownAgeCount: number = 0;
  unknownAgePercentage: string = '0.0';
  ageGroupValueFormatter = (value: number): string => `${value} (${this.formatPercentage(value)}%)`;

  // age pyramid tab
  pyramidCategories: string[] = [];
  pyramidSeries: IBbBarChartSeries[] = [];
  pyramidAvailable: boolean = false;
  pyramidHasData: boolean = false;
  pyramidExcludedCount: number = 0;
  pyramidExcludedPercentage: string = '0.0';

  // age tab
  ageStats: IContactProfileAgeStats = null;
  ageValidPercentage: string = '0.0';
  ageBoxes: IBoxplotChartBox[] = [];
  ageBoxLabels: IBoxplotChartLabels;
  ageBoxColor: string = ContactProfileDashletComponent.FALLBACK_PRIMARY_COLOR;
  ageWithoutReportingDateCount: number = 0;

  // expanded / collapsed ?
  private _retrievedData: boolean = false;
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
  // - not applicable to contacts (contacts don't have a classification)

  // outbreak
  private _selectedOutbreak: OutbreakModel;

  // sex options available for the selected outbreak (reference data, in configured order)
  private _genderOptionsLoaded: boolean = false;
  private _genderOptions: {
    key: string,
    label: string,
    color: string
  }[] = [];

  // subscribers
  private _outbreakSubscriber: Subscription;
  private _refDataSubscriber: Subscription;
  private _dataSubscriber: Subscription;

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
    private contactDataService: ContactDataService,
    private referenceDataDataService: ReferenceDataDataService,
    private referenceDataHelperService: ReferenceDataHelperService,
    private i18nService: I18nService
  ) {}

  /**
   * Component initialized
   */
  ngOnInit(): void {
    // outbreak
    this._outbreakSubscriber = this.outbreakDataService
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
        this._genderOptionsLoaded = false;

        // retrieve sex options available for this outbreak
        this._refDataSubscriber = this.referenceDataDataService
          .getReferenceDataByCategory(ReferenceDataCategory.LNG_REFERENCE_DATA_CATEGORY_GENDER)
          .subscribe((category: ReferenceDataCategoryModel) => {
            // reset
            this._refDataSubscriber = null;

            // determine outbreak specific entries
            const entries: ReferenceDataEntryModel[] = this.referenceDataHelperService.filterPerOutbreak(
              this._selectedOutbreak,
              category?.entries || []
            );

            // map options
            let otherColorIndex: number = 0;
            this._genderOptions = entries.map((entry) => {
              // color configured in reference data or default one
              let color: string = entry.colorCode || ContactProfileDashletComponent.DEFAULT_GENDER_COLORS[entry.value];
              if (!color) {
                color = ContactProfileDashletComponent.OTHER_COLORS[otherColorIndex % ContactProfileDashletComponent.OTHER_COLORS.length];
                otherColorIndex++;
              }

              // finished
              return {
                key: entry.value,
                label: this.i18nService.instant(entry.value),
                color
              };
            });
            this._genderOptionsLoaded = true;

            // refresh data
            this.refreshDataCaller.call();
          });
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

    // ref data
    this.stopRefDataSubscriber();

    // data
    this.stopDataSubscriber();

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
    if (this._refDataSubscriber) {
      this._refDataSubscriber.unsubscribe();
      this._refDataSubscriber = null;
    }
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
   * Refresh data
   */
  refreshData(): void {
    // not expanded, already retrieved or not ready ?
    if (
      !this.expanded ||
      this._retrievedData ||
      !this._selectedOutbreak?.id ||
      !this._genderOptionsLoaded
    ) {
      return;
    }

    // release previous request
    this.stopDataSubscriber();

    // global filters (date & location) - classification doesn't apply to contacts
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

    // retrieve data
    this._retrievedData = true;
    this.displayLoading = true;
    this.detectChanges.emit();
    this._dataSubscriber = this.contactDataService
      .getContactsDemographics(
        this._selectedOutbreak.id,
        qb
      )
      .subscribe({
        next: (data: IContactsDemographicsCount) => {
          // finished
          this._dataSubscriber = null;
          this.processData(data);
          this.displayLoading = false;
          this.detectChanges.emit();
        },
        error: () => {
          // finished
          this._dataSubscriber = null;
          this.processData(null);
          this.displayLoading = false;
          this.detectChanges.emit();
        }
      });
  }

  /**
   * Process data for all tabs
   */
  private processData(data: IContactsDemographicsCount): void {
    // total
    this.total = data?.total || 0;

    // sex tab
    this.processSexData(data);

    // age group tab
    this.processAgeGroupData(data);

    // age pyramid tab
    this.processPyramidData(data);

    // age tab
    this.processAgeData(data);
  }

  /**
   * Sex tab - n and % per sex category available in the outbreak
   */
  private processSexData(data: IContactsDemographicsCount): void {
    // count per sex
    const counts: { [key: string]: number } = {};
    let notInformed: number = 0;
    (data?.groups || []).forEach((group) => {
      if (group.gender) {
        counts[group.gender] = (counts[group.gender] || 0) + group.count;
      } else {
        notInformed += group.count;
      }
    });

    // categories available in the outbreak, in configured order (also the ones without contacts)
    const rows: IContactProfileSexRow[] = [];
    this._genderOptions.forEach((option) => {
      rows.push(this.buildSexRow(
        option.key,
        option.label,
        option.color,
        counts[option.key] || 0
      ));
      delete counts[option.key];
    });

    // values found in records that aren't available anymore in the outbreak reference data
    Object.keys(counts).forEach((key) => {
      rows.push(this.buildSexRow(
        key,
        this.i18nService.instant(key),
        ContactProfileDashletComponent.DEFAULT_GENDER_COLORS[key] || Constants.DEFAULT_COLOR_REF_DATA,
        counts[key]
      ));
    });

    // not informed
    if (notInformed > 0) {
      rows.push(this.buildSexRow(
        ContactProfileDashletComponent.NOT_INFORMED_KEY,
        this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_NOT_INFORMED_LABEL'),
        ContactProfileDashletComponent.NOT_INFORMED_COLOR,
        notInformed
      ));
    }

    // set data
    this.sexRows = rows;
    this.sexChartItems = rows
      .filter((row) => row.count > 0)
      .map((row) => ({
        key: row.key,
        label: row.label,
        value: row.count,
        color: row.color
      }));
    this.sexChartCenterTitle = `${this.total}\n${this.i18nService.instant('LNG_PAGE_DASHBOARD_CONTACT_PROFILE_CONTACTS_LABEL')}`;
  }

  /**
   * Age group tab - n and % per standard age group
   */
  private processAgeGroupData(data: IContactsDemographicsCount): void {
    // count per age group
    const counts: number[] = ContactProfileDashletComponent.AGE_GROUPS.map(() => 0);
    let unknownAge: number = 0;
    (data?.groups || []).forEach((group) => {
      // age not informed
      if (
        group.age === null ||
        group.age === undefined
      ) {
        unknownAge += group.count;
        return;
      }

      // determine age group
      const index: number = this.getAgeGroupIndex(group.age);
      if (index > -1) {
        counts[index] += group.count;
      } else {
        unknownAge += group.count;
      }
    });

    // set data
    this.ageGroupCategories = ContactProfileDashletComponent.AGE_GROUPS.map((ageGroup) => ageGroup.label);
    this.ageGroupSeries = [{
      key: 'contacts',
      label: this.i18nService.instant('LNG_PAGE_DASHBOARD_CONTACT_PROFILE_CONTACTS_AXIS_LABEL'),
      values: counts,
      color: this.getPrimaryColor()
    }];
    this.ageGroupHasData = counts.some((count) => count > 0);
    this.unknownAgeCount = unknownAge;
    this.unknownAgePercentage = this.formatPercentage(unknownAge);
  }

  /**
   * Age pyramid tab - contacts per age group, male on the left and female on the right
   */
  private processPyramidData(data: IContactsDemographicsCount): void {
    // the pyramid requires both male and female categories in the outbreak
    const maleOption = this._genderOptions.find((option) => option.key === ContactProfileDashletComponent.GENDER_MALE);
    const femaleOption = this._genderOptions.find((option) => option.key === ContactProfileDashletComponent.GENDER_FEMALE);
    this.pyramidAvailable = !!maleOption && !!femaleOption;

    // count per sex and age group
    const male: number[] = ContactProfileDashletComponent.AGE_GROUPS.map(() => 0);
    const female: number[] = ContactProfileDashletComponent.AGE_GROUPS.map(() => 0);
    let excluded: number = 0;
    (data?.groups || []).forEach((group) => {
      // age group
      const index: number = group.age === null || group.age === undefined ?
        -1 :
        this.getAgeGroupIndex(group.age);

      // count
      if (
        index > -1 &&
        group.gender === ContactProfileDashletComponent.GENDER_MALE
      ) {
        male[index] += group.count;
      } else if (
        index > -1 &&
        group.gender === ContactProfileDashletComponent.GENDER_FEMALE
      ) {
        female[index] += group.count;
      } else {
        // without age, without sex or other sex category
        excluded += group.count;
      }
    });

    // youngest age group at the bottom
    this.pyramidCategories = ContactProfileDashletComponent.AGE_GROUPS
      .map((ageGroup) => ageGroup.label)
      .reverse();
    this.pyramidSeries = [{
      key: ContactProfileDashletComponent.GENDER_MALE,
      label: maleOption ?
        maleOption.label :
        this.i18nService.instant(ContactProfileDashletComponent.GENDER_MALE),
      // negative values are displayed on the left side
      values: [...male]
        .reverse()
        .map((count) => count ? -count : 0),
      color: maleOption ?
        maleOption.color :
        ContactProfileDashletComponent.DEFAULT_GENDER_COLORS[ContactProfileDashletComponent.GENDER_MALE]
    }, {
      key: ContactProfileDashletComponent.GENDER_FEMALE,
      label: femaleOption ?
        femaleOption.label :
        this.i18nService.instant(ContactProfileDashletComponent.GENDER_FEMALE),
      values: [...female].reverse(),
      color: femaleOption ?
        femaleOption.color :
        ContactProfileDashletComponent.DEFAULT_GENDER_COLORS[ContactProfileDashletComponent.GENDER_FEMALE]
    }];
    this.pyramidHasData = male.some((count) => count > 0) || female.some((count) => count > 0);
    this.pyramidExcludedCount = excluded;
    this.pyramidExcludedPercentage = this.formatPercentage(excluded);
  }

  /**
   * Age tab - descriptive statistics (all contacts with valid age) and one boxplot per year of reporting
   */
  private processAgeData(data: IContactsDemographicsCount): void {
    // count per age (all) and per year of reporting and age
    const all: { [age: number]: number } = {};
    const perYear: { [year: number]: { [age: number]: number } } = {};
    let withoutReportingDate: number = 0;
    (data?.groups || []).forEach((group) => {
      // ignore records without valid age
      if (
        group.age === null ||
        group.age === undefined
      ) {
        return;
      }

      // all
      all[group.age] = (all[group.age] || 0) + group.count;

      // per year
      if (
        group.year === null ||
        group.year === undefined
      ) {
        withoutReportingDate += group.count;
        return;
      }
      perYear[group.year] = perYear[group.year] || {};
      perYear[group.year][group.age] = (perYear[group.year][group.age] || 0) + group.count;
    });

    // descriptive statistics
    this.ageStats = this.computeAgeStats(all);
    this.ageValidPercentage = this.formatPercentage(this.ageStats ? this.ageStats.n : 0);
    this.ageWithoutReportingDateCount = withoutReportingDate;

    // one box per year, in chronological order
    this.ageBoxes = [];
    Object.keys(perYear)
      .map((year) => Number(year))
      .sort((year1, year2) => year1 - year2)
      .forEach((year) => {
        const stats: IContactProfileAgeStats = this.computeAgeStats(perYear[year]);
        if (!stats) {
          return;
        }
        this.ageBoxes.push({
          key: String(year),
          label: String(year),
          subLabel: `n = ${stats.n}`,
          whiskerLow: stats.whiskerLow,
          q1: stats.q1,
          median: stats.median,
          q3: stats.q3,
          whiskerHigh: stats.whiskerHigh,
          mean: stats.mean,
          ciLow: stats.ciLow,
          ciHigh: stats.ciHigh,
          outliers: stats.outliers
        });
      });

    // chart settings (neutral labels shared with the case profile dashlet)
    this.ageBoxColor = this.getPrimaryColor();
    this.ageBoxLabels = {
      q1: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_BOX_Q1_LABEL'),
      median: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_BOX_MEDIAN_LABEL'),
      q3: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_BOX_Q3_LABEL'),
      whiskerLow: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_BOX_MIN_LABEL'),
      whiskerHigh: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_BOX_MAX_LABEL'),
      mean: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_STAT_MEAN_LABEL'),
      ci: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_STAT_CI_LABEL'),
      outlier: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_BOX_OUTLIERS_LABEL'),
      unit: this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_YEARS_UNIT_LABEL')
    };
  }

  /**
   * Descriptive statistics from a frequency table (age => number of contacts)
   * - quartiles: linear interpolation (same method as Excel QUARTIL.INC / R type 7)
   * - outliers: Tukey's rule (values outside Q1 - 1.5 x IQR and Q3 + 1.5 x IQR)
   * - 95% CI of the mean: mean +/- 1.96 x standard deviation / square root of n
   * - same calculation as the case profile dashlet
   */
  private computeAgeStats(frequencies: { [age: number]: number }): IContactProfileAgeStats {
    // sort values
    const values: { age: number, count: number }[] = Object.keys(frequencies)
      .map((age) => ({
        age: Number(age),
        count: frequencies[age]
      }))
      .filter((item) => item.count > 0)
      .sort((item1, item2) => item1.age - item2.age);

    // number of records
    const n: number = values.reduce((sum, item) => sum + item.count, 0);
    if (n < 1) {
      return null;
    }

    // value at a position (0 based) of the sorted list
    const valueAt = (position: number): number => {
      let cumulative: number = 0;
      for (const item of values) {
        cumulative += item.count;
        if (position < cumulative) {
          return item.age;
        }
      }
      return values[values.length - 1].age;
    };

    // quantile
    const quantile = (probability: number): number => {
      const position: number = (n - 1) * probability;
      const lower: number = Math.floor(position);
      const upper: number = Math.ceil(position);
      const lowerValue: number = valueAt(lower);
      const upperValue: number = valueAt(upper);
      return lowerValue + (position - lower) * (upperValue - lowerValue);
    };

    // mean & standard deviation
    const mean: number = values.reduce((sum, item) => sum + item.age * item.count, 0) / n;
    const variance: number = n > 1 ?
      values.reduce((sum, item) => sum + item.count * Math.pow(item.age - mean, 2), 0) / (n - 1) :
      0;
    const ciMargin: number = n > 1 ?
      1.96 * Math.sqrt(variance) / Math.sqrt(n) :
      null;

    // quartiles
    const q1: number = quantile(0.25);
    const median: number = quantile(0.5);
    const q3: number = quantile(0.75);

    // Tukey fences
    const iqr: number = q3 - q1;
    const lowerFence: number = q1 - 1.5 * iqr;
    const upperFence: number = q3 + 1.5 * iqr;
    const inside = values.filter((item) => item.age >= lowerFence && item.age <= upperFence);

    // finished
    return {
      n,
      mean,
      ciLow: ciMargin === null ? null : mean - ciMargin,
      ciHigh: ciMargin === null ? null : mean + ciMargin,
      q1,
      median,
      q3,
      whiskerLow: inside.length ? inside[0].age : q1,
      whiskerHigh: inside.length ? inside[inside.length - 1].age : q3,
      outliers: values
        .filter((item) => item.age < lowerFence || item.age > upperFence)
        .map((item) => ({
          value: item.age,
          count: item.count
        }))
    };
  }

  /**
   * Determine the standard age group of an age (-1 if not found)
   */
  private getAgeGroupIndex(age: number): number {
    return ContactProfileDashletComponent.AGE_GROUPS.findIndex((ageGroup) =>
      age >= ageGroup.min && (
        ageGroup.max === null ||
        age <= ageGroup.max
      )
    );
  }

  /**
   * Percentage over the total number of contacts, with one decimal
   */
  private formatPercentage(count: number): string {
    return this.total > 0 ?
      ((count * 100) / this.total).toFixed(1) :
      '0.0';
  }

  /**
   * Theme primary color (same color used by the dashlet titles)
   */
  private getPrimaryColor(): string {
    const color: string = getComputedStyle(document.body).getPropertyValue('--gd-primary').trim();
    return color || ContactProfileDashletComponent.FALLBACK_PRIMARY_COLOR;
  }

  /**
   * Build sex row
   */
  private buildSexRow(
    key: string,
    label: string,
    color: string,
    count: number
  ): IContactProfileSexRow {
    return {
      key,
      label,
      color,
      count,
      percentage: this.total > 0 ?
        (count * 100) / this.total :
        0
    };
  }
}