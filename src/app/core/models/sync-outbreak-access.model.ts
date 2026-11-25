import * as _ from 'lodash';

/**
 * Decision about an outbreak another Go.Data instance asked to send
 * Note: must match the api (components/syncOutbreakAccess)
 */
export enum SyncOutbreakAccessStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REFUSED = 'REFUSED',
  PAUSED = 'PAUSED'
}

/**
 * Receiver - outbreak another instance asked to send
 */
export class SyncOutbreakAccessModel {
  id: string;
  clientId: string;
  sourceOutbreakId: string;
  sourceOutbreakName: string;
  sourceDisease: string;
  sourceStartDate: string;
  sourceCasesCount: number;
  sourceContactsCount: number;
  sameIdOutbreak: boolean;
  mappingId: string;
  status: SyncOutbreakAccessStatus;
  autoAccepted: boolean;
  requestedAt: string;
  decidedAt: string;

  /**
   * Constructor
   */
  constructor(data = null) {
    this.id = _.get(data, 'id');
    this.clientId = _.get(data, 'clientId');
    this.sourceOutbreakId = _.get(data, 'sourceOutbreakId');
    this.sourceOutbreakName = _.get(data, 'sourceOutbreakName');
    this.sourceDisease = _.get(data, 'sourceDisease');
    this.sourceStartDate = _.get(data, 'sourceStartDate');
    this.sourceCasesCount = _.get(data, 'sourceCasesCount');
    this.sourceContactsCount = _.get(data, 'sourceContactsCount');
    this.sameIdOutbreak = _.get(data, 'sameIdOutbreak', false);
    this.mappingId = _.get(data, 'mappingId');
    this.status = _.get(data, 'status', SyncOutbreakAccessStatus.PENDING);
    this.autoAccepted = _.get(data, 'autoAccepted', false);
    this.requestedAt = _.get(data, 'requestedAt');
    this.decidedAt = _.get(data, 'decidedAt');
  }
}

/**
 * Receiver - number of received outbreaks waiting for the user
 */
export interface ISyncOutbreakAccessWaitingCount {
  // outbreaks other instances asked to send
  requests: number;

  // received outbreaks whose questions must be reviewed (or received without a request)
  reviews: number;

  total: number;
}

/**
 * Sender - decision of an upstream server about an outbreak of this instance
 */
export interface IUpstreamOutbreakAccessOutbreak {
  outbreakId: string;
  name: string;
  status: SyncOutbreakAccessStatus;
  decidedAt?: string;
}

/**
 * Sender - decisions of an upstream server
 */
export class UpstreamOutbreakAccessModel {
  id: string;
  upstreamServerUrl: string;

  // request: the upstream server decides which outbreaks it receives; legacy: older version / key of the mobile app
  mode: 'request' | 'legacy';
  outbreaks: IUpstreamOutbreakAccessOutbreak[];
  checkedAt: string;
  requestedAt: string;
  error: string;

  /**
   * Constructor
   */
  constructor(data = null) {
    this.id = _.get(data, 'id');
    this.upstreamServerUrl = _.get(data, 'upstreamServerUrl');
    this.mode = _.get(data, 'mode');
    this.outbreaks = _.get(data, 'outbreaks') || [];
    this.checkedAt = _.get(data, 'checkedAt');
    this.requestedAt = _.get(data, 'requestedAt');
    this.error = _.get(data, 'error');
  }

  /**
   * Outbreaks with a status
   */
  outbreaksWithStatus(status: SyncOutbreakAccessStatus): IUpstreamOutbreakAccessOutbreak[] {
    return this.outbreaks.filter((outbreak) => outbreak.status === status);
  }
}
