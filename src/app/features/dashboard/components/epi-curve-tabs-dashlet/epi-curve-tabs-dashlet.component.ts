import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';

@Component({
  selector: 'app-epi-curve-tabs-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './epi-curve-tabs-dashlet.component.html',
  styleUrls: ['./epi-curve-tabs-dashlet.component.scss']
})
export class EpiCurveTabsDashletComponent implements OnInit, OnDestroy {
  // "all years" option value
  static readonly ALL_YEARS: string = 'ALL';

  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // global filters
  @Input() globalFilterDate: Moment | string;
  @Input() globalFilterLocationId: string;
  @Input() globalFilterClassificationId: string[];

  // visible tabs (permissions)
  @Input() showClassification: boolean = true;
  @Input() showOutcome: boolean = true;
  @Input() showReporting: boolean = true;

  // expanded / collapsed ?
  expanded: boolean = false;

  // selected tab
  selectedTabIndex: number = 0;

  // year filter
  // - starts with the current year
  selectedYear: number | string = LocalizationHelper.now().year();
  yearOptions: ILabelValuePairModel[] = [];

  // subscribers
  private _outbreakSubscriber: Subscription;

  /**
   * Year sent to the charts (null => all years)
   */
  get filterYear(): number {
    return this.selectedYear === EpiCurveTabsDashletComponent.ALL_YEARS ?
      null :
      this.selectedYear as number;
  }

  /**
   * Constructor
   */
  constructor(
    private outbreakDataService: OutbreakDataService
  ) {}

  /**
   * Component initialized
   */
  ngOnInit(): void {
    // build year options when outbreak changes
    this._outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        this.buildYearOptions(selectedOutbreak);
        this.detectChanges.emit();
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
  }

  /**
   * Build year options: from the outbreak start year until the current year (most recent first) + "all years"
   */
  private buildYearOptions(outbreak: OutbreakModel): void {
    // determine interval
    const currentYear: number = LocalizationHelper.now().year();
    const outbreakStart: Moment = outbreak?.startDate ?
      LocalizationHelper.toMoment(outbreak.startDate) :
      null;
    const startYear: number = outbreakStart && outbreakStart.isValid() && outbreakStart.year() <= currentYear ?
      outbreakStart.year() :
      currentYear;

    // years
    const options: ILabelValuePairModel[] = [];
    for (let year = currentYear; year >= startYear; year--) {
      options.push({
        label: year.toString(),
        value: year
      });
    }

    // all years
    options.push({
      label: 'LNG_PAGE_DASHBOARD_OVERVIEW_ALL_YEARS_LABEL',
      value: EpiCurveTabsDashletComponent.ALL_YEARS
    });

    // finished
    this.yearOptions = options;
  }
}