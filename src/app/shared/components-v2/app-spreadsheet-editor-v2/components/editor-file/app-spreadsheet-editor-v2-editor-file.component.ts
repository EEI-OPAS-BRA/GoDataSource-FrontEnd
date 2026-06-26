import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewEncapsulation } from '@angular/core';
import { ICellEditorParams } from '@ag-grid-community/core';
import { ICellEditorAngularComp } from '@ag-grid-community/angular';
import { FileItem, FileUploader } from 'ng2-file-upload';
import { environment } from '../../../../../../environments/environment';
import { AuthDataService } from '../../../../../core/services/data/auth.data.service';
import { OutbreakDataService } from '../../../../../core/services/data/outbreak.data.service';
import { ToastV2Service } from '../../../../../core/services/helper/toast-v2.service';
import { AttachmentModel } from '../../../../../core/models/attachment.model';
import { bulkFileNameCache } from '../../models/app-spreadsheet-editor-v2-cell-file-renderer.model';

@Component({
  selector: 'app-spreadsheet-editor-v2-editor-file',
  templateUrl: './app-spreadsheet-editor-v2-editor-file.component.html',
  styleUrls: ['./app-spreadsheet-editor-v2-editor-file.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppSpreadsheetEditorV2EditorFileComponent implements ICellEditorAngularComp {
  // data
  private _params: ICellEditorParams;
  value: string;
  uploading: boolean = false;
  uploader: FileUploader;

  /**
   * Constructor
   */
  constructor(
    protected authDataService: AuthDataService,
    protected outbreakDataService: OutbreakDataService,
    protected toastV2Service: ToastV2Service,
    protected changeDetectorRef: ChangeDetectorRef
  ) {}

  /**
   * Component initialized
   */
  agInit(params: ICellEditorParams): void {
    // data
    this._params = params;
    this.value = params.value;

    // configure uploader pointing to the selected outbreak attachments endpoint
    const selectedOutbreak = this.outbreakDataService.getSelectedOutbreakSubject().value;
    this.uploader = new FileUploader({
      authToken: this.authDataService.getAuthToken(),
      url: `${environment.apiUrl}/outbreaks/${selectedOutbreak ? selectedOutbreak.id : ''}/attachments`,
      autoUpload: true,
      headers: [{
        name: 'platform',
        value: 'WEB'
      }]
    });

    // only keep the latest file in the queue and attach its name
    this.uploader.onAfterAddingFile = () => {
      if (this.uploader.queue.length > 1) {
        this.uploader.removeFromQueue(this.uploader.queue[0]);
      }
      this.uploader.options.additionalParameter = {
        name: this.uploader.queue[0].file.name
      };
    };

    // started uploading
    this.uploader.onBeforeUploadItem = () => {
      this.uploading = true;
      this.changeDetectorRef.detectChanges();
    };

    // upload error
    this.uploader.onErrorItem = () => {
      this.uploading = false;
      this.toastV2Service.error('LNG_QUESTIONNAIRE_ERROR_UPLOADING_FILE');
      this.changeDetectorRef.detectChanges();
    };
    this.uploader.onWhenAddingFileFailed = () => {
      this.toastV2Service.error('LNG_QUESTIONNAIRE_ERROR_UPLOADING_FILE');
    };

    // upload finished
    this.uploader.onCompleteItem = (_fileItem: FileItem, response: string, status: number) => {
      this.uploading = false;

      // error ?
      if (status !== 200) {
        this.toastV2Service.error('LNG_QUESTIONNAIRE_ERROR_UPLOADING_FILE');
        this.changeDetectorRef.detectChanges();
        return;
      }

      // parse response
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(response);
      } catch {
        jsonResponse = undefined;
      }
      if (!jsonResponse) {
        this.toastV2Service.error('LNG_QUESTIONNAIRE_ERROR_UPLOADING_FILE');
        this.changeDetectorRef.detectChanges();
        return;
      }

      // store attachment id as value + cache its name for display
      const attachment: AttachmentModel = new AttachmentModel(jsonResponse);
      bulkFileNameCache[attachment.id] = attachment.name;
      this.value = attachment.id;

      // finished editing
      this.stopEditing();
    };
  }

  /**
   * Finished editing
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Remove the current attachment
   */
  remove(): void {
    this.value = null;
    this.stopEditing();
  }

  /**
   * Closed
   */
  stopEditing(): void {
    this._params.stopEditing();
  }
}
