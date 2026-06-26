import { AppSpreadsheetEditorV2CellBasicRendererModel } from './app-spreadsheet-editor-v2-cell-basic-renderer.model';

/**
 * In-memory cache of uploaded file names (attachmentId -> file name).
 * Written by the file editor on a successful upload, read by this renderer.
 * Existing attachments (only the id is known) fall back to a generic label.
 */
export const bulkFileNameCache: {
  [attachmentId: string]: string
} = {};

/**
 * File cell renderer
 */
export class AppSpreadsheetEditorV2CellFileRendererModel extends AppSpreadsheetEditorV2CellBasicRendererModel {
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
      this._guiRootValueHTMLIcon.addEventListener(
        'click',
        this._iconClick
      );
      this._guiRootValueHTML.appendChild(this._guiRootValueHTMLIcon);
    }

    // current attachment id
    const value: string = this._params.value;
    const hasFile: boolean = value !== undefined && value !== null && value !== '';

    // label: cached name (just uploaded) or generic when only the id is known
    this._guiRootValueHTMLValue.innerHTML = '';
    if (hasFile) {
      this._guiRootValueHTMLValue.innerHTML = bulkFileNameCache[value] ?
        bulkFileNameCache[value] :
        this._colDef.editor.helpers.translate('LNG_MODULE_LABEL_FILE_ATTACHMENT');
    }

    // icon: attach (has file) or upload (empty)
    this._guiRootValueHTMLIcon.innerHTML = hasFile ?
      '<span class="material-icons mat-icon">attach_file</span>' :
      '<span class="material-icons mat-icon">upload_file</span>';
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
