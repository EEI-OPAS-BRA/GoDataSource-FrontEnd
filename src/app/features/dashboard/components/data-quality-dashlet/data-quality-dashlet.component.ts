import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { LocalizationHelper, Moment } from '../../../../core/helperClasses/localization-helper';
import { EpiCurveHelper } from '../../helperClasses/epi-curve-helper';

@Component({
  selector: 'app-data-quality-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './data-quality-dashlet.component.html',
  styleUrls: ['./data-quality-dashlet.component.scss']
})
export class DataQualityDashletComponent implements OnInit, OnDestroy {
  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // global filters
  @Input() globalFilterDate: Moment | string;
  @Input() globalFilterLocationId: string;
  @Input() globalFilterClassificationId: string[];

  // expanded / collapsed ?
  expanded: boolean = false;

  // selected tab
  selectedTabIndex: number = 0;

  // year filter (date of reporting) - starts with the current year
  selectedYear: number | string = LocalizationHelper.now().year();
  yearOptions: ILabelValuePairModel[] = [];

  // subscribers
  private _outbreakSubscriber: Subscription;

  /**
   * Year sent to the tabs (null => all years)
   */
  get filterYear(): number {
    return this.selectedYear === EpiCurveHelper.ALL_YEARS ?
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
    this._outbreakSubscriber = this.outbreakDataService
      .getSelectedOutbreakSubject()
      .subscribe((selectedOutbreak: OutbreakModel) => {
        this.yearOptions = EpiCurveHelper.getYearOptions(selectedOutbreak);
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
}