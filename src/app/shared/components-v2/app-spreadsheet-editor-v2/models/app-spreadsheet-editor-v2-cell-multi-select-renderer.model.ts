import { AppSpreadsheetEditorV2CellBasicRendererModel } from './app-spreadsheet-editor-v2-cell-basic-renderer.model';

/**
 * Multi select cell renderer
 */
export class AppSpreadsheetEditorV2CellMultiSelectRendererModel extends AppSpreadsheetEditorV2CellBasicRendererModel {
  // data
  private _guiRootValueHTMLValue: HTMLDivElement;
  private _guiRootValueHTMLIcon: HTMLDivElement;
  private _iconClick: () => void = () => {
    this.startEditCell();
  };

  /**
   * Update value
   */
  protected updateValue(): void {
    // must initialize ?
    if (!this._guiRootValueHTMLValue) {
      // value
      this._guiRootValueHTMLValue = document.createElement('div');
      this._guiRootValueHTMLValue.classList.add('gd-spreadsheet-editor-v2-cell-basic-renderer-value-text');
      this._guiRootValueHTML.appendChild(this._guiRootValueHTMLValue);

      // icon
      this._guiRootValueHTMLIcon = document.createElement('div');
      this._guiRootValueHTMLIcon.classList.add('gd-spreadsheet-editor-v2-cell-basic-renderer-value-icon');
      this._guiRootValueHTMLIcon.innerHTML = '<span class="material-icons mat-icon">unfold_more</span>';
      this._guiRootValueHTMLIcon.addEventListener(
        'click',
        this._iconClick
      );
      this._guiRootValueHTML.appendChild(this._guiRootValueHTMLIcon);
    }

    // reset text
    this._guiRootValueHTMLValue.innerHTML = '';

    // value is an array of selected values
    const values: any[] = Array.isArray(this._params.value) ?
      this._params.value :
      [];

    // map each value to its translated label and join
    const optionsMap = this._colDef.columnDefinition.optionsMap;
    this._guiRootValueHTMLValue.innerHTML = values
      .map((value) => {
        if (
          value !== undefined &&
          value !== null &&
          optionsMap[value]
        ) {
          return optionsMap[value].label ?
            this._colDef.editor.helpers.translate(optionsMap[value].label) :
            '';
        }
        return value !== undefined && value !== null ?
          value :
          '';
      })
      .filter((label) => label !== '')
      .join(', ');
  }

  /**
   * Destroy
   */
  destroy(): void {
    // parent
    super.destroy();

    // detach events
    this._guiRootValueHTMLIcon.removeEventListener(
      'click',
      this._iconClick
    );
  }
}
