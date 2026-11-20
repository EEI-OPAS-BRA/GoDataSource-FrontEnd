import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';
import { Subject, throwError } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import {
  ISyncOutbreakMappingDetails,
  ISyncOutbreakMappingQuestion,
  ISyncOutbreakMappingQuestionMappings,
  ISyncOutbreakMappingQuestionnaires,
  SYNC_OUTBREAK_MAPPING_CHOICE_ANSWER_TYPES,
  SYNC_OUTBREAK_MAPPING_QUESTIONNAIRES,
  SyncOutbreakMappingMode
} from '../../../../core/models/sync-outbreak-mapping.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { SyncOutbreakMappingDataService } from '../../../../core/services/data/sync-outbreak-mapping.data.service';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IV2BottomDialogConfigButtonType } from '../../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';
import { IV2Breadcrumb } from '../../../../shared/components-v2/app-breadcrumb-v2/models/breadcrumb.model';

/**
 * Decision for a received question / answer being edited
 * undefined - not decided yet; IGNORE - ignored (stays blank); other - question / answer of this instance
 */
interface IQuestionDecision {
  target: string;
  answers: {
    [sourceValue: string]: string
  };
}

/**
 * Questionnaire tab
 */
interface IQuestionnaireTab {
  key: string;
  label: string;
  questions: ISyncOutbreakMappingQuestion[];
}

@Component({
  selector: 'app-sync-outbreak-mapping-edit',
  templateUrl: './sync-outbreak-mapping-edit.component.html',
  styleUrls: ['./sync-outbreak-mapping-edit.component.scss']
})
export class SyncOutbreakMappingEditComponent implements OnInit, OnDestroy {
  // value of an ignored question / answer in the dropdowns
  static readonly IGNORE: string = '__ignore__';

  // labels of the questionnaires
  private static readonly QUESTIONNAIRE_LABELS: {
    [questionnaire: string]: string
  } = {
      caseInvestigationTemplate: 'LNG_OUTBREAK_FIELD_LABEL_CASE_INVESTIGATION_TEMPLATE',
      contactInvestigationTemplate: 'LNG_OUTBREAK_FIELD_LABEL_CONTACT_INVESTIGATION_TEMPLATE',
      eventInvestigationTemplate: 'LNG_OUTBREAK_FIELD_LABEL_EVENT_INVESTIGATION_TEMPLATE',
      caseFollowUpTemplate: 'LNG_OUTBREAK_FIELD_LABEL_CASE_FOLLOWUP_TEMPLATE',
      contactFollowUpTemplate: 'LNG_OUTBREAK_FIELD_LABEL_CONTACT_FOLLOWUP_TEMPLATE',
      labResultsTemplate: 'LNG_OUTBREAK_FIELD_LABEL_LAB_RESULTS_TEMPLATE'
    };

  // used by the template
  readonly IGNORE: string = SyncOutbreakMappingEditComponent.IGNORE;

  // breadcrumbs
  breadcrumbs: IV2Breadcrumb[] = [];

  // data
  loading: boolean = true;
  loadingTarget: boolean = false;
  details: ISyncOutbreakMappingDetails;
  tabs: IQuestionnaireTab[] = [];
  targetQuestionnaires: ISyncOutbreakMappingQuestionnaires = {};
  private _targetQuestionsMap: {
    [questionnaire: string]: {
      [variable: string]: ISyncOutbreakMappingQuestion
    }
  } = {};

  // what the user chose
  mode: SyncOutbreakMappingMode = 'map';
  targetOutbreakId: string;
  decisions: {
    [questionnaire: string]: {
      [sourceVariable: string]: IQuestionDecision
    }
  } = {};
  onlyPending: boolean = false;

  // received questions that are new since the last approval
  private _newQuestions: {
    [key: string]: true
  } = {};

  // user
  readOnly: boolean = true;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private authDataService: AuthDataService,
    private syncOutbreakMappingDataService: SyncOutbreakMappingDataService,
    private toastV2Service: ToastV2Service,
    private dialogV2Service: DialogV2Service,
    private i18nService: I18nService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  /**
   * Initialized
   */
  ngOnInit(): void {
    const authUser: UserModel = this.authDataService.getAuthenticatedUser();
    this.readOnly = !SystemClientApplicationModel.canModify(authUser);
    this.initializeBreadcrumbs(authUser);

    this.syncOutbreakMappingDataService
      .getMappingDetails(this.activatedRoute.snapshot.params.mappingId)
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          this.router.navigate(['/system-config/sync-outbreak-mappings']);
          return throwError(err);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe((details) => {
        this.details = details;
        this.initializeBreadcrumbs(authUser);

        // questionnaires that have questions
        this.tabs = SYNC_OUTBREAK_MAPPING_QUESTIONNAIRES
          .filter((questionnaire) => details.sourceQuestionnaires[questionnaire]?.length > 0)
          .map((questionnaire) => ({
            key: questionnaire,
            label: SyncOutbreakMappingEditComponent.QUESTIONNAIRE_LABELS[questionnaire],
            questions: details.sourceQuestionnaires[questionnaire]
          }));

        // new questions
        details.mapping.pendingQuestions.forEach((question) => {
          this._newQuestions[`${question.questionnaire}.${question.variable}`] = true;
        });

        // what was decided before
        this.mode = details.mapping.mode || 'map';
        this.decisions = this.decisionsFromMappings(details.mapping.questionMappings);
        this.loading = false;

        if (details.mapping.targetOutbreakId) {
          this.changeTargetOutbreak(details.mapping.targetOutbreakId, true);
        }
      });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  /**
   * Breadcrumbs
   */
  private initializeBreadcrumbs(authUser: UserModel): void {
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_LAYOUT_MENU_ITEM_SYNC_OUTBREAK_MAPPINGS_LABEL',
        action: {
          link: ['/system-config/sync-outbreak-mappings']
        }
      }, {
        label: this.details?.mapping.sourceOutbreakName || 'LNG_PAGE_SYNC_OUTBREAK_MAPPING_TITLE',
        action: null
      }
    ];
  }

  /**
   * Decisions from the saved mappings
   */
  private decisionsFromMappings(questionMappings: ISyncOutbreakMappingQuestionMappings): {
    [questionnaire: string]: {
      [sourceVariable: string]: IQuestionDecision
    }
  } {
    const result = {};
    SYNC_OUTBREAK_MAPPING_QUESTIONNAIRES.forEach((questionnaire) => {
      result[questionnaire] = {};
      _.each(questionMappings?.[questionnaire] || {}, (questionMapping, sourceVariable) => {
        const answers = {};
        _.each(questionMapping.answers || {}, (targetValue, sourceValue) => {
          answers[sourceValue] = targetValue === null ? this.IGNORE : targetValue;
        });
        result[questionnaire][sourceVariable] = {
          target: questionMapping.targetVariable === null ? this.IGNORE : questionMapping.targetVariable,
          answers
        };
      });
    });
    return result;
  }

  /**
   * The outbreak of this instance changed
   */
  changeTargetOutbreak(outbreakId: string, keepDecisions?: boolean): void {
    this.targetOutbreakId = outbreakId;
    this.targetQuestionnaires = {};
    this._targetQuestionsMap = {};
    if (!outbreakId) {
      return;
    }

    this.loadingTarget = true;
    this.syncOutbreakMappingDataService
      .getTargetQuestionnaires(outbreakId)
      .pipe(
        catchError((err) => {
          this.loadingTarget = false;
          this.toastV2Service.error(err);
          return throwError(err);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe((questionnaires) => {
        this.targetQuestionnaires = questionnaires;
        SYNC_OUTBREAK_MAPPING_QUESTIONNAIRES.forEach((questionnaire) => {
          this._targetQuestionsMap[questionnaire] = _.keyBy(questionnaires[questionnaire] || [], 'variable');
        });

        // decisions about questions that don't exist in this outbreak don't apply
        SYNC_OUTBREAK_MAPPING_QUESTIONNAIRES.forEach((questionnaire) => {
          _.each(this.decisions[questionnaire], (decision, sourceVariable) => {
            if (
              !keepDecisions ||
              (decision.target && decision.target !== this.IGNORE && !this._targetQuestionsMap[questionnaire][decision.target])
            ) {
              delete this.decisions[questionnaire][sourceVariable];
            }
          });
        });

        this.loadingTarget = false;
        this.changeDetectorRef.markForCheck();
      });
  }

  /**
   * Decision for a question
   */
  getDecision(questionnaire: string, variable: string): IQuestionDecision {
    if (!this.decisions[questionnaire]) {
      this.decisions[questionnaire] = {};
    }
    if (!this.decisions[questionnaire][variable]) {
      this.decisions[questionnaire][variable] = {
        target: undefined,
        answers: {}
      };
    }
    return this.decisions[questionnaire][variable];
  }

  /**
   * The question of this instance changed
   */
  changeTargetQuestion(questionnaire: string, sourceQuestion: ISyncOutbreakMappingQuestion, target: string): void {
    const decision = this.getDecision(questionnaire, sourceQuestion.variable);
    decision.target = target;
    decision.answers = {};

    // options with the same value / text are mapped automatically
    const targetQuestion = this.getTargetQuestion(questionnaire, target);
    if (this.hasAnswersMapping(sourceQuestion, targetQuestion)) {
      this.suggestAnswers(sourceQuestion, targetQuestion, decision);
    }
  }

  /**
   * Question of this instance
   */
  getTargetQuestion(questionnaire: string, variable: string): ISyncOutbreakMappingQuestion {
    return variable && variable !== this.IGNORE ?
      this._targetQuestionsMap[questionnaire]?.[variable] :
      undefined;
  }

  /**
   * Whether a question has options
   */
  isChoice(question: ISyncOutbreakMappingQuestion): boolean {
    return !!question && SYNC_OUTBREAK_MAPPING_CHOICE_ANSWER_TYPES.includes(question.answerType);
  }

  /**
   * The options must be mapped
   */
  hasAnswersMapping(sourceQuestion: ISyncOutbreakMappingQuestion, targetQuestion: ISyncOutbreakMappingQuestion): boolean {
    return this.isChoice(sourceQuestion) && this.isChoice(targetQuestion);
  }

  /**
   * Whether the user still needs to decide something about a question
   */
  isPending(questionnaire: string, sourceQuestion: ISyncOutbreakMappingQuestion): boolean {
    const decision = this.decisions[questionnaire]?.[sourceQuestion.variable];
    if (!decision || !decision.target) {
      return true;
    }

    if (decision.target === this.IGNORE) {
      return false;
    }

    // a question that doesn't exist anymore must be chosen again
    const targetQuestion = this.getTargetQuestion(questionnaire, decision.target);
    if (!targetQuestion) {
      return true;
    }

    // options
    return this.isChoice(sourceQuestion) && sourceQuestion.answers.some((answer) => !decision.answers[answer.value]);
  }

  /**
   * Received question that is new since the last approval
   */
  isNewQuestion(questionnaire: string, variable: string): boolean {
    return !!this._newQuestions[`${questionnaire}.${variable}`];
  }

  /**
   * Number of questions the user still needs to decide
   */
  getPendingCount(tab: IQuestionnaireTab): number {
    return tab.questions.filter((question) => this.isPending(tab.key, question)).length;
  }

  /**
   * Total number of questions the user still needs to decide
   */
  get totalPending(): number {
    return this.tabs.reduce((total, tab) => total + this.getPendingCount(tab), 0);
  }

  /**
   * Questions displayed in a tab
   */
  getVisibleQuestions(tab: IQuestionnaireTab): ISyncOutbreakMappingQuestion[] {
    return this.onlyPending ?
      tab.questions.filter((question) => this.isPending(tab.key, question)) :
      tab.questions;
  }

  /**
   * Whether the mapping can be approved
   */
  get canApprove(): boolean {
    if (this.readOnly || !this.details) {
      return false;
    }

    return this.mode === 'new' || (
      !!this.targetOutbreakId &&
      !this.loadingTarget &&
      this.totalPending === 0
    );
  }

  /**
   * Text used to compare questions & answers
   */
  private normalize(text: string): string {
    return (text || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Map the options with the same value / text
   */
  private suggestAnswers(sourceQuestion: ISyncOutbreakMappingQuestion, targetQuestion: ISyncOutbreakMappingQuestion, decision: IQuestionDecision): void {
    sourceQuestion.answers.forEach((sourceAnswer) => {
      if (decision.answers[sourceAnswer.value]) {
        return;
      }

      const targetAnswer = targetQuestion.answers.find((answer) => answer.value === sourceAnswer.value) ||
        targetQuestion.answers.find((answer) => this.normalize(answer.labelTranslated) === this.normalize(sourceAnswer.labelTranslated));
      if (targetAnswer) {
        decision.answers[sourceAnswer.value] = targetAnswer.value;
      }
    });
  }

  /**
   * Map the questions (and options) with the same variable / text that weren't decided yet
   */
  suggest(): void {
    let suggested: number = 0;
    this.tabs.forEach((tab) => {
      const targetQuestions = this.targetQuestionnaires[tab.key] || [];
      tab.questions.forEach((sourceQuestion) => {
        const decision = this.getDecision(tab.key, sourceQuestion.variable);

        // question
        if (!decision.target) {
          const targetQuestion = targetQuestions.find((question) => question.variable === sourceQuestion.variable) ||
            targetQuestions.find((question) => this.normalize(question.textTranslated) === this.normalize(sourceQuestion.textTranslated));
          if (targetQuestion) {
            decision.target = targetQuestion.variable;
            suggested++;
          }
        }

        // options
        const targetQuestion = this.getTargetQuestion(tab.key, decision.target);
        if (this.hasAnswersMapping(sourceQuestion, targetQuestion)) {
          this.suggestAnswers(sourceQuestion, targetQuestion, decision);
        }
      });
    });

    this.toastV2Service.notice(
      'LNG_PAGE_SYNC_OUTBREAK_MAPPING_SUGGEST_RESULT', {
        count: suggested.toString()
      }
    );
  }

  /**
   * Ignore every question that wasn't decided yet in a tab
   */
  ignoreRemaining(tab: IQuestionnaireTab): void {
    tab.questions.forEach((sourceQuestion) => {
      const decision = this.getDecision(tab.key, sourceQuestion.variable);
      if (!decision.target) {
        decision.target = this.IGNORE;
        decision.answers = {};
      } else if (decision.target !== this.IGNORE && this.isChoice(sourceQuestion)) {
        sourceQuestion.answers.forEach((answer) => {
          if (!decision.answers[answer.value]) {
            decision.answers[answer.value] = this.IGNORE;
          }
        });
      }
    });
  }

  /**
   * Mappings sent to the api
   */
  private buildQuestionMappings(): ISyncOutbreakMappingQuestionMappings {
    const result: ISyncOutbreakMappingQuestionMappings = {};
    this.tabs.forEach((tab) => {
      result[tab.key] = {};
      tab.questions.forEach((sourceQuestion) => {
        const decision = this.decisions[tab.key]?.[sourceQuestion.variable];
        if (!decision?.target) {
          return;
        }

        if (decision.target === this.IGNORE) {
          result[tab.key][sourceQuestion.variable] = {
            targetVariable: null
          };
          return;
        }

        const answers = {};
        if (this.isChoice(sourceQuestion)) {
          sourceQuestion.answers.forEach((answer) => {
            const targetValue = decision.answers[answer.value];
            if (targetValue) {
              answers[answer.value] = targetValue === this.IGNORE ? null : targetValue;
            }
          });
        }
        result[tab.key][sourceQuestion.variable] = {
          targetVariable: decision.target,
          answers
        };
      });
    });
    return result;
  }

  /**
   * Approve the mapping & import the records that were waiting for it
   */
  approve(): void {
    if (!this.canApprove) {
      return;
    }

    this.dialogV2Service
      .showConfirmDialog({
        config: {
          title: {
            get: () => 'LNG_PAGE_SYNC_OUTBREAK_MAPPING_APPROVE_DIALOG_TITLE'
          },
          message: {
            get: () => 'LNG_PAGE_SYNC_OUTBREAK_MAPPING_APPROVE_DIALOG_MESSAGE',
            data: () => ({
              count: (this.details.stagedRecordsCount || 0).toString()
            })
          }
        }
      })
      .subscribe((response) => {
        if (response.button.type === IV2BottomDialogConfigButtonType.CANCEL) {
          return;
        }

        const loading = this.dialogV2Service.showLoadingDialog();
        this.syncOutbreakMappingDataService
          .approveMapping(
            this.details.mapping.id,
            this.mode === 'new' ? {
              mode: 'new'
            } : {
              mode: 'map',
              targetOutbreakId: this.targetOutbreakId,
              questionMappings: this.buildQuestionMappings()
            }
          )
          .pipe(
            catchError((err) => {
              loading.close();
              this.toastV2Service.error(err);
              return throwError(err);
            }),
            takeUntil(this._destroyed$)
          )
          .subscribe((result) => {
            loading.close();
            if (result.failed?.length) {
              this.toastV2Service.error(
                'LNG_PAGE_SYNC_OUTBREAK_MAPPING_APPROVE_PARTIAL_MESSAGE', {
                  imported: result.imported.toString(),
                  failed: result.failed.length.toString()
                },
                undefined,
                result.failed.join('\n')
              );
            } else {
              this.toastV2Service.success(
                'LNG_PAGE_SYNC_OUTBREAK_MAPPING_APPROVE_SUCCESS_MESSAGE', {
                  count: result.imported.toString()
                }
              );
            }
            this.router.navigate(['/system-config/sync-outbreak-mappings']);
          });
      });
  }

  /**
   * Text of a question of this instance in the dropdown
   */
  getQuestionLabel(question: ISyncOutbreakMappingQuestion): string {
    return `${'— '.repeat(question.depth)}${question.textTranslated}`;
  }

  /**
   * Translated name of the type of a question
   */
  getAnswerTypeLabel(question: ISyncOutbreakMappingQuestion): string {
    return question.answerType ?
      this.i18nService.instant(question.answerType) :
      '';
  }

  /**
   * Track by
   */
  trackByVariable(_index: number, question: ISyncOutbreakMappingQuestion): string {
    return question.variable;
  }
}
