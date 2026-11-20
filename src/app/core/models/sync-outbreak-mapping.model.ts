import * as _ from 'lodash';

/**
 * Questionnaires of an outbreak
 * Note: must match the api (components/syncOutbreakMapping.js)
 */
export const SYNC_OUTBREAK_MAPPING_QUESTIONNAIRES: string[] = [
  'caseInvestigationTemplate',
  'contactInvestigationTemplate',
  'eventInvestigationTemplate',
  'caseFollowUpTemplate',
  'contactFollowUpTemplate',
  'labResultsTemplate'
];

/**
 * Answer types that have options
 */
export const SYNC_OUTBREAK_MAPPING_CHOICE_ANSWER_TYPES: string[] = [
  'LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER',
  'LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS'
];

export type SyncOutbreakMappingStatus = 'PENDING' | 'APPROVED' | 'REVIEW';
export type SyncOutbreakMappingMode = 'map' | 'new';

/**
 * Question of a questionnaire, as a flat list item
 */
export interface ISyncOutbreakMappingQuestion {
  variable: string;
  text: string;
  textTranslated: string;
  answerType: string;
  multiAnswer: boolean;
  answers: {
    value: string,
    label: string,
    labelTranslated: string
  }[];
  depth: number;
  parentVariable: string;
}

/**
 * Questionnaires as flat lists
 */
export interface ISyncOutbreakMappingQuestionnaires {
  [questionnaire: string]: ISyncOutbreakMappingQuestion[];
}

/**
 * Received question => question of this instance (null means ignored) & its answers (null means ignored)
 */
export interface ISyncOutbreakMappingQuestionMappings {
  [questionnaire: string]: {
    [sourceVariable: string]: {
      targetVariable: string | null,
      answers?: {
        [sourceValue: string]: string | null
      }
    }
  };
}

/**
 * Mapping of an outbreak received from another instance to an outbreak of this instance
 */
export class SyncOutbreakMappingModel {
  id: string;
  clientId: string;
  sourceOutbreakId: string;
  sourceOutbreakName: string;
  sourceQuestionnaires: ISyncOutbreakMappingQuestionnaires;
  mode: SyncOutbreakMappingMode;
  targetOutbreakId: string;
  questionMappings: ISyncOutbreakMappingQuestionMappings;
  status: SyncOutbreakMappingStatus;
  pendingQuestions: {
    questionnaire: string,
    variable: string
  }[];
  approvedAt: string;
  updatedAt: string;

  /**
   * Constructor
   */
  constructor(data = null) {
    this.id = _.get(data, 'id');
    this.clientId = _.get(data, 'clientId');
    this.sourceOutbreakId = _.get(data, 'sourceOutbreakId');
    this.sourceOutbreakName = _.get(data, 'sourceOutbreakName');
    this.sourceQuestionnaires = _.get(data, 'sourceQuestionnaires') || {};
    this.mode = _.get(data, 'mode');
    this.targetOutbreakId = _.get(data, 'targetOutbreakId');
    this.questionMappings = _.get(data, 'questionMappings') || {};
    this.status = _.get(data, 'status');
    this.pendingQuestions = _.get(data, 'pendingQuestions') || [];
    this.approvedAt = _.get(data, 'approvedAt');
    this.updatedAt = _.get(data, 'updatedAt');
  }
}

/**
 * What is needed to map a received outbreak
 */
export interface ISyncOutbreakMappingDetails {
  mapping: SyncOutbreakMappingModel;
  sourceQuestionnaires: ISyncOutbreakMappingQuestionnaires;
  outbreaks: {
    id: string,
    name: string
  }[];
  clientApplication: {
    id: string,
    name: string
  } | null;
  stagedRecordsCount: number;
}

/**
 * Result of the approval
 */
export interface ISyncOutbreakMappingApproveResult {
  mapping: SyncOutbreakMappingModel;
  imported: number;
  failed: string[];
}
