import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RequestQueryBuilder } from '../../../../core/helperClasses/request-query-builder';
import { LocationDataService } from '../../../../core/services/data/location.data.service';
import { LocationModel } from '../../../../core/models/location.model';

/**
 * Value handled by the location tree control: the explicitly selected locations (include) and the
 * ones the user removed from an otherwise inherited selection (exclude).
 */
export interface ILocationTreeValue {
  include: string[];
  exclude: string[];
}

interface ILocationTreeRow {
  id: string;
  label: string;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
}

/**
 * Location selector rendered as a hierarchical tree with inherited checkboxes.
 * Selecting a parent visually checks its descendants without storing them (only the selected and the
 * excluded ids are kept), which keeps it fast even for very large hierarchies. Only the top-level
 * locations are shown initially; children are revealed on demand (expand) or through the search.
 */
@Component({
  selector: 'app-form-select-location-tree-v2',
  templateUrl: './app-form-select-location-tree-v2.component.html',
  styleUrls: ['./app-form-select-location-tree-v2.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AppFormSelectLocationTreeV2Component),
    multi: true
  }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppFormSelectLocationTreeV2Component implements OnInit, OnDestroy, ControlValueAccessor {
  // use the locations configured for the selected outbreak (kept for API compatibility)
  @Input() useOutbreakLocations: boolean = false;

  // placeholder
  @Input() placeholder: string;

  // disabled
  @Input() disabled: boolean = false;

  // rows currently displayed (respecting expand state / search)
  displayedRows: ILocationTreeRow[] = [];

  // loading flag
  loading: boolean = false;

  // search value
  searchValue: string = '';

  // selected / excluded sets
  private selected: Set<string> = new Set<string>();
  private excluded: Set<string> = new Set<string>();

  // flat data built once from the (cached) locations list
  private labelOf: { [id: string]: string } = {};
  private parentOf: { [id: string]: string } = {};
  private childrenOf: { [parentId: string]: string[] } = {};
  private topLevelIds: string[] = [];
  private depthCache: { [id: string]: number } = {};

  // expand state
  private expanded: Set<string> = new Set<string>();

  // subscriptions
  private loadSubscription: Subscription;

  // CVA callbacks
  private onChange: (value: ILocationTreeValue) => void = () => {};
  private onTouched: () => void = () => {};

  /**
   * Constructor
   */
  constructor(
    protected changeDetectorRef: ChangeDetectorRef,
    protected locationDataService: LocationDataService
  ) {}

  /**
   * Component initialized
   */
  ngOnInit(): void {
    this.loadLocations();
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    if (this.loadSubscription) {
      this.loadSubscription.unsubscribe();
      this.loadSubscription = null;
    }
  }

  /**
   * ControlValueAccessor - write value
   */
  writeValue(value: ILocationTreeValue): void {
    this.selected = new Set<string>(value && Array.isArray(value.include) ? value.include : []);
    this.excluded = new Set<string>(value && Array.isArray(value.exclude) ? value.exclude : []);
    this.changeDetectorRef.markForCheck();
  }

  /**
   * ControlValueAccessor - register on change
   */
  registerOnChange(fn: (value: ILocationTreeValue) => void): void {
    this.onChange = fn;
  }

  /**
   * ControlValueAccessor - register on touched
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * ControlValueAccessor - set disabled state
   */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Load the flat (cached) locations list and build the tree lookups
   */
  private loadLocations(): void {
    this.loading = true;
    this.changeDetectorRef.markForCheck();

    const qb = new RequestQueryBuilder();
    qb.fields('id', 'name', 'parentLocationId');

    this.loadSubscription = this.locationDataService
      .getLocationsList(qb)
      .subscribe((locations) => {
        this.buildFromFlat(locations || []);
        this.loading = false;
        this.rebuildDisplayed();
      });
  }

  /**
   * Build the label / parent / children lookups from the flat locations list
   */
  private buildFromFlat(locations: LocationModel[]): void {
    this.labelOf = {};
    this.parentOf = {};
    this.childrenOf = {};
    this.topLevelIds = [];
    this.depthCache = {};

    locations.forEach((location) => {
      this.labelOf[location.id] = location.name;
      const parentId = location.parentLocationId || null;
      this.parentOf[location.id] = parentId;
      if (parentId) {
        (this.childrenOf[parentId] = this.childrenOf[parentId] || []).push(location.id);
      } else {
        this.topLevelIds.push(location.id);
      }
    });

    // sort helper by label
    const sortByLabel = (a: string, b: string) => (this.labelOf[a] || '').localeCompare(this.labelOf[b] || '');
    this.topLevelIds.sort(sortByLabel);
    Object.keys(this.childrenOf).forEach((parentId) => this.childrenOf[parentId].sort(sortByLabel));
  }

  /**
   * Depth of a location (number of ancestors)
   */
  private depth(id: string): number {
    if (this.depthCache[id] !== undefined) {
      return this.depthCache[id];
    }
    let level = 0;
    let current = this.parentOf[id];
    while (current) {
      level++;
      current = this.parentOf[current];
    }
    this.depthCache[id] = level;
    return level;
  }

  /**
   * A location is "within" a set if itself or any ancestor belongs to it
   */
  private isWithin(id: string, set: Set<string>): boolean {
    let current = id;
    while (current) {
      if (set.has(current)) {
        return true;
      }
      current = this.parentOf[current];
    }
    return false;
  }

  /**
   * Whether a location is effectively checked (selected or inherited, and not excluded)
   */
  isChecked(id: string): boolean {
    return this.isWithin(id, this.selected) && !this.isWithin(id, this.excluded);
  }

  /**
   * Rebuild the displayed rows based on the search term or the expand state
   */
  private rebuildDisplayed(): void {
    const term = (this.searchValue || '').trim().toLowerCase();
    const rows: ILocationTreeRow[] = [];

    if (term) {
      // search mode: flat list of every location matching the term
      Object.keys(this.labelOf)
        .filter((id) => this.labelOf[id] && this.labelOf[id].toLowerCase().indexOf(term) > -1)
        .sort((a, b) => (this.labelOf[a] || '').localeCompare(this.labelOf[b] || ''))
        .forEach((id) => rows.push(this.buildRow(id)));
    } else {
      // tree mode: top-level + children of expanded nodes
      const addNode = (id: string) => {
        rows.push(this.buildRow(id));
        if (this.expanded.has(id)) {
          (this.childrenOf[id] || []).forEach(addNode);
        }
      };
      this.topLevelIds.forEach(addNode);
    }

    this.displayedRows = rows;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Build a display row for a location
   */
  private buildRow(id: string): ILocationTreeRow {
    return {
      id: id,
      label: this.labelOf[id],
      level: this.depth(id),
      hasChildren: (this.childrenOf[id] || []).length > 0,
      expanded: this.expanded.has(id)
    };
  }

  /**
   * Expand / collapse a node
   */
  toggleExpand(row: ILocationTreeRow, event: Event): void {
    event.stopPropagation();
    if (this.expanded.has(row.id)) {
      this.expanded.delete(row.id);
    } else {
      this.expanded.add(row.id);
    }
    this.rebuildDisplayed();
  }

  /**
   * Toggle a location on user click
   */
  toggle(row: ILocationTreeRow): void {
    if (this.disabled) {
      return;
    }

    const id = row.id;
    if (this.isChecked(id)) {
      // currently checked => uncheck it
      if (this.selected.has(id)) {
        // was explicitly selected => just remove it
        this.selected.delete(id);
      } else {
        // was checked through an ancestor => exclude it
        this.excluded.add(id);
      }
    } else {
      // currently unchecked => check it
      if (this.excluded.has(id)) {
        // was explicitly excluded => remove the exclusion
        this.excluded.delete(id);
      } else {
        // select it
        this.selected.add(id);
      }
    }

    this.onTouched();
    this.emitValue();
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Emit the current value to the form
   */
  private emitValue(): void {
    this.onChange({
      include: Array.from(this.selected),
      exclude: Array.from(this.excluded)
    });
  }

  /**
   * Search changed
   */
  onSearchChanged(): void {
    this.rebuildDisplayed();
  }

  /**
   * Track rows by id for the virtual scroll
   */
  trackByRow(_index: number, row: ILocationTreeRow): string {
    return row.id;
  }
}
