import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Tab
 */
export interface ISyncTab {
  key: string;
  icon: string;
  label: string;

  // number displayed next to the label (e.g. outbreaks waiting for a decision)
  count?: number;

  // warning: waits for the user; info: waits for another instance
  countType?: 'warning' | 'info';
  countTooltip?: string;
}

/**
 * Tabs of the page of a client / destination server, so each responsibility has its own place
 */
@Component({
  selector: 'app-sync-tabs',
  templateUrl: './sync-tabs.component.html',
  styleUrls: ['./sync-tabs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncTabsComponent {
  // tabs
  @Input() tabs: ISyncTab[] = [];

  // tab displayed
  @Input() active: string;
  @Output() activeChange: EventEmitter<string> = new EventEmitter<string>();

  /**
   * Open a tab
   */
  open(tab: ISyncTab): void {
    if (tab.key === this.active) {
      return;
    }

    this.active = tab.key;
    this.activeChange.emit(tab.key);
  }

  /**
   * Track by
   */
  trackByKey(_index: number, tab: ISyncTab): string {
    return tab.key;
  }
}
