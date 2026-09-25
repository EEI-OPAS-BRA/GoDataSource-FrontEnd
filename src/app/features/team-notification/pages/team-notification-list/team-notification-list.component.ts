import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { throwError } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { ListComponent } from '../../../../core/helperClasses/list-component';
import { Constants } from '../../../../core/models/constants';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { TeamModel } from '../../../../core/models/team.model';
import { TeamNotificationModel } from '../../../../core/models/team-notification.model';
import { TeamNotificationDataService } from '../../../../core/services/data/team-notification.data.service';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { ListHelperService } from '../../../../core/services/helper/list-helper.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { IV2BottomDialogConfigButtonType } from '../../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';
import { V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import { IV2Column, IV2ColumnPinned, V2ColumnFormat } from '../../../../shared/components-v2/app-list-table-v2/models/column.model';
import { V2FilterTextType, V2FilterType } from '../../../../shared/components-v2/app-list-table-v2/models/filter.model';
import {
  IV2SideDialogConfigButtonType,
  IV2SideDialogConfigInputNumber,
  IV2SideDialogConfigInputSingleDropdown,
  IV2SideDialogConfigInputText,
  IV2SideDialogConfigInputTextarea,
  IV2SideDialogConfigInputToggleCheckbox,
  V2SideDialogConfigInputType
} from '../../../../shared/components-v2/app-side-dialog-v2/models/side-dialog-config.model';

@Component({
  selector: 'app-team-notification-list',
  templateUrl: './team-notification-list.component.html'
})
export class TeamNotificationListComponent
  extends ListComponent<TeamNotificationModel, IV2Column>
  implements OnDestroy {
  /**
   * Constructor
   */
  constructor(
    protected listHelperService: ListHelperService,
    private teamNotificationDataService: TeamNotificationDataService,
    private toastV2Service: ToastV2Service,
    private activatedRoute: ActivatedRoute,
    private dialogV2Service: DialogV2Service
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
        // Modify Team Notification
        {
          type: V2ActionType.ICON,
          icon: 'edit',
          iconTooltip: 'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_MODIFY',
          action: {
            click: (item: TeamNotificationModel) => {
              this.openCreateModifyDialog(item);
            }
          },
          visible: (): boolean => TeamNotificationModel.canModify(this.authUser)
        },

        // Enable / disable
        {
          type: V2ActionType.ICON,
          icon: 'check',
          iconTooltip: 'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_ENABLE_DISABLE',
          action: {
            click: (item: TeamNotificationModel) => {
              this.toggleActiveFlag(item);
            }
          },
          loading: (item: TeamNotificationModel): boolean => !!item.loading,
          cssClasses: (item: TeamNotificationModel): string => {
            return item.active ?
              'gd-list-table-actions-action-icon-active' :
              '';
          },
          visible: (): boolean => TeamNotificationModel.canModify(this.authUser)
        },

        // Other actions
        {
          type: V2ActionType.MENU,
          icon: 'more_horiz',
          menuOptions: [
            // Delete
            {
              label: {
                get: () => 'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_DELETE'
              },
              cssClasses: () => 'gd-list-table-actions-action-menu-warning',
              action: {
                click: (item: TeamNotificationModel): void => {
                  this.dialogV2Service.showConfirmDialog({
                    config: {
                      title: {
                        get: () => 'LNG_COMMON_LABEL_DELETE',
                        data: () => ({
                          name: item.title
                        })
                      },
                      message: {
                        get: () => 'LNG_DIALOG_CONFIRM_DELETE_TEAM_NOTIFICATION',
                        data: () => ({
                          name: item.title
                        })
                      }
                    }
                  }).subscribe((response) => {
                    // canceled ?
                    if (response.button.type === IV2BottomDialogConfigButtonType.CANCEL) {
                      return;
                    }

                    // show loading
                    const loading = this.dialogV2Service.showLoadingDialog();

                    // delete
                    this.teamNotificationDataService
                      .deleteTeamNotification(item.id)
                      .pipe(
                        catchError((err) => {
                          this.toastV2Service.error(err);
                          loading.close();
                          return throwError(err);
                        })
                      )
                      .subscribe(() => {
                        this.toastV2Service.success('LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_DELETE_SUCCESS_MESSAGE');
                        loading.close();
                        this.needsRefreshList(true);
                      });
                  });
                }
              },
              visible: (): boolean => TeamNotificationModel.canDelete(this.authUser)
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
    this.tableColumns = [
      {
        field: 'title',
        label: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_TITLE',
        pinned: IV2ColumnPinned.LEFT,
        sortable: true,
        filter: {
          type: V2FilterType.TEXT,
          textType: V2FilterTextType.STARTS_WITH
        }
      },
      {
        field: 'teamId',
        label: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_TEAM',
        format: {
          type: (item: TeamNotificationModel) => {
            return (this.activatedRoute.snapshot.data.team as IResolverV2ResponseModel<TeamModel>).map[item.teamId]?.name ||
              item.teamId;
          }
        },
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: (this.activatedRoute.snapshot.data.team as IResolverV2ResponseModel<TeamModel>).options
        }
      },
      {
        field: 'severityColor',
        label: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_SEVERITY',
        noColorLabel: 'LNG_COMMON_LABEL_NONE',
        format: {
          type: V2ColumnFormat.COLOR
        }
      },
      {
        field: 'recurring',
        label: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRING',
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
        field: 'active',
        label: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_ACTIVE',
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
        field: 'createdAt',
        label: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_CREATED_AT',
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
        click: () => {
          this.openCreateModifyDialog();
        }
      },
      visible: (): boolean => TeamNotificationModel.canCreate(this.authUser)
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
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this.authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }, {
        label: 'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_TITLE',
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
      'teamId',
      'title',
      'message',
      'severity',
      'recurring',
      'recurrenceInterval',
      'recurrenceUnit',
      'active',
      'lastTriggeredAt',
      'createdAt'
    ];
  }

  /**
   * Refresh list
   */
  refreshList(): void {
    this.records$ = this.teamNotificationDataService
      .getTeamNotificationsList(this.queryBuilder)
      .pipe(
        takeUntil(this.destroyed$)
      );
  }

  /**
   * Get total number of items
   */
  refreshListCount(_applyHasMoreLimit?: boolean) {
    this.pageCount = undefined;

    const countQueryBuilder = _.cloneDeep(this.queryBuilder);
    countQueryBuilder.paginator.clear();
    countQueryBuilder.sort.clear();
    countQueryBuilder.clearFields();

    this.teamNotificationDataService
      .getTeamNotificationsCount(countQueryBuilder)
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          return throwError(err);
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe((response) => {
        this.pageCount = response;
      });
  }

  /**
   * Toggle and save active flag
   */
  private toggleActiveFlag(item: TeamNotificationModel): void {
    item.loading = true;
    this.tableV2Component.agTable?.api.redrawRows();

    const newValue: boolean = !item.active;
    this.teamNotificationDataService
      .modifyTeamNotification(
        item.id, {
          active: newValue
        }
      )
      .pipe(
        catchError((err) => {
          item.loading = false;
          this.tableV2Component.agTable?.api.redrawRows();
          this.toastV2Service.error(err);
          return throwError(err);
        })
      )
      .subscribe(() => {
        item.active = newValue;
        item.loading = false;
        this.tableV2Component.agTable?.api.redrawRows();
        this.toastV2Service.success('LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_TOGGLE_ENABLED_SUCCESS_MESSAGE');
      });
  }

  /**
   * Open create / modify dialog
   */
  private openCreateModifyDialog(item?: TeamNotificationModel): void {
    const isModify: boolean = !!item;
    const teamOptions = (this.activatedRoute.snapshot.data.team as IResolverV2ResponseModel<TeamModel>).options;

    this.dialogV2Service
      .showSideDialog({
        title: {
          get: () => isModify ?
            'LNG_PAGE_MODIFY_TEAM_NOTIFICATION_TITLE' :
            'LNG_PAGE_CREATE_TEAM_NOTIFICATION_TITLE'
        },
        width: '60rem',
        hideInputFilter: true,
        inputs: [
          {
            type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
            name: 'teamId',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_TEAM',
            options: teamOptions,
            value: item?.teamId,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.TEXT,
            name: 'title',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_TITLE',
            value: item?.title,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.TEXTAREA,
            name: 'message',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_MESSAGE',
            value: item?.message,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
            name: 'severity',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_SEVERITY',
            options: [
              Constants.TEAM_NOTIFICATION_SEVERITY.GREEN,
              Constants.TEAM_NOTIFICATION_SEVERITY.YELLOW,
              Constants.TEAM_NOTIFICATION_SEVERITY.RED
            ],
            value: item?.severity || Constants.TEAM_NOTIFICATION_SEVERITY.GREEN.value,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.TOGGLE_CHECKBOX,
            name: 'recurring',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRING',
            value: item?.recurring || false
          },
          {
            type: V2SideDialogConfigInputType.NUMBER,
            name: 'recurrenceInterval',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRENCE_INTERVAL',
            value: item?.recurrenceInterval,
            validators: {
              required: (data) => (data.map.recurring as IV2SideDialogConfigInputToggleCheckbox).value
            },
            visible: (data): boolean => (data.map.recurring as IV2SideDialogConfigInputToggleCheckbox).value
          },
          {
            type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
            name: 'recurrenceUnit',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRENCE_UNIT',
            options: [
              Constants.TEAM_NOTIFICATION_RECURRENCE_UNIT.HOURS,
              Constants.TEAM_NOTIFICATION_RECURRENCE_UNIT.DAYS,
              Constants.TEAM_NOTIFICATION_RECURRENCE_UNIT.WEEKS,
              Constants.TEAM_NOTIFICATION_RECURRENCE_UNIT.MONTHS,
              Constants.TEAM_NOTIFICATION_RECURRENCE_UNIT.YEARS
            ],
            value: item?.recurrenceUnit || Constants.TEAM_NOTIFICATION_RECURRENCE_UNIT.HOURS.value,
            validators: {
              required: (data) => (data.map.recurring as IV2SideDialogConfigInputToggleCheckbox).value
            },
            visible: (data): boolean => (data.map.recurring as IV2SideDialogConfigInputToggleCheckbox).value
          },
          {
            type: V2SideDialogConfigInputType.TOGGLE_CHECKBOX,
            name: 'active',
            placeholder: 'LNG_TEAM_NOTIFICATION_FIELD_LABEL_ACTIVE',
            value: item ? item.active : true
          }
        ],
        bottomButtons: [
          {
            type: IV2SideDialogConfigButtonType.OTHER,
            label: isModify ? 'LNG_COMMON_BUTTON_MODIFY' : 'LNG_COMMON_BUTTON_CREATE',
            color: 'primary',
            key: 'save',
            disabled: (_data, handler): boolean => {
              return !handler.form || handler.form.invalid;
            }
          }, {
            type: IV2SideDialogConfigButtonType.CANCEL,
            label: 'LNG_COMMON_BUTTON_CANCEL',
            color: 'text'
          }
        ]
      })
      .subscribe((response) => {
        // cancelled ?
        if (response.button.type === IV2SideDialogConfigButtonType.CANCEL) {
          return;
        }

        // construct payload
        const recurring: boolean = (response.data.map.recurring as IV2SideDialogConfigInputToggleCheckbox).value;
        const data: any = {
          teamId: (response.data.map.teamId as IV2SideDialogConfigInputSingleDropdown).value,
          title: (response.data.map.title as IV2SideDialogConfigInputText).value,
          message: (response.data.map.message as IV2SideDialogConfigInputTextarea).value,
          severity: (response.data.map.severity as IV2SideDialogConfigInputSingleDropdown).value,
          recurring,
          recurrenceInterval: recurring ?
            (response.data.map.recurrenceInterval as IV2SideDialogConfigInputNumber).value :
            undefined,
          recurrenceUnit: recurring ?
            (response.data.map.recurrenceUnit as IV2SideDialogConfigInputSingleDropdown).value :
            undefined,
          active: (response.data.map.active as IV2SideDialogConfigInputToggleCheckbox).value
        };

        // show loading
        response.handler.loading.show();

        // create / modify
        const request = isModify ?
          this.teamNotificationDataService.modifyTeamNotification(item.id, data) :
          this.teamNotificationDataService.createTeamNotification(data);

        request
          .pipe(
            catchError((err) => {
              this.toastV2Service.error(err);
              response.handler.loading.hide();
              return throwError(err);
            })
          )
          .subscribe(() => {
            this.toastV2Service.success(
              isModify ?
                'LNG_PAGE_MODIFY_TEAM_NOTIFICATION_ACTION_MODIFY_TEAM_NOTIFICATION_SUCCESS_MESSAGE' :
                'LNG_PAGE_CREATE_TEAM_NOTIFICATION_ACTION_CREATE_TEAM_NOTIFICATION_SUCCESS_MESSAGE'
            );
            response.handler.hide();
            this.needsRefreshList(true);
          });
      });
  }
}
