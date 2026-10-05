import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { Constants } from '../../../../core/models/constants';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { SystemSyncDataService } from '../../../../core/services/data/system-sync.data.service';
import { SystemSyncLogDataService } from '../../../../core/services/data/system-sync-log.data.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { SystemSyncLogHelperService } from '../../../../core/services/helper/system-sync-log-helper.service';
import { UpstreamServerCheckHelperService } from '../../../../core/services/helper/upstream-server-check-helper.service';

/**
 * Data sent to the dialog
 */
export interface ISyncProgressDialogData {
  upstreamServer: SystemUpstreamServerModel;
  syncOptions: {
    fromDate?: string,
    fullSync?: boolean,
    outbreakIDs?: string[]
  };
}

/**
 * Phases of a sync, in the order they happen
 * Note: must match the steps saved by the api in the sync log (syncStep)
 */
enum SyncPhase {
  CONNECT,
  CREDENTIALS,
  EXPORT,
  SEND,
  IMPORT,
  DONE
}

/**
 * Steps displayed to the user
 */
type SyncStepKey = 'connect' | 'credentials' | 'sync' | 'final';
type SyncStepStatus = 'pending' | 'running' | 'success' | 'error';
type SyncResult = 'success' | 'warning' | 'upToDate' | 'error';

interface ISyncStep {
  key: SyncStepKey;
  number: string;
  label: string;
  status: SyncStepStatus;
}

@Component({
  selector: 'app-sync-progress-dialog',
  templateUrl: './sync-progress-dialog.component.html',
  styleUrls: ['./sync-progress-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncProgressDialogComponent implements OnInit, OnDestroy {
  // how long each phase is displayed at least, so the user can follow the steps even if the sync is fast
  private static readonly MIN_PHASE_DURATION_MS: number = 900;

  // how often the progress is animated
  private static readonly TICK_MS: number = 100;

  // how often the sync log is checked
  private static readonly POLL_MS: number = Constants.DEFAULT_FILTER_POOLING_MS_CHECK_AGAIN;

  // progress bar interval of each phase
  private static readonly PHASE_PROGRESS: {
    [phase: number]: [number, number]
  } = {
      [SyncPhase.CONNECT]: [0, 20],
      [SyncPhase.CREDENTIALS]: [20, 35],
      [SyncPhase.EXPORT]: [35, 55],
      [SyncPhase.SEND]: [55, 75],
      [SyncPhase.IMPORT]: [75, 95],
      [SyncPhase.DONE]: [100, 100]
    };

  // phase for each step saved by the api
  private static readonly API_STEP_PHASE: {
    [step: string]: SyncPhase
  } = {
      CONNECT: SyncPhase.CONNECT,
      CREDENTIALS: SyncPhase.CREDENTIALS,
      EXPORT: SyncPhase.EXPORT,
      NO_DATA: SyncPhase.EXPORT,
      SEND: SyncPhase.SEND,
      IMPORT: SyncPhase.IMPORT
    };

  // steps
  steps: ISyncStep[] = [
    {
      key: 'connect',
      number: '01',
      label: 'LNG_SYNC_PROGRESS_DIALOG_STEP_CONNECT',
      status: 'running'
    }, {
      key: 'credentials',
      number: '02',
      label: 'LNG_SYNC_PROGRESS_DIALOG_STEP_CREDENTIALS',
      status: 'pending'
    }, {
      key: 'sync',
      number: '03',
      label: 'LNG_SYNC_PROGRESS_DIALOG_STEP_SYNC',
      status: 'pending'
    }, {
      key: 'final',
      number: '04',
      label: 'LNG_SYNC_PROGRESS_DIALOG_STEP_FINAL',
      status: 'pending'
    }
  ];

  // step displayed in the illustration
  currentStep: ISyncStep = this.steps[0];

  // progress
  percent: number = 0;
  phaseMessage: string = 'LNG_SYNC_PROGRESS_DIALOG_PHASE_CONNECT';

  // result
  finished: boolean = false;
  result: SyncResult;
  errorMessage: string;
  errorDetails: string;
  syncLog: SystemSyncLogModel;

  // phase reached by the sync (api) & the one displayed
  private _serverPhase: SyncPhase = SyncPhase.CONNECT;
  private _uiPhase: SyncPhase = SyncPhase.CONNECT;
  private _uiPhaseSince: number = Date.now();

  // phase that failed & result waiting to be displayed once the ui reaches it
  private _failedPhase: SyncPhase;
  private _pendingResult: SyncResult;

  // timers & requests
  private _tickTimer: any;
  private _pollTimer: any;
  private _requestSubscription: Subscription;

  /**
   * Constructor
   */
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ISyncProgressDialogData,
    private dialogRef: MatDialogRef<SyncProgressDialogComponent, boolean>,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private systemSyncDataService: SystemSyncDataService,
    private systemSyncLogDataService: SystemSyncLogDataService,
    private i18nService: I18nService,
    private systemSyncLogHelperService: SystemSyncLogHelperService,
    private upstreamServerCheckHelperService: UpstreamServerCheckHelperService
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    // animate progress
    this.ngZone.runOutsideAngular(() => {
      this._tickTimer = setInterval(
        () => this.ngZone.run(() => this.tick()),
        SyncProgressDialogComponent.TICK_MS
      );
    });

    // start sync
    this._requestSubscription = this.systemSyncDataService
      .sync(
        this.data.upstreamServer.url,
        this.data.syncOptions
      )
      .subscribe({
        next: (systemSync) => this.poll(systemSync.syncLogId),
        error: (err) => {
          // the sync didn't start (e.g. another sync is in progress)
          this.errorMessage = this.getApiErrorMessage(err);
          this.fail(SyncPhase.CONNECT);
        }
      });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    clearInterval(this._tickTimer);
    clearTimeout(this._pollTimer);
    this._requestSubscription?.unsubscribe();
  }

  /**
   * Close dialog; the sync continues on the server if it is still running
   */
  close(): void {
    this.dialogRef.close(true);
  }

  /**
   * Display the error saved in the sync log
   */
  viewError(): void {
    this.systemSyncLogHelperService.viewError(this.syncLog);
  }

  /**
   * Whether the sync log has an error to display
   */
  get hasErrorDetails(): boolean {
    return this.systemSyncLogHelperService.hasError(this.syncLog);
  }

  /**
   * Percent displayed
   */
  get percentDisplayed(): number {
    return Math.floor(this.percent);
  }

  /**
   * Check the sync log until the sync finishes
   */
  private poll(syncLogId: string): void {
    this._pollTimer = setTimeout(
      () => {
        this._requestSubscription = this.systemSyncLogDataService
          .getSyncLog(syncLogId)
          .subscribe({
            next: (syncLog: SystemSyncLogModel) => {
              this.syncLog = syncLog;

              // phase reached by the sync
              const apiPhase: SyncPhase = SyncProgressDialogComponent.API_STEP_PHASE[syncLog.syncStep];
              if (apiPhase !== undefined) {
                this._serverPhase = Math.max(this._serverPhase, apiPhase);
              }

              switch (syncLog.status) {
                case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS.value:
                  this.succeed(
                    syncLog.syncStep === 'NO_DATA' ?
                      'upToDate' :
                      'success'
                  );
                  break;

                case Constants.SYSTEM_SYNC_LOG_STATUS.SUCCESS_WITH_WARNINGS.value:
                  this.succeed('warning');
                  break;

                case Constants.SYSTEM_SYNC_LOG_STATUS.FAILED.value:
                  // older api versions saved this case as a failure
                  if (this.systemSyncLogHelperService.isNoDataToSync(syncLog)) {
                    this.succeed('upToDate');
                  } else {
                    this.failFromLog(syncLog, apiPhase);
                  }
                  break;

                // still in progress
                default:
                  this.poll(syncLogId);
              }
            },
            // couldn't check the status; try again, the sync continues on the server
            error: () => this.poll(syncLogId)
          });
      },
      SyncProgressDialogComponent.POLL_MS
    );
  }

  /**
   * The sync finished with success
   */
  private succeed(result: SyncResult): void {
    this._serverPhase = SyncPhase.DONE;
    this._pendingResult = result;
  }

  /**
   * The sync failed; explain why using the step saved by the api
   */
  private failFromLog(
    syncLog: SystemSyncLogModel,
    apiPhase: SyncPhase
  ): void {
    const failedPhase: SyncPhase = apiPhase !== undefined ?
      apiPhase :
      SyncPhase.CONNECT;

    // why
    const reason: string = syncLog.syncStepErrorCode ?
      this.upstreamServerCheckHelperService.getErrorMessage(
        syncLog.syncStepErrorCode,
        syncLog.syncStepErrorDetail
      ) :
      undefined;
    switch (failedPhase) {
      case SyncPhase.CONNECT:
        this.errorMessage = this.i18nService.instant(
          'LNG_SYNC_PROGRESS_DIALOG_ERROR_CONNECT', {
            name: this.data.upstreamServer.name
          }
        );
        break;
      case SyncPhase.CREDENTIALS:
        this.errorMessage = this.i18nService.instant(
          'LNG_SYNC_PROGRESS_DIALOG_ERROR_CREDENTIALS', {
            name: this.data.upstreamServer.name
          }
        );
        break;
      default:
        this.errorMessage = this.i18nService.instant('LNG_SYNC_PROGRESS_DIALOG_ERROR_SYNC');
    }
    this.errorDetails = reason;

    this.fail(failedPhase);
  }

  /**
   * The sync failed in a phase
   */
  private fail(phase: SyncPhase): void {
    this._failedPhase = phase;
    this._serverPhase = Math.max(this._serverPhase, phase);
    this._pendingResult = 'error';
  }

  /**
   * Animate the progress & advance the displayed phase
   */
  private tick(): void {
    if (this.finished) {
      return;
    }

    const now: number = Date.now();

    // the ui reached the phase that failed
    if (
      this._pendingResult === 'error' &&
      this._uiPhase === this._failedPhase &&
      now - this._uiPhaseSince >= SyncProgressDialogComponent.MIN_PHASE_DURATION_MS
    ) {
      this.displayResult();
      return;
    }

    // go to the next phase once the current one was displayed long enough
    if (
      this._uiPhase < this._serverPhase &&
      (this._pendingResult !== 'error' || this._uiPhase < this._failedPhase) &&
      now - this._uiPhaseSince >= SyncProgressDialogComponent.MIN_PHASE_DURATION_MS
    ) {
      this._uiPhase++;
      this._uiPhaseSince = now;

      // finished with success
      if (this._uiPhase === SyncPhase.DONE) {
        this.displayResult();
        return;
      }

      this.updateSteps();
    }

    // creep towards the end of the phase interval; it never reaches it until the phase finishes
    const [from, to] = SyncProgressDialogComponent.PHASE_PROGRESS[this._uiPhase];
    const elapsed: number = now - this._uiPhaseSince;
    const target: number = from + (to - from) * (1 - Math.exp(-elapsed / 4000));
    this.percent = Math.max(this.percent, target);

    this.changeDetectorRef.markForCheck();
  }

  /**
   * Update the status of each step from the displayed phase
   */
  private updateSteps(): void {
    const stepPhases: {
      [key: string]: [SyncPhase, SyncPhase]
    } = {
      connect: [SyncPhase.CONNECT, SyncPhase.CONNECT],
      credentials: [SyncPhase.CREDENTIALS, SyncPhase.CREDENTIALS],
      sync: [SyncPhase.EXPORT, SyncPhase.IMPORT],
      final: [SyncPhase.DONE, SyncPhase.DONE]
    };
    this.steps.forEach((step) => {
      const [first, last] = stepPhases[step.key];
      if (this._uiPhase > last) {
        step.status = 'success';
      } else if (this._uiPhase >= first) {
        step.status = 'running';
        this.currentStep = step;
      } else {
        step.status = 'pending';
      }
    });

    // what is being done
    switch (this._uiPhase) {
      case SyncPhase.CONNECT:
        this.phaseMessage = 'LNG_SYNC_PROGRESS_DIALOG_PHASE_CONNECT';
        break;
      case SyncPhase.CREDENTIALS:
        this.phaseMessage = 'LNG_SYNC_PROGRESS_DIALOG_PHASE_CREDENTIALS';
        break;
      case SyncPhase.EXPORT:
        this.phaseMessage = 'LNG_SYNC_PROGRESS_DIALOG_PHASE_EXPORT';
        break;
      case SyncPhase.SEND:
        this.phaseMessage = 'LNG_SYNC_PROGRESS_DIALOG_PHASE_SEND';
        break;
      case SyncPhase.IMPORT:
        this.phaseMessage = 'LNG_SYNC_PROGRESS_DIALOG_PHASE_IMPORT';
        break;
    }
  }

  /**
   * Display the final status
   */
  private displayResult(): void {
    this.finished = true;
    this.result = this._pendingResult;

    if (this.result === 'error') {
      // the step that failed stays with its error illustration; the following ones weren't executed
      const failedStep: ISyncStep = this.steps.find((step) => step.status === 'running') || this.steps[0];
      failedStep.status = 'error';
      this.currentStep = failedStep;
      this.steps[this.steps.length - 1].status = 'error';
    } else {
      this.percent = 100;
      this.steps.forEach((step) => step.status = 'success');
      this.currentStep = this.steps[this.steps.length - 1];
    }

    this.changeDetectorRef.markForCheck();
  }

  /**
   * Message of an api error
   */
  private getApiErrorMessage(err: any): string {
    const token: string = `LNG_API_ERROR_CODE_${err?.code || 'UNKNOWN_ERROR'}`;
    const message: string = this.i18nService.instant(token, err?.details);
    return message !== token ?
      message :
      this.i18nService.instant('LNG_API_ERROR_CODE_UNKNOWN_ERROR');
  }
}
