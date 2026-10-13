import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import * as _ from 'lodash';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import { ReferenceDataDataService } from '../../../../core/services/data/reference-data.data.service';
import { ReferenceDataHelperService } from '../../../../core/services/helper/reference-data-helper.service';
import { ReferenceDataCategory, ReferenceDataCategoryModel, ReferenceDataEntryModel } from '../../../../core/models/reference-data.model';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { Constants } from '../../../../core/models/constants';
import { ICasesDemographicsCount } from '../../../../core/models/cases-demographics-count.interface';
import { IBbDonutChartItem } from '../bb-donut-chart/bb-donut-chart.component';

/**
 * Sex tab - row
 */
interface ICaseProfileSexRow {
  key: string;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-case-profile-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './case-profile-dashlet.component.html',
  styleUrls: ['./case-profile-dashlet.component.scss']
})
export class CaseProfileDashletComponent implements OnInit, OnDestroy {
  // key used for records without sex
  private static readonly NOT_INFORMED_KEY: string = 'NOT_INFORMED';

  // default colors - used only when the reference data item has no color configured
  private static readonly DEFAULT_GENDER_COLORS: { [value: string]: string } = {
    LNG_REFERENCE_DATA_CATEGORY_GENDER_MALE: '#1976D2',
    LNG_REFERENCE_DATA_CATEGORY_GENDER_FEMALE: '#D32F2F'
  };
  private static readonly NOT_INFORMED_COLOR: string = '#FBC02D';
  private static readonly OTHER_COLORS: string[] = ['#7B1FA2', '#388E3C', '#F57C00', '#5D4037', '#0097A7'];

  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // selected tab
  selectedTabIndex: number = 0;

  // loading data
  displayLoading: boolean = false;

  // number of cases matching the filters
  total: number = 0;

  // sex tab
  sexRows: ICaseProfileSexRow[] = [];
  sexChartItems: IBbDonutChartItem[] = [];
  sexChartCenterTitle: string = '';

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
    private caseDataService: CaseDataService,
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
              let color: string = entry.colorCode || CaseProfileDashletComponent.DEFAULT_GENDER_COLORS[entry.value];
              if (!color) {
                color = CaseProfileDashletComponent.OTHER_COLORS[otherColorIndex % CaseProfileDashletComponent.OTHER_COLORS.length];
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

    // same global filters as the case summary dashlet
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

    // ignore not a case records
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
    this._retrievedData = true;
    this.displayLoading = true;
    this.detectChanges.emit();
    this._dataSubscriber = this.caseDataService
      .getCasesDemographics(
        this._selectedOutbreak.id,
        qb
      )
      .subscribe({
        next: (data: ICasesDemographicsCount) => {
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
  private processData(data: ICasesDemographicsCount): void {
    // total
    this.total = data?.total || 0;

    // sex tab
    this.processSexData(data);
  }

  /**
   * Sex tab - n and % per sex category available in the outbreak
   */
  private processSexData(data: ICasesDemographicsCount): void {
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

    // categories available in the outbreak, in configured order (also the ones without cases)
    const rows: ICaseProfileSexRow[] = [];
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
        CaseProfileDashletComponent.DEFAULT_GENDER_COLORS[key] || Constants.DEFAULT_COLOR_REF_DATA,
        counts[key]
      ));
    });

    // not informed
    if (notInformed > 0) {
      rows.push(this.buildSexRow(
        CaseProfileDashletComponent.NOT_INFORMED_KEY,
        this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_NOT_INFORMED_LABEL'),
        CaseProfileDashletComponent.NOT_INFORMED_COLOR,
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
    this.sexChartCenterTitle = `${this.total}\n${this.i18nService.instant('LNG_PAGE_DASHBOARD_CASE_PROFILE_CASES_LABEL')}`;
  }

  /**
   * Build sex row
   */
  private buildSexRow(
    key: string,
    label: string,
    color: string,
    count: number
  ): ICaseProfileSexRow {
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