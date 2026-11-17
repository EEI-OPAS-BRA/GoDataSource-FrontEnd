import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { throwError } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { ListComponent } from '../../../../core/helperClasses/list-component';
import { Constants } from '../../../../core/models/constants';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';
import { WhatsappMessageModel } from '../../../../core/models/whatsapp-message.model';
import { WhatsappMessageDataService } from '../../../../core/services/data/whatsapp-message.data.service';
import { DialogV2Service } from '../../../../core/services/helper/dialog-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { ListHelperService } from '../../../../core/services/helper/list-helper.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { IV2BottomDialogConfigButtonType } from '../../../../shared/components-v2/app-bottom-dialog-v2/models/bottom-dialog-config.model';
import { V2ActionType } from '../../../../shared/components-v2/app-list-table-v2/models/action.model';
import { IV2Column, IV2ColumnPinned, V2ColumnFormat } from '../../../../shared/components-v2/app-list-table-v2/models/column.model';
import { V2FilterTextType, V2FilterType } from '../../../../shared/components-v2/app-list-table-v2/models/filter.model';
import {
  IV2SideDialogConfigButtonType,
  IV2SideDialogConfigInputSingleDropdown,
  IV2SideDialogConfigInputText,
  IV2SideDialogConfigInputTextarea,
  IV2SideDialogConfigInputToggleCheckbox,
  V2SideDialogConfigInputType
} from '../../../../shared/components-v2/app-side-dialog-v2/models/side-dialog-config.model';

@Component({
  selector: 'app-whatsapp-message-list',
  templateUrl: './whatsapp-message-list.component.html'
})
export class WhatsappMessageListComponent
  extends ListComponent<WhatsappMessageModel, IV2Column>
  implements OnDestroy {

  // applies to options
  private readonly _appliesToOptions = [
    Constants.WHATSAPP_MESSAGE_APPLIES_TO.ALL,
    Constants.WHATSAPP_MESSAGE_APPLIES_TO.CASE,
    Constants.WHATSAPP_MESSAGE_APPLIES_TO.CONTACT
  ];

  /**
   * Constructor
   */
  constructor(
    protected listHelperService: ListHelperService,
    private whatsappMessageDataService: WhatsappMessageDataService,
    private toastV2Service: ToastV2Service,
    private activatedRoute: ActivatedRoute,
    private dialogV2Service: DialogV2Service,
    private i18nService: I18nService
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

    // ...and re-load the list
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
        // Modify
        {
          type: V2ActionType.ICON,
          icon: 'edit',
          iconTooltip: 'LNG_PAGE_LIST_WHATSAPP_MESSAGES_ACTION_MODIFY',
          action: {
            click: (item: WhatsappMessageModel) => {
              this.openCreateModifyDialog(item);
            }
          },
          visible: (): boolean => WhatsappMessageModel.canModify(this.authUser)
        },

        // Enable / disable
        {
          type: V2ActionType.ICON,
          icon: 'check',
          iconTooltip: 'LNG_PAGE_LIST_WHATSAPP_MESSAGES_ACTION_ENABLE_DISABLE',
          action: {
            click: (item: WhatsappMessageModel) => {
              this.toggleActiveFlag(item);
            }
          },
          loading: (item: WhatsappMessageModel): boolean => !!item.loading,
          cssClasses: (item: WhatsappMessageModel): string => {
            return item.active ?
              'gd-list-table-actions-action-icon-active' :
              '';
          },
          visible: (): boolean => WhatsappMessageModel.canModify(this.authUser)
        },

        // Other actions
        {
          type: V2ActionType.MENU,
          icon: 'more_horiz',
          menuOptions: [
            // Delete
            {
              label: {
                get: () => 'LNG_PAGE_LIST_WHATSAPP_MESSAGES_ACTION_DELETE'
              },
              cssClasses: () => 'gd-list-table-actions-action-menu-warning',
              action: {
                click: (item: WhatsappMessageModel): void => {
                  this.dialogV2Service.showConfirmDialog({
                    config: {
                      title: {
                        get: () => 'LNG_COMMON_LABEL_DELETE',
                        data: () => ({
                          name: item.title
                        })
                      },
                      message: {
                        get: () => 'LNG_DIALOG_CONFIRM_DELETE_WHATSAPP_MESSAGE',
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
                    this.whatsappMessageDataService
                      .deleteWhatsappMessage(item.id)
                      .pipe(
                        catchError((err) => {
                          this.toastV2Service.error(err);
                          loading.close();
                          return throwError(err);
                        })
                      )
                      .subscribe(() => {
                        this.toastV2Service.success('LNG_PAGE_LIST_WHATSAPP_MESSAGES_ACTION_DELETE_SUCCESS_MESSAGE');
                        loading.close();
                        this.needsRefreshList(true);
                      });
                  });
                }
              },
              visible: (): boolean => WhatsappMessageModel.canDelete(this.authUser)
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
        label: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_TITLE',
        pinned: IV2ColumnPinned.LEFT,
        sortable: true,
        filter: {
          type: V2FilterType.TEXT,
          textType: V2FilterTextType.STARTS_WITH
        }
      },
      {
        field: 'outbreakId',
        label: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_OUTBREAK',
        format: {
          type: (item: WhatsappMessageModel) => {
            return (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).map[item.outbreakId]?.name || item.outbreakId;
          }
        },
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).options
        }
      },
      {
        field: 'appliesTo',
        label: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_APPLIES_TO',
        format: {
          type: (item: WhatsappMessageModel) => {
            const option = this._appliesToOptions.find((appliesTo) => appliesTo.value === item.appliesTo);
            return option ?
              this.i18nService.instant(option.label) :
              item.appliesTo;
          }
        },
        filter: {
          type: V2FilterType.MULTIPLE_SELECT,
          options: this._appliesToOptions
        }
      },
      {
        field: 'message',
        label: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_MESSAGE'
      },
      {
        field: 'active',
        label: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_ACTIVE',
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
        label: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_CREATED_AT',
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
      visible: (): boolean => WhatsappMessageModel.canCreate(this.authUser)
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
        label: 'LNG_PAGE_LIST_WHATSAPP_MESSAGES_TITLE',
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
      'outbreakId',
      'title',
      'message',
      'appliesTo',
      'active',
      'createdAt'
    ];
  }

  /**
   * Refresh list
   */
  refreshList(): void {
    this.records$ = this.whatsappMessageDataService
      .getWhatsappMessagesList(this.queryBuilder)
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

    this.whatsappMessageDataService
      .getWhatsappMessagesCount(countQueryBuilder)
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
  private toggleActiveFlag(item: WhatsappMessageModel): void {
    item.loading = true;
    this.tableV2Component.agTable?.api.redrawRows();

    const newValue: boolean = !item.active;
    this.whatsappMessageDataService
      .modifyWhatsappMessage(
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
        this.toastV2Service.success('LNG_PAGE_LIST_WHATSAPP_MESSAGES_ACTION_TOGGLE_ENABLED_SUCCESS_MESSAGE');
      });
  }

  /**
   * Open create / modify dialog
   */
  private openCreateModifyDialog(item?: WhatsappMessageModel): void {
    const isModify: boolean = !!item;
    const outbreakOptions = (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).options;

    this.dialogV2Service
      .showSideDialog({
        title: {
          get: () => isModify ?
            'LNG_PAGE_MODIFY_WHATSAPP_MESSAGE_TITLE' :
            'LNG_PAGE_CREATE_WHATSAPP_MESSAGE_TITLE'
        },
        width: '60rem',
        hideInputFilter: true,
        inputs: [
          {
            type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
            name: 'outbreakId',
            placeholder: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_OUTBREAK',
            options: outbreakOptions,
            value: item ?
              item.outbreakId :
              this.selectedOutbreak?.id,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.TEXT,
            name: 'title',
            placeholder: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_TITLE',
            value: item?.title,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.DROPDOWN_SINGLE,
            name: 'appliesTo',
            placeholder: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_APPLIES_TO',
            options: this._appliesToOptions,
            value: item?.appliesTo || Constants.WHATSAPP_MESSAGE_APPLIES_TO.ALL.value,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.TEXTAREA,
            name: 'message',
            placeholder: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_MESSAGE',
            value: item?.message,
            validators: {
              required: () => true
            }
          },
          {
            type: V2SideDialogConfigInputType.HTML,
            name: 'messageDescription',
            placeholder: this.i18nService.instant('LNG_WHATSAPP_MESSAGE_FIELD_LABEL_MESSAGE_DESCRIPTION')
          },
          {
            type: V2SideDialogConfigInputType.TOGGLE_CHECKBOX,
            name: 'active',
            placeholder: 'LNG_WHATSAPP_MESSAGE_FIELD_LABEL_ACTIVE',
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
        const data: any = {
          outbreakId: (response.data.map.outbreakId as IV2SideDialogConfigInputSingleDropdown).value,
          title: (response.data.map.title as IV2SideDialogConfigInputText).value,
          appliesTo: (response.data.map.appliesTo as IV2SideDialogConfigInputSingleDropdown).value,
          message: (response.data.map.message as IV2SideDialogConfigInputTextarea).value,
          active: (response.data.map.active as IV2SideDialogConfigInputToggleCheckbox).value
        };

        // show loading
        response.handler.loading.show();

        // create / modify
        const request = isModify ?
          this.whatsappMessageDataService.modifyWhatsappMessage(item.id, data) :
          this.whatsappMessageDataService.createWhatsappMessage(data);

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
                'LNG_PAGE_MODIFY_WHATSAPP_MESSAGE_ACTION_MODIFY_SUCCESS_MESSAGE' :
                'LNG_PAGE_CREATE_WHATSAPP_MESSAGE_ACTION_CREATE_SUCCESS_MESSAGE'
            );
            response.handler.hide();
            this.needsRefreshList(true);
          });
      });
  }
}
