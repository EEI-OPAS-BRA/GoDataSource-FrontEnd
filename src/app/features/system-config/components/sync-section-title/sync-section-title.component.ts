import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Title of a section of the sync pages, so the user knows what each part of the page is for
 */
@Component({
  selector: 'app-sync-section-title',
  templateUrl: './sync-section-title.component.html',
  styleUrls: ['./sync-section-title.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncSectionTitleComponent {
  @Input() icon: string;
  @Input() heading: string;
  @Input() description: string;
}
