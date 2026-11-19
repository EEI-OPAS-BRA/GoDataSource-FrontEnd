import { AppSpreadsheetEditorV2CellBasicRendererModel } from './app-spreadsheet-editor-v2-cell-basic-renderer.model';
import { HtmlUtils } from '../../../utils/html';

/**
 * Select cell renderer
 */
export class AppSpreadsheetEditorV2CellSelectRendererModel extends AppSpreadsheetEditorV2CellBasicRendererModel {
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

    // update text
    this._guiRootValueHTMLValue.textContent = '';

    // icon
    if (
      this._params.value !== undefined &&
      this._params.value !== null &&
      this._colDef.columnDefinition.optionsMap[this._params.value]?.icon
    ) {
      const icon = document.createElement('span');
      icon.classList.add('material-icons', 'mat-icon');
      icon.textContent = this._colDef.columnDefinition.optionsMap[this._params.value].icon;
      this._guiRootValueHTMLValue.appendChild(icon);
    }

    // icon url
    if (
      this._params.value !== undefined &&
      this._params.value !== null &&
      this._colDef.columnDefinition.optionsMap[this._params.value]?.iconUrl
    ) {
      const url = HtmlUtils.safeUrl(this._colDef.columnDefinition.optionsMap[this._params.value].iconUrl, true);
      if (url) {
        const icon = document.createElement('img');
        icon.src = url;
        this._guiRootValueHTMLValue.appendChild(icon);
      }
    }

    // label
    const label = this._params.value !== undefined && this._params.value !== null && this._colDef.columnDefinition.optionsMap[this._params.value] ?
      (
        this._colDef.columnDefinition.optionsMap[this._params.value].label ?
          this._colDef.editor.helpers.translate(this._colDef.columnDefinition.optionsMap[this._params.value].label) :
          ''
      ) : (
        this._params.value || this._params.value === 0 ?
          this._params.value :
          ''
      );
    this._guiRootValueHTMLValue.appendChild(document.createTextNode(String(label)));
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
