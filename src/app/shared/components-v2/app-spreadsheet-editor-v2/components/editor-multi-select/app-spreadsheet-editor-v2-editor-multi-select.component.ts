import { ChangeDetectionStrategy, Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { ICellEditorParams } from '@ag-grid-community/core';
import { ICellEditorAngularComp } from '@ag-grid-community/angular';
import { AppFormSelectMultipleV2Component } from '../../../../forms-v2/components/app-form-select-multiple-v2/app-form-select-multiple-v2.component';
import { ILabelValuePairModel } from '../../../../forms-v2/core/label-value-pair.model';
import { IV2SpreadsheetEditorColumnMultiSelect } from '../../models/column.model';
import { IV2SpreadsheetEditorExtendedColDef } from '../../models/extended-column.model';

@Component({
  selector: 'app-spreadsheet-editor-v2-editor-multi-select',
  templateUrl: './app-spreadsheet-editor-v2-editor-multi-select.component.html',
  styleUrls: ['./app-spreadsheet-editor-v2-editor-multi-select.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppSpreadsheetEditorV2EditorMultiSelectComponent implements ICellEditorAngularComp {
  // input
  @ViewChild(AppFormSelectMultipleV2Component, { static: true }) private _input: AppFormSelectMultipleV2Component;

  // data
  private _params: ICellEditorParams;
  options: ILabelValuePairModel[];
  value: string[];

  /**
   * Component initialized
   */
  agInit(params: ICellEditorParams): void {
    // data
    this._params = params;
    this.options = ((this._params.colDef as IV2SpreadsheetEditorExtendedColDef).columnDefinition as IV2SpreadsheetEditorColumnMultiSelect).options;
    this.value = Array.isArray(this._params.value) ?
      this._params.value :
      [];

    // focus and open
    this._input.open();
  }

  /**
   * Finished editing
   */
  getValue(): string[] {
    return this.value;
  }

  /**
   * Closed
   */
  stopEditing(): void {
    this._params.stopEditing();
  }
}
