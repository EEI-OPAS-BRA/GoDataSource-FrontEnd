import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as _ from 'lodash';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { CaseDataService } from '../../../../core/services/data/case.data.service';
import { ContactDataService } from '../../../../core/services/data/contact.data.service';
import { LabResultDataService } from '../../../../core/services/data/lab-result.data.service';
import { Constants } from '../../../../core/models/constants';
import { EntityType } from '../../../../core/models/entity-type';
import { IBasicCount } from '../../../../core/models/basic-count.interface';
import { DebounceTimeCaller } from '../../../../core/helperClasses/debounce-time-caller';
import { RequestFilter, RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';

/**
 * Completeness row
 */
interface IDataCompletenessRow {
  key: string;
  icon: string;
  label: string;
  description: string;
  filled: number;
  applicable: number;
  percentage: number;
  color: string;
}

/**
 * Counts retrieved from the API (null => not available, e.g. no permission)
 */
interface IDataCompletenessCounts {
  casesTotal: number;
  dateOfOnset: number;
  classification: number;
  gender: number;
  age: number;
  location: number;
  outcome: number;
  labTotal: number;
  labFilled: number;
  contactsTotal: number;
  contactsLinked: number;
}

@Component({
  selector: 'app-data-completeness-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './data-completeness-dashlet.component.html',
  styleUrls: ['./data-completeness-dashlet.component.scss']
})
export class DataCompletenessDashletComponent implements OnInit, OnDestroy {
  // colors / thresholds (%)
  private static readonly FALLBACK_PRIMARY_COLOR: string = '#2F7977';
  private static readonly WARNING_COLOR: string = '#F9A825';
  private static readonly DANGER_COLOR: string = '#D32F2F';
  private static readonly GOOD_THRESHOLD: number = 80;
  private static readonly WARNING_THRESHOLD: number = 50;

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

  // year filter - date of reporting (null / undefined => all years)
  private _filterYear: number;
  @Input() set filterYear(filterYear: number) {
    this._filterYear = filterYear;
    this.refreshDataCaller.call();
  }
  get filterYear(): number {
    return this._filterYear;
  }

  // rows
  rows: IDataCompletenessRow[] = [];
  showLabNote: boolean = false;
  showLinkNote: boolean = false;

  // loading data
  displayLoading: boolean = true;

  // outbreak
  private _selectedOutbreak: OutbreakModel;

  // subscribers
  private _outbreakSubscriber: Subscription;
  private _dataSubscriber: Subscription;

  // refresh data (debounced)
  private refreshDataCaller = new DebounceTimeCaller(() => {
    this.refreshData();
  }, 100);

  /**
   * Constructor
   */
  constructor(
    private caseDataService: CaseDataService,
    private contactDataService: ContactDataService,
    private labResultDataService: LabResultDataService,
    private outbreakDataService: OutbreakDataService
  ) {}

  /**
   * Component initialized
   */
  ngOnInit(): void {
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
   * Date of reporting interval (year filter + reference date)
   */
  private getReportingInterval(): { start: Moment, end: Moment } {
    // reference date (global filter) or today
    const referenceDate: Moment = this.globalFilterDate ?
      LocalizationHelper.toMoment(this.globalFilterDate).clone().endOf('day') :
      LocalizationHelper.now().endOf('day');

    // all years
    if (!this.filterYear) {
      return {
        start: null,
        end: referenceDate
      };
    }

    // calendar year (past years end on December 31)
    const start: Moment = referenceDate.clone().startOf('year').year(this.filterYear);
    const endOfYear: Moment = start.clone().endOf('year');
    return {
      start,
      end: endOfYear.isBefore(referenceDate) ? endOfYear : referenceDate
    };
  }

  /**
   * Date of reporting condition
   */
  private getReportingCondition(): any {
    const interval = this.getReportingInterval();
    const condition: any = {
      lte: interval.end.toISOString()
    };
    if (interval.start) {
      condition.gte = interval.start.toISOString();
    }
    return {
      dateOfReporting: condition
    };
  }

  /**
   * Add case filters (global filters + year + exclude discarded) to a filter
   */
  private addCaseConditions(
    filter: RequestFilter
  ): void {
    // exclude discarded cases
    filter.where({
      classification: {
        neq: Constants.CASE_CLASSIFICATION.NOT_A_CASE
      }
    });

    // classification
    if (!_.isEmpty(this.globalFilterClassificationId)) {
      filter.bySelect(
        'classification',
        this.globalFilterClassificationId,
        false,
        null
      );
    }

    // location
    if (this.globalFilterLocationId) {
      filter.where({
        'addresses.parentLocationIdFilter': this.globalFilterLocationId
      });
    }

    // date of reporting
    filter.where(this.getReportingCondition());
  }

  /**
   * Count cases (extra condition => filled field)
   */
  private countCases(condition?: any): Observable<number> {
    const qb = new RequestQueryBuilder();
    this.addCaseConditions(qb.filter);
    if (condition) {
      qb.filter.where(condition);
    }
    return this.caseDataService
      .getCasesCount(this._selectedOutbreak.id, qb)
      .pipe(
        map((result: IBasicCount) => result?.count || 0),
        catchError(() => of(null))
      );
  }

  /**
   * Count contacts (extra condition => linked to a case)
   */
  private countContacts(condition?: any): Observable<number> {
    const qb = new RequestQueryBuilder();

    // location
    if (this.globalFilterLocationId) {
      qb.filter.where({
        'addresses.parentLocationIdFilter': this.globalFilterLocationId
      });
    }

    // date of reporting
    qb.filter.where(this.getReportingCondition());

    // extra condition
    if (condition) {
      qb.filter.where(condition);
    }

    return this.contactDataService
      .getContactsCount(this._selectedOutbreak.id, qb)
      .pipe(
        map((result: IBasicCount) => result?.count || 0),
        catchError(() => of(null))
      );
  }

  /**
   * Count lab results of cases (extra condition => result filled)
   */
  private countLabResults(condition?: any): Observable<number> {
    const qb = new RequestQueryBuilder();

    // lab results of cases
    qb.filter.where({
      personType: EntityType.CASE
    });

    // extra condition
    if (condition) {
      qb.filter.where(condition);
    }

    // same case filters as the other rows
    this.addCaseConditions(qb.addChildQueryBuilder('case').filter);

    return this.labResultDataService
      .getOutbreakLabResultsCount(this._selectedOutbreak.id, qb)
      .pipe(
        map((result: IBasicCount) => result?.count || 0),
        catchError(() => of(null))
      );
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

    // filled conditions (missing, null and '' => not filled)
    const filledCondition = { nin: [null, ''] };

    // retrieve all counts in parallel
    this.displayLoading = true;
    this.detectChanges.emit();
    this._dataSubscriber = forkJoin({
      casesTotal: this.countCases(),
      dateOfOnset: this.countCases({
        dateOfOnset: {
          neq: null
        }
      }),
      classification: this.countCases({
        classification: filledCondition
      }),
      gender: this.countCases({
        gender: filledCondition
      }),
      age: this.countCases({
        or: [
          { 'age.years': { gt: 0 } },
          { 'age.months': { gt: 0 } },
          { dob: { neq: null } }
        ]
      }),
      location: this.countCases({
        addresses: {
          elemMatch: {
            typeId: 'LNG_REFERENCE_DATA_CATEGORY_ADDRESS_TYPE_USUAL_PLACE_OF_RESIDENCE',
            locationId: filledCondition
          }
        }
      }),
      outcome: this.countCases({
        outcomeId: filledCondition
      }),
      labTotal: this.countLabResults(),
      labFilled: this.countLabResults({
        result: filledCondition
      }),
      contactsTotal: this.countContacts(),
      contactsLinked: this.countContacts({
        'relationshipsRepresentation.otherParticipantType': EntityType.CASE
      })
    }).subscribe((counts: IDataCompletenessCounts) => {
      // build rows
      this.buildRows(counts);

      // finished
      this.displayLoading = false;
      this.detectChanges.emit();
    });
  }

  /**
   * Build rows
   */
  private buildRows(counts: IDataCompletenessCounts): void {
    // rows
    const rows: IDataCompletenessRow[] = [];
    const addRow = (
      key: string,
      icon: string,
      filled: number,
      applicable: number,
      hideWhenNotApplicable: boolean
    ) => {
      // not available (no permission / error) or not applicable for this outbreak
      if (
        filled === null ||
        applicable === null || (
          hideWhenNotApplicable &&
          applicable < 1
        )
      ) {
        return;
      }

      // add row
      const percentage: number = applicable > 0 ?
        (filled / applicable) * 100 :
        null;
      rows.push({
        key,
        icon,
        label: `LNG_PAGE_DASHBOARD_DATA_QUALITY_COMPLETENESS_${key}`,
        description: `LNG_PAGE_DASHBOARD_DATA_QUALITY_COMPLETENESS_${key}_DESCRIPTION`,
        filled,
        applicable,
        percentage,
        color: this.getColor(percentage)
      });
    };

    // cases
    addRow('ONSET', 'event', counts.dateOfOnset, counts.casesTotal, false);
    addRow('CLASSIFICATION', 'verified_user', counts.classification, counts.casesTotal, false);
    addRow('GENDER', 'wc', counts.gender, counts.casesTotal, false);
    addRow('AGE', 'cake', counts.age, counts.casesTotal, false);
    addRow('LOCATION', 'place', counts.location, counts.casesTotal, false);
    addRow('OUTCOME', 'flag', counts.outcome, counts.casesTotal, false);

    // conditional variables
    addRow('LAB', 'science', counts.labFilled, counts.labTotal, true);
    addRow('LINK', 'link', counts.contactsLinked, counts.contactsTotal, true);

    // finished
    this.rows = rows;
    this.showLabNote = rows.some((row) => row.key === 'LAB');
    this.showLinkNote = rows.some((row) => row.key === 'LINK');
  }

  /**
   * Bar color
   */
  private getColor(percentage: number): string {
    if (percentage === null) {
      return null;
    }
    if (percentage >= DataCompletenessDashletComponent.GOOD_THRESHOLD) {
      return this.getPrimaryColor();
    }
    if (percentage >= DataCompletenessDashletComponent.WARNING_THRESHOLD) {
      return DataCompletenessDashletComponent.WARNING_COLOR;
    }
    return DataCompletenessDashletComponent.DANGER_COLOR;
  }

  /**
   * Theme primary color
   */
  private getPrimaryColor(): string {
    const color: string = getComputedStyle(document.body).getPropertyValue('--gd-primary');
    return color && color.trim() ?
      color.trim() :
      DataCompletenessDashletComponent.FALLBACK_PRIMARY_COLOR;
  }
}