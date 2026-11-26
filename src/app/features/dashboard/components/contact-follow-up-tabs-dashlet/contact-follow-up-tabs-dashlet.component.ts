import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { Moment } from '../../../../core/helperClasses/localization-helper';

@Component({
  selector: 'app-contact-follow-up-tabs-dashlet',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './contact-follow-up-tabs-dashlet.component.html',
  styleUrls: ['./contact-follow-up-tabs-dashlet.component.scss']
})
export class ContactFollowUpTabsDashletComponent {
  // detect changes
  @Output() detectChanges = new EventEmitter<void>();

  // global filters
  @Input() globalFilterDate: Moment | string;
  @Input() globalFilterLocationId: string;
  @Input() globalFilterClassificationId: string[];

  // visible tabs (permissions)
  @Input() showFollowUp: boolean = true;
  @Input() showContactStatus: boolean = true;

  // expanded / collapsed ?
  expanded: boolean = false;

  // selected tab
  selectedTabIndex: number = 0;
}