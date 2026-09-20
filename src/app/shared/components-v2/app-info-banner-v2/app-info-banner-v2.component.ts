import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output } from '@angular/core';
import { StorageService } from '../../../core/services/helper/storage.service';
import { IV2InfoBannerStep } from './models/info-banner.model';

/**
 * Component
 */
@Component({
  selector: 'app-info-banner-v2',
  templateUrl: './app-info-banner-v2.component.html',
  styleUrls: ['./app-info-banner-v2.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppInfoBannerV2Component implements AfterViewInit, OnDestroy {
  // storage
  private static readonly STORAGE_PREFIX: string = 'INFO_BANNER_COLLAPSED_';

  // observer
  private _resizeObserver: ResizeObserver;

  // texts
  @Input() icon: string = 'info';
  @Input() heading: string;
  @Input() description: string;
  @Input() stepsTitle: string;
  @Input() steps: IV2InfoBannerStep[] = [];
  @Input() notes: string[] = [];

  // remember collapsed state per banner
  private _storageKey: string;
  @Input() set storageKey(storageKey: string) {
    this._storageKey = storageKey;
    this.expanded = !this.readCollapsed();
  }

  // height changed
  @Output() resized = new EventEmitter<void>();

  // details visible
  expanded: boolean = true;

  /**
   * Constructor
   */
  constructor(
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private storageService: StorageService
  ) {}

  /**
   * Initialized
   */
  ngAfterViewInit(): void {
    // parent needs to know when our height changes, so it can resize what is placed below
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    // nothing to detect, so stay out of angular zone
    this.ngZone.runOutsideAngular(() => {
      this._resizeObserver = new ResizeObserver(() => {
        this.resized.emit();
      });
      this._resizeObserver.observe(this.elementRef.nativeElement);
    });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }
  }

  /**
   * Expand / collapse details
   */
  toggle(): void {
    this.expanded = !this.expanded;
    this.writeCollapsed(!this.expanded);
  }

  /**
   * Read collapsed state
   */
  private readCollapsed(): boolean {
    if (!this._storageKey) {
      return false;
    }

    try {
      return this.storageService.getAny(`${AppInfoBannerV2Component.STORAGE_PREFIX}${this._storageKey}`) === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Save collapsed state
   */
  private writeCollapsed(collapsed: boolean): void {
    if (!this._storageKey) {
      return;
    }

    try {
      this.storageService.setAny(
        `${AppInfoBannerV2Component.STORAGE_PREFIX}${this._storageKey}`,
        collapsed
      );
    } catch (e) {
      // storage unavailable; state isn't remembered
    }
  }
}
