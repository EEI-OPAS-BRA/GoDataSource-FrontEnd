import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import * as _ from 'lodash';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SyncOutbreakAccessModel, SyncOutbreakAccessStatus } from '../../../../core/models/sync-outbreak-access.model';
import { SyncOutbreakMappingModel } from '../../../../core/models/sync-outbreak-mapping.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { UserModel } from '../../../../core/models/user.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { OutbreakDataService } from '../../../../core/services/data/outbreak.data.service';
import { ClientApplicationDataService } from '../../../../core/services/data/client-application.data.service';
import { SyncOutbreakAccessDataService } from '../../../../core/services/data/sync-outbreak-access.data.service';
import { SyncOutbreakMappingDataService } from '../../../../core/services/data/sync-outbreak-mapping.data.service';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { SyncReviewCountService } from '../../../../core/services/helper/sync-review-count.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { LocalizationHelper } from '../../../../core/helperClasses/localization-helper';
import { IV2BottomDialogConfigButtonType } from '../../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';

/**
 * Where the data of a received outbreak goes
 * - same: into the outbreak of this instance with the same id
 * - map: into another outbreak of this instance (approved review)
 * - new: imported as a new outbreak (approved review)
 * - undefined: the review wasn't approved yet
 */
type RequestDestination = 'same' | 'map' | 'new' | 'undefined';

/**
 * Decisions about an outbreak, besides accepting it
 */
type RequestAction = 'refuse' | 'pause' | 'resume' | 'remove';

/**
 * Received outbreak as displayed: asked by another instance (access) and / or with a review of where its data goes (mapping)
 */
interface IRequestItem {
  access?: SyncOutbreakAccessModel;
  mapping?: SyncOutbreakMappingModel;
  name: string;
  clientName: string;
  destination: RequestDestination;
  targetOutbreakName?: string;
  requestedAt?: string;
  decidedAt?: string;
  updatedAt?: string;
  pendingCount: number;

  // an action is in progress
  busy?: boolean;
}

/**
 * Received outbreaks: requests of other instances & reviews of where the received data goes
 * - inbox: only what waits for the user, of all the clients
 * - client: all the outbreaks of one client (accepted, paused, refused included)
 */
@Component({
  selector: 'app-sync-outbreak-requests',
  templateUrl: './sync-outbreak-requests.component.html',
  styleUrls: ['./sync-outbreak-requests.component.scss']
})
export class SyncOutbreakRequestsComponent implements OnChanges, OnDestroy {
  // only what waits for the user, of all the clients
  @Input() inbox: boolean = false;

  // only the outbreaks of a client (client id of its key)
  @Input() clientId: string;

  // number of outbreaks waiting for the user (to be asked / reviewed), after each load
  @Output() waitingChange: EventEmitter<number> = new EventEmitter<number>();

  // data
  loading: boolean = true;
  waitingItems: IRequestItem[] = [];
  reviewItems: IRequestItem[] = [];
  acceptedItems: IRequestItem[] = [];
  pausedItems: IRequestItem[] = [];
  refusedItems: IRequestItem[] = [];

  // user
  canModify: boolean = false;

  // statuses
  readonly Status = SyncOutbreakAccessStatus;

  // release subscriptions
  private _destroyed$: Subject<void> = new Subject<void>();

  /**
   * Constructor
   */
  constructor(
    private authDataService: AuthDataService,
    private outbreakDataService: OutbreakDataService,
    private syncOutbreakMappingDataService: SyncOutbreakMappingDataService,
    private syncOutbreakAccessDataService: SyncOutbreakAccessDataService,
    private clientApplicationDataService: ClientApplicationDataService,
    private dialogV2Service: DialogV2Service,
    private syncReviewCountService: SyncReviewCountService,
    private toastV2Service: ToastV2Service
  ) {}

  /**
   * Inputs changed
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.inbox ||
      changes.clientId
    ) {
      const authUser: UserModel = this.authDataService.getAuthenticatedUser();
      this.canModify = SystemClientApplicationModel.canModify(authUser);
      this.load();
    }
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  /**
   * Accept an outbreak that exists here with the same id, or whose review was already approved
   */
  accept(item: IRequestItem): void {
    item.busy = true;
    this.syncOutbreakAccessDataService
      .accept(item.access.id)
      .pipe(
        catchError((err) => {
          item.busy = false;
          this.toastV2Service.error(err);
          return of(undefined);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe((access) => {
        if (!access) {
          return;
        }
        this.toastV2Service.success(
          'LNG_PAGE_SYNC_OUTBREAK_REQUESTS_ACCEPT_SUCCESS', {
            name: item.name
          }
        );
        this.reload();
      });
  }

  /**
   * Refuse / pause / resume / remove the decision about an outbreak
   * The actions that stop receiving data are confirmed first
   */
  decide(
    item: IRequestItem,
    action: RequestAction
  ): void {
    const texts: string = action.toUpperCase();
    const run = () => {
      item.busy = true;
      this.syncOutbreakAccessDataService[action](item.access.id)
        .pipe(
          catchError((err) => {
            item.busy = false;
            this.toastV2Service.error(err);
            return of(undefined);
          }),
          takeUntil(this._destroyed$)
        )
        .subscribe((access) => {
          if (!access) {
            return;
          }
          this.toastV2Service.success(
            `LNG_PAGE_SYNC_OUTBREAK_REQUESTS_${texts}_SUCCESS`, {
              name: item.name
            }
          );
          this.reload();
        });
    };

    // receives the data again: nothing to confirm
    if (action === 'resume') {
      run();
      return;
    }

    this.dialogV2Service
      .showConfirmDialog({
        config: {
          title: {
            get: () => `LNG_PAGE_SYNC_OUTBREAK_REQUESTS_${texts}_TITLE`,
            data: () => ({
              name: item.name
            })
          },
          message: {
            get: () => `LNG_PAGE_SYNC_OUTBREAK_REQUESTS_${texts}_MESSAGE`,
            data: () => ({
              name: item.name,
              client: item.clientName
            })
          }
        }
      })
      .subscribe((response) => {
        // canceled ?
        if (response.button.type === IV2BottomDialogConfigButtonType.CANCEL) {
          return;
        }
        run();
      });
  }

  /**
   * Can the outbreak be accepted without a review ?
   */
  canAcceptDirectly(item: IRequestItem): boolean {
    return item.destination !== 'undefined';
  }

  /**
   * Number of cases / contacts as text
   */
  hasCounts(item: IRequestItem): boolean {
    return !!item.access &&
      item.access.status === SyncOutbreakAccessStatus.PENDING && (
      _.isNumber(item.access.sourceCasesCount) ||
      _.isNumber(item.access.sourceContactsCount)
    );
  }

  /**
   * Item tracking
   */
  trackByItem(_index: number, item: IRequestItem): string {
    return item.access ? item.access.id : item.mapping.id;
  }

  /**
   * Reload the data & the numbers of the menu
   */
  private reload(): void {
    this.syncReviewCountService.refresh(true);
    this.load();
  }

  /**
   * Retrieve the data
   */
  private load(): void {
    forkJoin([
      this.syncOutbreakMappingDataService.getMappingsList(),
      this.syncOutbreakAccessDataService
        .getAccessList()
        .pipe(
          // older api: only the reviews
          catchError(() => of([]))
        ),
      this.clientApplicationDataService
        .getClientApplicationsList()
        .pipe(
          // the names are only a convenience
          catchError(() => of([]))
        ),
      this.outbreakDataService
        .getOutbreaksListReduced()
        .pipe(
          // the names are only a convenience
          catchError(() => of([]))
        )
    ] as Observable<any>[])
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return of([[], [], [], []]);
        }),
        takeUntil(this._destroyed$)
      )
      .subscribe(([allMappings, allAccesses, clientApplications, outbreaks]: [SyncOutbreakMappingModel[], SyncOutbreakAccessModel[], SystemClientApplicationModel[], OutbreakModel[]]) => {
        // only the outbreaks of a client ?
        const mappings: SyncOutbreakMappingModel[] = this.clientId ?
          allMappings.filter((mapping) => mapping.clientId === this.clientId) :
          allMappings;
        const accesses: SyncOutbreakAccessModel[] = this.clientId ?
          allAccesses.filter((access) => access.clientId === this.clientId) :
          allAccesses;

        // outbreaks of this instance
        const outbreaksMap: {
          [outbreakId: string]: OutbreakModel
        } = {};
        outbreaks.forEach((outbreak) => {
          outbreaksMap[outbreak.id] = outbreak;
        });

        // client names
        const clientNames: {
          [clientId: string]: string
        } = {};
        clientApplications.forEach((clientApplication) => {
          clientNames[clientApplication.credentials?.clientId] = clientApplication.name;
        });

        // reviews of each received outbreak
        const mappingsByOutbreak: {
          [key: string]: SyncOutbreakMappingModel
        } = {};
        mappings.forEach((mapping) => {
          mappingsByOutbreak[`${mapping.clientId}|${mapping.sourceOutbreakId}`] = mapping;
        });

        // item
        const toItem = (
          access: SyncOutbreakAccessModel,
          mapping: SyncOutbreakMappingModel
        ): IRequestItem => {
          // where the data goes
          let destination: RequestDestination = 'undefined';
          if (mapping && mapping.status !== 'PENDING' && mapping.mode) {
            destination = mapping.mode === 'new' ? 'new' : 'map';
          } else if (!mapping && access?.sameIdOutbreak) {
            destination = 'same';
          }

          const clientId: string = access ? access.clientId : mapping.clientId;
          return {
            access,
            mapping,
            name: (access && access.sourceOutbreakName) || (mapping && mapping.sourceOutbreakName),
            clientName: clientNames[clientId] || clientId,
            destination,
            targetOutbreakName: destination === 'map' ?
              (outbreaksMap[mapping.targetOutbreakId]?.name || mapping.targetOutbreakId) :
              (destination === 'same' ? (outbreaksMap[access.sourceOutbreakId]?.name || access.sourceOutbreakName) : undefined),
            requestedAt: access?.requestedAt ? LocalizationHelper.displayDateTime(access.requestedAt) : undefined,
            decidedAt: access?.decidedAt ? LocalizationHelper.displayDateTime(access.decidedAt) : undefined,
            updatedAt: mapping?.updatedAt ? LocalizationHelper.displayDateTime(mapping.updatedAt) : undefined,
            pendingCount: mapping ? mapping.pendingQuestions.length : 0
          };
        };

        // outbreaks asked by other instances
        const requested: {
          [key: string]: boolean
        } = {};
        const accessItems: IRequestItem[] = accesses.map((access) => {
          const key: string = `${access.clientId}|${access.sourceOutbreakId}`;
          requested[key] = true;
          return toItem(access, mappingsByOutbreak[key]);
        });

        // outbreaks received without a request (older instances / keys)
        const legacyItems: IRequestItem[] = mappings
          .filter((mapping) => !requested[`${mapping.clientId}|${mapping.sourceOutbreakId}`])
          .map((mapping) => toItem(undefined, mapping));

        // sections
        const byName = (a: IRequestItem, b: IRequestItem) => (a.name || '').localeCompare(b.name || '');
        this.waitingItems = accessItems
          .filter((item) => item.access.status === SyncOutbreakAccessStatus.PENDING)
          .sort(byName);
        this.reviewItems = accessItems
          .filter((item) => item.access.status === SyncOutbreakAccessStatus.ACCEPTED && item.mapping?.status === 'REVIEW')
          .concat(legacyItems.filter((item) => item.mapping.status !== 'APPROVED'))
          .sort(byName);
        this.acceptedItems = accessItems
          .filter((item) => item.access.status === SyncOutbreakAccessStatus.ACCEPTED && item.mapping?.status !== 'REVIEW')
          .concat(legacyItems.filter((item) => item.mapping.status === 'APPROVED'))
          .sort(byName);
        this.pausedItems = accessItems
          .filter((item) => item.access.status === SyncOutbreakAccessStatus.PAUSED)
          .sort(byName);
        this.refusedItems = accessItems
          .filter((item) => item.access.status === SyncOutbreakAccessStatus.REFUSED)
          .sort(byName);
        this.loading = false;
        this.waitingChange.emit(this.waitingItems.length + this.reviewItems.length);
      });
  }
}
