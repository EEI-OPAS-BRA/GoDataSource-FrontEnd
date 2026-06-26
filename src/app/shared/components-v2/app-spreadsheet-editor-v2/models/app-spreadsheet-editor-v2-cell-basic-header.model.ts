import { ICellRendererComp, IHeaderParams } from '@ag-grid-community/core';
import { IV2SpreadsheetEditorExtendedColDef } from './extended-column.model';
import { IV2SpreadsheetEditorColumnValidatorRequired } from './column.model';

/**
 * Row number cell renderer
 */
export class AppSpreadsheetEditorV2CellBasicHeaderModel implements ICellRendererComp {
  // gui
  private _guiRoot: HTMLDivElement;
  protected _guiRootValueHTML: HTMLDivElement;

  // data
  protected _params: IHeaderParams;
  protected _colDef: IV2SpreadsheetEditorExtendedColDef;

  // events
  private _mouseEnter: (event: MouseEvent) => void = (event) => {
    this._colDef.editor.selection.header.top.mouseEnter(
      this._colDef.editor.columnsMap[this._colDef.columnDefinition.field].index,
      event.buttons === 1
    );
  };
  private _mouseDown: (event: MouseEvent) => void = (event) => {
    // only primary button is relevant
    if (event.buttons !== 1) {
      return;
    }

    // execute mouse down
    this._colDef.editor.selection.header.top.mouseDown(
      this._colDef.editor.columnsMap[this._colDef.columnDefinition.field].index,
      event.ctrlKey,
      event.shiftKey
    );
  };
  private _mouseUp: () => void = () => {
    this._colDef.editor.selection.header.top.mouseUp();
  };
  private _mouseLeave: () => void = () => {
    this._colDef.editor.selection.header.top.mouseLeave();
  };
  private _mouseMove: (event: MouseEvent) => void = (event) => {
    this._colDef.editor.selection.header.top.mouseMove(
      false,
      event
    );
  };

  /**
   * Initialize
   */
  init(params): void {
    // initialize root
    this._guiRoot = document.createElement('div');

    // data
    this.updateParams(params);

    // attach classes
    this._guiRoot.classList.add('gd-spreadsheet-editor-v2-cell-basic-header');

    // create child value
    this._guiRootValueHTML = document.createElement('div');

    // attach css
    this._guiRootValueHTML.classList.add('gd-spreadsheet-editor-v2-cell-basic-header-value');

    // append child
    this._guiRoot.appendChild(this._guiRootValueHTML);

    // attach events
    this._guiRoot.addEventListener(
      'mouseenter',
      this._mouseEnter
    );
    this._guiRoot.addEventListener(
      'mousedown',
      this._mouseDown
    );
    this._guiRoot.addEventListener(
      'mouseup',
      this._mouseUp
    );
    this._guiRoot.addEventListener(
      'mouseleave',
      this._mouseLeave
    );
    this._guiRoot.addEventListener(
      'mousemove',
      this._mouseMove
    );

    // update value
    this.updateValue();
  }

  /**
   * Destroy
   */
  destroy(): void {
    // detach events
    this._guiRoot.removeEventListener(
      'mouseenter',
      this._mouseEnter
    );
    this._guiRoot.removeEventListener(
      'mousedown',
      this._mouseDown
    );
    this._guiRoot.removeEventListener(
      'mouseup',
      this._mouseUp
    );
    this._guiRoot.removeEventListener(
      'mouseleave',
      this._mouseLeave
    );
    this._guiRoot.removeEventListener(
      'mousemove',
      this._mouseMove
    );
  }

  /**
   * Update
   */
  refresh(params): boolean {
    // data
    this.updateParams(params);

    // update value
    this.updateValue();

    // refreshed successfully
    return true;
  }

  /**
   * Retrieve gui
   */
  getGui(): HTMLDivElement {
    return this._guiRoot;
  }

  /**
   * Update params
   */
  private updateParams(params): void {
    // data
    this._params = params;
    this._colDef = this._params.column.getUserProvidedColDef() as IV2SpreadsheetEditorExtendedColDef;

    // attach / update id
    this.checkAndUpdateIDs();
  }

  /**
   * Check and update id
   */
  private checkAndUpdateIDs(): void {
    // root id
    const id = `gd-spreadsheet-editor-v2-cell-basic-header-${this._colDef.editor.columnsMap[this._colDef.columnDefinition.field].index}`;
    if (this._guiRoot.id !== id) {
      this._guiRoot.id = id;
    }
  }

  /**
   * Update value
   */
  protected updateValue(): void {
    // mark mandatory columns with an asterisk
    this._guiRootValueHTML.innerHTML = this.isColumnMandatory() ?
      `${this._params.displayName}<span class="gd-spreadsheet-editor-v2-cell-basic-header-value-required">*</span>` :
      this._params.displayName;
  }

  /**
   * Check if column is mandatory (always required or required by outbreak settings)
   * - conditional validators (e.g. document type/number, geolocation lat/lng) return false
   *   for an empty row, so they are not marked as mandatory
   */
  private isColumnMandatory(): boolean {
    const required = (this._colDef.columnDefinition?.validators as IV2SpreadsheetEditorColumnValidatorRequired)?.required;
    if (!required) {
      return false;
    }

    // mandatory if required regardless of row content
    try {
      return required({ model: {}, relationship: {} });
    } catch {
      return false;
    }
  }
}
