import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, EventEmitter,
  forwardRef,
  Host, Input,
  OnDestroy, OnInit,
  Optional, Output,
  SkipSelf, ViewEncapsulation
} from '@angular/core';
import { ControlContainer, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MAT_SELECT_CONFIG } from '@angular/material/select';
import { AppFormLocationBaseV2, ILocation } from '../../core/app-form-location-base-v2';
import { LocationDataService } from '../../../../core/services/data/location.data.service';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';

@Component({
  selector: 'app-form-select-location-multiple-v2',
  templateUrl: './app-form-select-location-multiple-v2.component.html',
  styleUrls: ['./app-form-select-location-multiple-v2.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AppFormSelectLocationMultipleV2Component),
    multi: true
  }, {
    provide: MAT_SELECT_CONFIG,
    useValue: {
      overlayPanelClass: [
        'gd-cdk-overlay-pane-location',
        'gd-cdk-overlay-pane-location-multi'
      ]
    }
  }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppFormSelectLocationMultipleV2Component
  extends AppFormLocationBaseV2<string[]> implements OnInit, OnDestroy {

  // view only
  @Input() viewOnly: boolean;

  // no value string
  @Input() noValueLabel: string = '—';

  // selected locations
  selectedLocations: ILocation[] = [];

  // selected locations changed
  @Output() selectedLocationsChanged = new EventEmitter<ILocation[]>();

  // cascade selection: selecting a parent location also selects all of its descendants,
  // and unselecting a location also unselects its descendants (used e.g. by the transmission chain filter)
  @Input() cascadeSelection: boolean = false;

  // map of parent location id -> direct children ids (loaded only when cascadeSelection is enabled)
  private cascadeChildrenOf: { [parentId: string]: string[] } = null;

  // last value seen by the cascade logic, used to detect what was added / removed
  private cascadePreviousValue: string[] = [];

  // guard to avoid re-entrancy while the cascade updates the value
  private cascadeApplying: boolean = false;

  /**
   * Constructor
   */
  constructor(
    @Optional() @Host() @SkipSelf() protected controlContainer: ControlContainer,
    protected i18nService: I18nService,
    protected changeDetectorRef: ChangeDetectorRef,
    protected locationDataService: LocationDataService,
    protected outbreakDataService: OutbreakDataService,
    protected toastV2Service: ToastV2Service
  ) {
    super(
      true,
      controlContainer,
      i18nService,
      changeDetectorRef,
      locationDataService,
      outbreakDataService,
      toastV2Service
    );
  }

  /**
   * Component initialized
   */
  ngOnInit(): void {
    // initialize
    super.onInit();

    // load the parent -> children map only when cascade selection is enabled
    if (this.cascadeSelection) {
      this.loadCascadeChildrenMap();
    }
  }

  /**
   * Load the parent -> children location map used by the cascade selection
   */
  private loadCascadeChildrenMap(): void {
    const qb = new RequestQueryBuilder();
    qb.fields('id', 'parentLocationId');
    this.locationDataService
      .getLocationsList(qb)
      .subscribe((locations) => {
        const childrenOf: { [parentId: string]: string[] } = {};
        (locations || []).forEach((location) => {
          if (location.parentLocationId) {
            if (!childrenOf[location.parentLocationId]) {
              childrenOf[location.parentLocationId] = [];
            }
            childrenOf[location.parentLocationId].push(location.id);
          }
        });
        this.cascadeChildrenOf = childrenOf;

        // treat the current selection as newly added so pre-selected parents cascade to their descendants
        this.cascadePreviousValue = [];
        this.updateSelected(false);
      });
  }

  /**
   * Collect all descendants of a location id into the provided accumulator
   */
  private collectCascadeDescendants(locationId: string, acc: { [id: string]: true }): void {
    const children = this.cascadeChildrenOf[locationId];
    if (!children) {
      return;
    }
    children.forEach((childId) => {
      if (!acc[childId]) {
        acc[childId] = true;
        this.collectCascadeDescendants(childId, acc);
      }
    });
  }

  /**
   * Apply the cascade to the current value: add descendants of newly selected locations and
   * remove descendants of newly unselected locations. Returns true when the value changed.
   */
  private applyCascadeSelection(): boolean {
    // nothing to do until the children map is loaded
    if (!this.cascadeChildrenOf) {
      return false;
    }

    // current & previous values as sets
    const currentValue: string[] = Array.isArray(this.value) ? this.value : [];
    const currentSet: { [id: string]: true } = {};
    currentValue.forEach((id) => currentSet[id] = true);
    const previousSet: { [id: string]: true } = {};
    (this.cascadePreviousValue || []).forEach((id) => previousSet[id] = true);

    // build the resulting selection starting from the current one
    const resultSet: { [id: string]: true } = { ...currentSet };

    // newly selected => add their descendants
    currentValue
      .filter((id) => !previousSet[id])
      .forEach((id) => this.collectCascadeDescendants(id, resultSet));

    // newly unselected => remove their descendants
    (this.cascadePreviousValue || [])
      .filter((id) => !currentSet[id])
      .forEach((id) => {
        const descendants: { [id: string]: true } = {};
        this.collectCascadeDescendants(id, descendants);
        Object.keys(descendants).forEach((descendantId) => delete resultSet[descendantId]);
      });

    // remember baseline for the next change
    const result = Object.keys(resultSet);
    this.cascadePreviousValue = result;

    // apply only if it actually changed
    if (
      result.length !== currentValue.length ||
      result.some((id) => !currentSet[id])
    ) {
      this.value = result;
      return true;
    }

    // finished
    return false;
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    // parent
    super.onDestroy();
  }

  /**
   * vScroll to see the first selected item
   */
  vScrollToFirstSelectedOption(): void {
    // scroll to item ?
    if (
      this.value &&
      this.cdkVirtualScrollViewport
    ) {
      // hack to force re-render, otherwise we see an empty scroll
      if (
        this.value &&
        this.value.length > 0
      ) {
        // determine value to search
        const valueToSearch: string = this.value[0];
        const index: number = this.locations.findIndex((option) => option.id === valueToSearch);
        if (index > -1) {
          this.cdkVirtualScrollViewport.scrollToIndex(index);
        }
      }
    }
  }

  /**
   * Update selected items
   */
  updateSelected(emitEvent: boolean): void {
    // cascade selection (parent <-> descendants) before computing the display list
    if (
      this.cascadeSelection &&
      !this.cascadeApplying
    ) {
      this.cascadeApplying = true;
      this.applyCascadeSelection();
      this.cascadeApplying = false;
    }

    // map selected item
    const selectedMap: {
      [id: string]: true
    } = {};
    (this.value || []).forEach((id) => {
      selectedMap[id] = true;
    });

    // map current list of selected items
    const newSelectedItems: ILocation[] = [];
    const newSelectedItemsMap: {
      [id: string]: true
    } = {};
    this.selectedLocations.forEach((item) => {
      // removed ?
      if (!selectedMap[item.id]) {
        return;
      }

      // add it back to list
      newSelectedItems.push(item);
      newSelectedItemsMap[item.id] = true;
    });

    // add missing items to the list
    // - those that were selected now
    Object.keys(selectedMap).forEach((id) => {
      // already added ?
      if (newSelectedItemsMap[id]) {
        return;
      }

      // add it
      newSelectedItems.push(this.locationMap[id]);
    });

    // update selected list
    this.selectedLocations = newSelectedItems;

    // emit event
    if (emitEvent) {
      this.selectedLocationsChanged.emit(this.selectedLocations);
    }
  }
}
