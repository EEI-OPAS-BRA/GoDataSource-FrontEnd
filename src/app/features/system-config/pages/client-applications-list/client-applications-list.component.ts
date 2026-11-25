import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { ListComponent } from '../../../../core/helperClasses/list-component';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { SystemClientApplicationModel } from '../../../../core/models/system-client-application.model';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { ListHelperService } from '../../../../core/services/helper/list-helper.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { IV2BottomDialogConfigButtonType } from '../../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';
import { V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import { IV2Column, IV2ColumnPinned, V2ColumnFormat } from '../../../../shared/components-v2/app-list-table-v2/models/column.model';
import { ClientApplicationDataService } from '../../../../core/services/data/client-application.data.service';
import { V2FilterTextType, V2FilterType } from '../../../../shared/components-v2/app-list-table-v2/models/filter.model';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { UserModel } from '../../../../core/models/user.model';
import { ClientApplicationHelperService } from '../../../../core/services/helper/client-application-helper.service';
import { SystemSyncLogModel } from '../../../../core/models/system-sync-log.model';
import { SyncOutbreakAccessModel, SyncOutbreakAccessStatus } from '../../../../core/models/sync-outbreak-access.model';
import { SyncOutbreakMappingModel } from '../../../../core/models/sync-outbreak-mapping.model';
import { SyncOutbreakAccessDataService } from '../../../../core/services/data/sync-outbreak-access.data.service';
import { SyncOutbreakMappingDataService } from '../../../../core/services/data/sync-outbreak-mapping.data.service';

@Component({
  selector: 'app-client-applications-list',
  templateUrl: './client-applications-list.component.html'
})
export class ClientApplicationsListComponent
  extends ListComponent<SystemClientApplicationModel, IV2Column>
  implements OnDestroy {
  /**
   * Constructor
   */
  constructor(
    protected listHelperService: ListHelperService,
    private clientApplicationDataService: ClientApplicationDataService,
    private toastV2Service: ToastV2Service,
    private i18nService: I18nService,
    private activatedRoute: ActivatedRoute,
    private dialogV2Service: DialogV2Service,
    private clientApplicationHelperService: ClientApplicationHelperService,
    private syncOutbreakAccessDataService: SyncOutbreakAccessDataService,
    private syncOutbreakMappingDataService: SyncOutbreakMappingDataService
  ) {
    super(
      listHelperService, {
        disableWaitForSelectedOutbreakToRefreshList: true
      }
    );
  }

  /**
   * Component initialized
   */
  initialized(): void {
    // initialize pagination
    this.initPaginator();

    // ...and re-load the list when the Selected Outbreak is changed
    this.needsRefreshList(true);
  }

  /**
   * Release resources
   */
  ngOnDestroy() {
    // release parent resources
    super.onDestroy();
  }

  /**
   * Table column - actions
   */
  protected initializeTableColumnActions(): void {
    this.tableColumnActions = {
      format: {
        type: V2ColumnFormat.ACTIONS
      },
      actions: [
        // View Client application
        {
          type: V2ActionType.ICON,
          icon: 'visibility',
          iconTooltip: 'LNG_SYNC_CLIENT_OPEN',
          action: {
            link: (data: SystemClientApplicationModel): string[] => {
              return ['/system-config/client-applications', data.id];
            }
          },
          visible: (item: SystemClientApplicationModel): boolean => {
            return !item.deleted &&
              SystemClientApplicationModel.canView(this.authUser);
          }
        },

        // Modify Client application
        {
          type: V2ActionType.ICON,
          icon: 'edit',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_MODIFY',
          action: {
            link: (item: SystemClientApplicationModel): string[] => {
              return ['/system-config/client-applications', item.id, 'modify'];
            }
          },
          visible: (item: SystemClientApplicationModel): boolean => {
            return !item.deleted &&
              SystemClientApplicationModel.canModify(this.authUser);
          }
        },

        // Enable / Disable client application
        {
          type: V2ActionType.ICON,
          icon: 'check',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_ENABLE_DISABLE',
          action: {
            click: (item: SystemClientApplicationModel) => {
              // update
              this.toggleActiveFlag(item);
            }
          },
          loading: (item: SystemClientApplicationModel): boolean => !!item.loading,
          cssClasses: (item: SystemClientApplicationModel): string => {
            return item.active ?
              'gd-list-table-actions-action-icon-active' :
              '';
          },
          disable: (item: SystemClientApplicationModel): boolean => {
            return (
              item.active &&
              !SystemClientApplicationModel.canDisable(this.authUser)
            ) || (
              !item.active &&
              !SystemClientApplicationModel.canEnable(this.authUser)
            );
          }
        },

        // Download client application config file
        {
          type: V2ActionType.ICON,
          icon: 'file_download',
          iconTooltip: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_DOWNLOAD_CONF_FILE',
          action: {
            click: (item: SystemClientApplicationModel) => {
              this.clientApplicationHelperService.downloadConfFile(item);
            }
          },
          disable: (item: SystemClientApplicationModel): boolean => {
            return !item.active;
          },
          visible: (): boolean => {
            return SystemClientApplicationModel.canDownloadConfFile(this.authUser);
          }
        },

        // Other actions
        {
          type: V2ActionType.MENU,
          icon: 'more_horiz',
          menuOptions: [
            // Last syncs received from this client
            {
              label: {
                get: () => 'LNG_SYNC_ACTIVITY_PANEL_ACTION_VIEW_HISTORY'
              },
              action: {
                link: (): string[] => ['/system-config/client-applications/history'],
                linkQueryParams: (item: SystemClientApplicationModel) => ({
                  key: item.credentials?.clientId,
                  name: item.name
                })
              },
              visible: (item: SystemClientApplicationModel): boolean => {
                return !!item.credentials?.clientId &&
                  SystemSyncLogModel.canList(this.authUser);
              }
            },

            // Delete
            {
              label: {
                get: () => 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_DELETE'
              },
              cssClasses: () => 'gd-list-table-actions-action-menu-warning',
              action: {
                click: (item: SystemClientApplicationModel): void => {
                  // determine what we need to delete
                  this.dialogV2Service.showConfirmDialog({
                    config: {
                      title: {
                        get: () => 'LNG_COMMON_LABEL_DELETE',
                        data: () => ({
                          name: item.name
                        })
                      },
                      message: {
                        get: () => 'LNG_DIALOG_CONFIRM_DELETE_CLIENT_APPLICATION',
                        data: () => ({
                          name: item.name
                        })
                      }
                    }
                  }).subscribe((response) => {
                    // canceled ?
                    if (response.button.type === IV2BottomDialogConfigButtonType.CANCEL) {
                      // finished
                      return;
                    }

                    // show loading
                    const loading = this.dialogV2Service.showLoadingDialog();

                    // delete device
                    this.clientApplicationDataService
                      .deleteClientApplication(item.id)
                      .pipe(
                        catchError((err) => {
                          // show error
                          this.toastV2Service.error(err);

                          // hide loading
                          loading.close();

                          // send error down the road
                          return throwError(err);
                        })
                      )
                      .subscribe(() => {
                        // success
                        this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_DELETE_SUCCESS_MESSAGE');

                        // hide loading
                        loading.close();

                        // reload data
                        this.needsRefreshList(true);
                      });
                  });
                }
              },
              visible: (): boolean => {
                return SystemClientApplicationModel.canDelete(this.authUser);
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Initialize Side Table Columns
   */
  protected initializeTableColumns() {
    // default table columns
    this.tableColumns = [
      {
        field: 'name',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_NAME',
        pinned: IV2ColumnPinned.LEFT,
        sortable: true,
        filter: {
          type: V2FilterType.TEXT,
          textType: V2FilterTextType.STARTS_WITH
        },
        link: (item: SystemClientApplicationModel) => SystemClientApplicationModel.canView(this.authUser) ?
          `/system-config/client-applications/${item.id}` :
          undefined
      },
      {
        field: 'type',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_TYPE',
        sortable: true,
        format: {
          type: (item: SystemClientApplicationModel) => this.i18nService.instant(
            item.usesRequests ?
              'LNG_SYNC_CLIENT_TYPE_SHORT_INSTANCE' :
              (item.type ? 'LNG_SYSTEM_CLIENT_APPLICATION_TYPE_MOBILE' : 'LNG_SYNC_CLIENT_TYPE_LEGACY')
          )
        }
      },
      {
        field: 'pendingCount',
        label: 'LNG_SYNC_CLIENT_COLUMN_PENDING',
        format: {
          type: V2ColumnFormat.HTML
        },
        html: (item: SystemClientApplicationModel) => item.pendingCount ?
          `<span class="gd-list-table-sync-pending">${item.pendingCount}</span>` :
          '<span class="gd-list-table-sync-none">0</span>'
      },
      {
        field: 'acceptedCount',
        label: 'LNG_SYNC_CLIENT_COLUMN_ACCEPTED',
        format: {
          type: (item: SystemClientApplicationModel) => item.usesRequests ?
            String(item.acceptedCount || 0) :
            '-'
        }
      },
      {
        field: 'credentials.clientId',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_CREDENTIALS',
        format: {
          obfuscated: true,
          type: (item: SystemClientApplicationModel) => {
            return `${item.credentials?.clientId}/${item.credentials?.clientSecret}`;
          }
        },
        sortable: true,
        filter: {
          type: V2FilterType.TEXT,
          textType: V2FilterTextType.STARTS_WITH,
          useLike: true
        }
      },
      {
        field: 'active',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_ACTIVE',
        sortable: true,
        format: {
          type: V2ColumnFormat.BOOLEAN
        },
        filter: {
          type: V2FilterType.BOOLEAN,
          value: '',
          defaultValue: ''
        }
      },
      {
        field: 'outbreakIDs',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_OUTBREAKS',
        format: {
          type: V2ColumnFormat.LINK_LIST
        },
        links: (item: SystemClientApplicationModel) => item.usesRequests ?
          [
            {
              label: this.i18nService.instant('LNG_SYNC_CLIENT_OUTBREAKS_BY_REQUEST'),
              href: null
            }
          ] :
          item.outbreakIDs?.length > 0 ?
            item.outbreakIDs
              .filter((outbreakId) => !!(this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).map[outbreakId])
              .map((outbreakId) => {
                return {
                  label: (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).map[outbreakId].name,
                  href: OutbreakModel.canView(this.authUser) ?
                    `/outbreaks/${ outbreakId }/view` :
                    null
                };
              }) :
            [
              {
                label: this.i18nService.instant('LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_LABEL_ALL_OUTBREAKS'),
                href: null
              }
            ],
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).options
        },
        exclude: (): boolean => !OutbreakModel.canList(this.authUser)
      },
      {
        field: 'createdOn',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_CREATED_ON',
        notVisible: true,
        format: {
          type: (item) => item.createdOn ?
            this.i18nService.instant(`LNG_PLATFORM_LABEL_${item.createdOn}`) :
            item.createdOn
        },
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: (this.activatedRoute.snapshot.data.createdOn as IResolverV2ResponseModel<ILabelValuePairModel>).options,
          includeNoValue: true
        },
        sortable: true
      },
      {
        field: 'createdBy',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_CREATED_BY',
        notVisible: true,
        format: {
          type: 'createdByUser.nameAndEmail'
        },
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: (this.activatedRoute.snapshot.data.user as IResolverV2ResponseModel<UserModel>).options,
          includeNoValue: true
        },
        exclude: (): boolean => {
          return !UserModel.canView(this.authUser);
        },
        link: (data) => {
          return data.createdBy && UserModel.canView(this.authUser) && !data.createdByUser?.deleted ?
            `/users/${data.createdBy}/view` :
            undefined;
        }
      },
      {
        field: 'createdAt',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_CREATED_AT',
        notVisible: true,
        format: {
          type: V2ColumnFormat.DATETIME
        },
        filter: {
          type: V2FilterType.DATE_RANGE
        },
        sortable: true
      },
      {
        field: 'updatedBy',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_UPDATED_BY',
        notVisible: true,
        format: {
          type: 'updatedByUser.nameAndEmail'
        },
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: (this.activatedRoute.snapshot.data.user as IResolverV2ResponseModel<UserModel>).options,
          includeNoValue: true
        },
        exclude: (): boolean => {
          return !UserModel.canView(this.authUser);
        },
        link: (data) => {
          return data.updatedBy && UserModel.canView(this.authUser) && !data.updatedByUser?.deleted ?
            `/users/${data.updatedBy}/view` :
            undefined;
        }
      },
      {
        field: 'updatedAt',
        label: 'LNG_SYSTEM_CLIENT_APPLICATION_FIELD_LABEL_UPDATED_AT',
        notVisible: true,
        format: {
          type: V2ColumnFormat.DATETIME
        },
        filter: {
          type: V2FilterType.DATE_RANGE
        },
        sortable: true
      }
    ];
  }

  /**
   * Initialize process data
   */
  protected initializeProcessSelectedData(): void {}

  /**
   * Initialize table infos
   */
  protected initializeTableInfos(): void {}

  /**
   * Initialize Table Advanced Filters
   */
  protected initializeTableAdvancedFilters(): void {}

  /**
   * Initialize table quick actions
   */
  protected initializeQuickActions(): void {}

  /**
   * Initialize table group actions
   */
  protected initializeGroupActions(): void {}

  /**
   * Initialize table add action
   */
  protected initializeAddAction(): void {
    this.addAction = {
      type: V2ActionType.ICON_LABEL,
      label: 'LNG_COMMON_BUTTON_ADD',
      icon: 'add_circle_outline',
      action: {
        link: (): string[] => ['./create']
      },
      visible: (): boolean => {
        return SystemClientApplicationModel.canCreate(this.authUser);
      }
    };
  }

  /**
   * Initialize table grouped data
   */
  protected initializeGroupedData(): void {}

  /**
   * Initialize breadcrumbs
   */
  protected initializeBreadcrumbs(): void {
    // set breadcrumbs
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this.authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_TITLE',
        action: null
      }
    ];
  }

  /**
   * Fields retrieved from api to reduce payload size
   */
  protected refreshListFields(): string[] {
    return [
      'id',
      'name',
      'credentials',
      'active',
      'outbreakIDs',
      'type',
      'autoAcceptSameIdOutbreaks',
      'createdOn',
      'createdBy',
      'createdAt',
      'updatedBy',
      'updatedAt'
    ];
  }

  /**
   * Refresh list
   */
  refreshList(): void {
    // retrieve created user & modified user information
    this.queryBuilder.include('createdByUser', true);
    this.queryBuilder.include('updatedByUser', true);

    // retrieve the list of Cases
    this.records$ = this.clientApplicationDataService
      .getClientApplicationsList(this.queryBuilder)
      .pipe(
        // what waits for a decision / was accepted for each client
        switchMap((clientApplications: SystemClientApplicationModel[]) => forkJoin([
          this.syncOutbreakAccessDataService
            .getAccessList()
            .pipe(catchError(() => of([]))),
          this.syncOutbreakMappingDataService
            .getMappingsList()
            .pipe(catchError(() => of([])))
        ] as Observable<any>[])
          .pipe(
            map(([accesses, mappings]: [SyncOutbreakAccessModel[], SyncOutbreakMappingModel[]]) => {
              const requested: {
                [key: string]: boolean
              } = {};
              const pending: {
                [clientId: string]: number
              } = {};
              const accepted: {
                [clientId: string]: number
              } = {};
              accesses.forEach((access) => {
                requested[`${access.clientId}|${access.sourceOutbreakId}`] = true;
                if (access.status === SyncOutbreakAccessStatus.PENDING) {
                  pending[access.clientId] = (pending[access.clientId] || 0) + 1;
                } else if (access.status === SyncOutbreakAccessStatus.ACCEPTED) {
                  accepted[access.clientId] = (accepted[access.clientId] || 0) + 1;
                }
              });

              // questions to review & outbreaks received without a request
              mappings
                .filter((mapping) => mapping.status === 'REVIEW' || (
                  mapping.status !== 'APPROVED' &&
                  !requested[`${mapping.clientId}|${mapping.sourceOutbreakId}`]
                ))
                .forEach((mapping) => {
                  pending[mapping.clientId] = (pending[mapping.clientId] || 0) + 1;
                });

              clientApplications.forEach((clientApplication) => {
                const clientId: string = clientApplication.credentials?.clientId;
                clientApplication.pendingCount = pending[clientId] || 0;
                clientApplication.acceptedCount = accepted[clientId] || 0;
              });
              return clientApplications;
            })
          )
        ),

        // should be the last pipe
        takeUntil(this.destroyed$)
      );
  }

  /**
   * Get total number of items
   */
  refreshListCount() {
    // reset
    this.pageCount = undefined;

    // remove paginator from query builder
    const countQueryBuilder = _.cloneDeep(this.queryBuilder);
    countQueryBuilder.paginator.clear();
    countQueryBuilder.sort.clear();
    countQueryBuilder.clearFields();

    // count
    this.clientApplicationDataService
      .getClientApplicationsCount(countQueryBuilder)
      .pipe(
        // error
        catchError((err) => {
          this.toastV2Service.error(err);
          return throwError(err);
        }),

        // should be the last pipe
        takeUntil(this.destroyed$)
      )
      .subscribe((response) => {
        this.pageCount = response;
      });
  }

  /**
   * Toggle and save active flag
   */
  private toggleActiveFlag(clientApplication: SystemClientApplicationModel): void {
    // show loading
    clientApplication.loading = true;
    this.tableV2Component.agTable?.api.redrawRows();

    // save
    const newValue: boolean = !clientApplication.active;
    this.clientApplicationDataService
      .modifyClientApplication(
        clientApplication.id, {
          active: newValue
        }
      )
      .pipe(
        catchError((err) => {
          // hide loading
          clientApplication.loading = false;
          this.tableV2Component.agTable?.api.redrawRows();

          // show error
          this.toastV2Service.error(err);

          // send error further
          return throwError(err);
        })
      )
      .subscribe(() => {
        // finished
        clientApplication.active = newValue;

        // hide loading
        clientApplication.loading = false;
        this.tableV2Component.agTable?.api.redrawRows();

        // display success message
        this.toastV2Service.success('LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_ACTION_TOGGLE_ENABLED_SUCCESS_MESSAGE');
      });
  }
}
