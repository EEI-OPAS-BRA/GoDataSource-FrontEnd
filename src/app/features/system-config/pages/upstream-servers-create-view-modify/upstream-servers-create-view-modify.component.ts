import { Component, OnDestroy, Renderer2 } from '@angular/core';
import { CreateViewModifyComponent } from '../../../../core/helperClasses/create-view-modify-component';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import * as _ from 'lodash';
import { EMPTY, Observable, of, Subscription, throwError } from 'rxjs';
import {
  CreateViewModifyV2ActionType,
  CreateViewModifyV2TabInputType,
  ICreateViewModifyV2Buttons,
  ICreateViewModifyV2CreateOrUpdate,
  ICreateViewModifyV2Tab
} from '../../../../shared/components-v2/app-create-view-modify-v2/models/tab.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SystemSyncDataService } from '../../../../core/services/data/system-sync.data.service';
import { UpstreamServerCheckHelperService } from '../../../../core/services/helper/upstream-server-check-helper.service';
import { ISystemUpstreamServerCheckServer, ISystemUpstreamServerConnection } from '../../../../core/models/system-upstream-server-check.model';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { OutbreakAndOutbreakTemplateHelperService } from '../../../../core/services/helper/outbreak-and-outbreak-template-helper.service';
import { RedirectService } from '../../../../core/services/helper/redirect.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';
import { IResolverV2ResponseModel } from '../../../../core/services/resolvers/data/models/resolver-response.model';
import { OutbreakModel } from '../../../../core/models/outbreak.model';

/**
 * Result displayed next to a check button
 */
interface ICheckResult {
  status: 'success' | 'error' | 'warning';
  icon: string;
  message: string;
}

/**
 * Component
 */
@Component({
  selector: 'app-upstream-servers-create-view-modify',
  templateUrl: './upstream-servers-create-view-modify.component.html'
})
export class UpstreamServersCreateViewModifyComponent extends CreateViewModifyComponent<SystemUpstreamServerModel> implements OnDestroy {
  // upstream servers map
  private _upstreamServersMap: {
    [url: string]: true
  } = {};

  // when modifying, the servers don't have an id, so the url they had when the page was opened identifies them
  private _originalUrl: string;

  // status of the server that has the url from the form
  private _serverStatus: 'idle' | 'checking' | 'online' | 'offline' = 'idle';
  private _serverResult: ICheckResult;

  // credentials test
  private _testingCredentials: boolean = false;
  private _credentialsResult: ICheckResult;
  private _checkSubscription: Subscription;

  /**
   * Constructor
   */
  constructor(
    protected authDataService: AuthDataService,
    protected activatedRoute: ActivatedRoute,
    protected renderer2: Renderer2,
    protected redirectService: RedirectService,
    protected toastV2Service: ToastV2Service,
    protected outbreakAndOutbreakTemplateHelperService: OutbreakAndOutbreakTemplateHelperService,
    protected i18nService: I18nService,
    protected systemSettingsDataService: SystemSettingsDataService,
    protected systemSyncDataService: SystemSyncDataService,
    protected upstreamServerCheckHelperService: UpstreamServerCheckHelperService,
    protected router: Router
  ) {
    // parent
    super(
      authDataService,
      activatedRoute,
      renderer2,
      redirectService,
      toastV2Service,
      outbreakAndOutbreakTemplateHelperService
    );

    // server that is being modified
    this._originalUrl = activatedRoute.snapshot.queryParams.url;

    // map upstream servers
    // the server that is being modified doesn't count as a duplicate of itself
    const upstreamServers: SystemUpstreamServerModel[] = activatedRoute.snapshot.data.upstreamServers;
    upstreamServers.forEach((upstreamServer) => {
      if (
        this.isModify &&
        upstreamServer.url.toLowerCase() === this._originalUrl?.toLowerCase()
      ) {
        return;
      }

      this._upstreamServersMap[upstreamServer.url.toLowerCase()] = true;
    });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    // stop pending check
    this._checkSubscription?.unsubscribe();
    this._checkSubscription = undefined;

    // parent
    super.onDestroy();
  }

  /**
   * Create new item model if needed
   */
  protected createNewItem(): SystemUpstreamServerModel {
    return new SystemUpstreamServerModel();
  }

  /**
   * Retrieve item
   */
  protected retrieveItem(): Observable<SystemUpstreamServerModel> {
    return this.systemSettingsDataService
      .getSystemSettings()
      .pipe(
        switchMap((settings: SystemSettingsModel) => {
          const upstreamServer: SystemUpstreamServerModel = (settings.upstreamServers || []).find((server) => server.url === this._originalUrl);
          if (!upstreamServer) {
            // it was deleted or the url is wrong
            this.toastV2Service.error('LNG_PAGE_MODIFY_SYSTEM_UPSTREAM_SERVER_NOT_FOUND');
            this.router.navigate(['/system-config/upstream-servers']);
            return EMPTY;
          }

          return of(upstreamServer);
        })
      );
  }

  /**
   * Data initialized
   */
  protected initializedData(): void {}

  /**
   * Initialize page title
   */
  protected initializePageTitle(): void {
    // add info accordingly to page type
    if (this.isCreate) {
      this.pageTitle = 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TITLE';
      this.pageTitleData = undefined;
    } else {
      this.pageTitle = 'LNG_PAGE_MODIFY_SYSTEM_UPSTREAM_SERVER_TITLE';
      this.pageTitleData = {
        name: this.itemData.name
      };
    }
  }

  /**
   * Initialize breadcrumbs
   */
  protected initializeBreadcrumbs() {
    // reset breadcrumbs
    this.breadcrumbs = [
      {
        label: 'LNG_COMMON_LABEL_HOME',
        action: {
          link: DashboardModel.canViewDashboard(this.authUser) ?
            ['/dashboard'] :
            ['/account/my-profile']
        }
      }
    ];

    // list page
    if (SystemUpstreamServerModel.canList(this.authUser)) {
      this.breadcrumbs.push({
        label: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_TITLE',
        action: {
          link: ['/system-config/upstream-servers']
        }
      });
    }

    // add info accordingly to page type
    this.breadcrumbs.push({
      label: this.isCreate ?
        'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TITLE' :
        this.i18nService.instant(
          'LNG_PAGE_MODIFY_SYSTEM_UPSTREAM_SERVER_TITLE', {
            name: this.itemData.name
          }
        ),
      action: null
    });
  }

  /**
   * Initialize breadcrumb infos
   */
  protected initializeBreadcrumbInfos(): void {}

  /**
   * Initialize tabs
   */
  protected initializeTabs(): void {
    this.tabData = {
      // tabs
      tabs: [
        // Personal
        this.initializeTabsDetails()
      ],

      // create details
      create: {
        finalStep: {
          buttonLabel: this.i18nService.instant('LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_ACTION_CREATE_UPSTREAM_SERVER_BUTTON'),
          message: () => this.i18nService.instant(
            'LNG_STEPPER_FINAL_STEP_TEXT_GENERAL',
            this.itemData
          )
        }
      },

      // buttons
      buttons: this.initializeButtons(),

      // the whole server is saved, not only the fields that were changed
      modifyGetAllNotOnlyDirtyFields: true,

      // create or update
      createOrUpdate: this.initializeProcessData(),
      redirectAfterCreateUpdate: () => {
        // redirect to list
        this.router.navigate([
          '/system-config/upstream-servers'
        ]);
      }
    };
  }

  /**
   * Initialize tabs - Details
   */
  private initializeTabsDetails(): ICreateViewModifyV2Tab {
    return {
      type: CreateViewModifyV2TabInputType.TAB,
      name: 'details',
      label: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TAB_DETAILS_TITLE',
      sections: [
        // General
        {
          type: CreateViewModifyV2TabInputType.SECTION,
          label: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_SECTION_GENERAL',
          inputs: [
            {
              type: CreateViewModifyV2TabInputType.TEXT,
              name: 'name',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_NAME',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_NAME_DESCRIPTION',
              value: {
                get: () => this.itemData.name,
                set: (value) => {
                  // set data
                  this.itemData.name = value;
                }
              },
              validators: {
                required: () => true
              }
            }, {
              type: CreateViewModifyV2TabInputType.TEXTAREA,
              name: 'description',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_DESCRIPTION',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_DESCRIPTION_DESCRIPTION',
              value: {
                get: () => this.itemData.description,
                set: (value) => {
                  this.itemData.description = value;
                }
              }
            }
          ]
        },

        // Connection
        {
          type: CreateViewModifyV2TabInputType.SECTION,
          label: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_SECTION_CONNECTION',
          inputs: [
            {
              type: CreateViewModifyV2TabInputType.TEXT,
              name: 'url',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_URL',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_URL_DESCRIPTION',
              exampleValue: () => 'http://localhost:3000/api',
              cssClasses: 'gd-create-view-modify-bottom-section-content-input-wide',
              value: {
                get: () => this.itemData.url,
                set: (value) => {
                  // set data
                  // spaces are removed when saving, so they are removed here too, otherwise an url that is already registered passes the validation
                  this.itemData.url = _.isString(value) ?
                    value.trim() :
                    value;

                  // the previous checks don't apply to a different url
                  this.connectionFieldChanged(true);
                }
              },
              validators: {
                required: () => true,
                notInObject: () => ({
                  values: this._upstreamServersMap,
                  err: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_URL_ALREADY_REGISTERED'
                })
              }
            }, {
              type: CreateViewModifyV2TabInputType.BUTTON,
              name: 'checkServer',
              label: () => 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_BUTTON',
              icon: 'power',
              cssClasses: 'gd-create-view-modify-bottom-section-content-input-button-inline',
              loading: () => this._serverStatus === 'checking',
              disabled: () => !this.itemData.url?.trim() ||
                this._testingCredentials,
              click: () => this.checkServer(),
              result: () => this._serverResult
            }, {
              // the sync history is kept by url
              type: CreateViewModifyV2TabInputType.LABEL,
              value: {
                get: () => 'LNG_PAGE_MODIFY_SYSTEM_UPSTREAM_SERVER_URL_CHANGED_NOTE'
              },
              visible: () => this.isModify &&
                this.itemData.url?.trim().toLowerCase() !== this._originalUrl?.toLowerCase()
            }, {
              type: CreateViewModifyV2TabInputType.PASSWORD,
              name: 'credentials[clientId]',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_CREDENTIALS_CLIENT_ID',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_CREDENTIALS_CLIENT_ID_DESCRIPTION',
              value: {
                get: () => this.itemData.credentials.clientId,
                set: (value) => {
                  // set data
                  this.itemData.credentials.clientId = value;

                  // the previous test doesn't apply to different credentials
                  this.connectionFieldChanged(false);
                }
              },
              validators: {
                required: () => true
              }
            }, {
              type: CreateViewModifyV2TabInputType.PASSWORD,
              name: 'credentials[clientSecret]',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_CREDENTIALS_CLIENT_SECRET',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_CREDENTIALS_CLIENT_SECRET_DESCRIPTION',
              value: {
                get: () => this.itemData.credentials.clientSecret,
                set: (value) => {
                  // set data
                  this.itemData.credentials.clientSecret = value;

                  // the previous test doesn't apply to different credentials
                  this.connectionFieldChanged(false);
                }
              },
              validators: {
                required: () => true
              }
            }, {
              type: CreateViewModifyV2TabInputType.BUTTON,
              name: 'testCredentials',
              label: () => 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TEST_CREDENTIALS_BUTTON',
              icon: 'vpn_key',
              cssClasses: 'gd-create-view-modify-bottom-section-content-input-button-inline',
              loading: () => this._testingCredentials,
              disabled: () => !this.itemData.url?.trim() ||
                !this.itemData.credentials.clientId ||
                !this.itemData.credentials.clientSecret ||
                this._serverStatus === 'checking',
              click: () => this.testCredentials(),
              result: () => this._credentialsResult
            }
          ]
        },

        // Synchronization
        {
          type: CreateViewModifyV2TabInputType.SECTION,
          label: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_SECTION_SYNCHRONIZATION',
          inputs: [
            {
              type: CreateViewModifyV2TabInputType.TOGGLE_CHECKBOX,
              name: 'syncEnabled',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_ENABLED',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_ENABLED_DESCRIPTION',
              value: {
                get: () => this.itemData.syncEnabled,
                set: (value) => {
                  // set data
                  this.itemData.syncEnabled = value;
                }
              }
            }, {
              type: CreateViewModifyV2TabInputType.TOGGLE_CHECKBOX,
              name: 'syncOnEveryChange',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_ON_EVERY_CHANGE',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_ON_EVERY_CHANGE_DESCRIPTION',
              value: {
                get: () => this.itemData.syncOnEveryChange,
                set: (value) => {
                  // set data
                  this.itemData.syncOnEveryChange = value;
                }
              }
            }, {
              type: CreateViewModifyV2TabInputType.SELECT_MULTIPLE,
              name: 'outbreakIDs',
              placeholder: () => this.itemData.outbreakIDs?.length > 0 ?
                'LNG_UPSTREAM_SERVER_FIELD_LABEL_OUTBREAKS_TO_SYNC' :
                'LNG_UPSTREAM_SERVER_FIELD_LABEL_OUTBREAKS_TO_SYNC_ALL',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_OUTBREAKS_TO_SYNC_DESCRIPTION',
              value: {
                get: () => this.itemData.outbreakIDs,
                set: (value) => {
                  // set data
                  this.itemData.outbreakIDs = value || [];
                }
              },
              options: (this.activatedRoute.snapshot.data.outbreak as IResolverV2ResponseModel<OutbreakModel>).options
            }, {
              type: CreateViewModifyV2TabInputType.NUMBER,
              name: 'syncInterval',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_INTERVAL',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_SYNC_INTERVAL_DESCRIPTION',
              value: {
                get: () => this.itemData.syncInterval,
                set: (value) => {
                  // set data
                  this.itemData.syncInterval = value;
                }
              },
              validators: {
                required: () => true
              }
            }, {
              type: CreateViewModifyV2TabInputType.NUMBER,
              name: 'timeout',
              placeholder: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_TIMEOUT',
              description: () => 'LNG_UPSTREAM_SERVER_FIELD_LABEL_TIMEOUT_DESCRIPTION',
              value: {
                get: () => this.itemData.timeout,
                set: (value) => {
                  // set data
                  this.itemData.timeout = value;
                }
              },
              validators: {
                required: () => true
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Redraw the form, since the inputs don't check for changes on their own
   */
  private refreshCheckUi(): void {
    this.createViewModifyComponent?.detectChanges();
  }

  /**
   * Url / credentials changed, so what we know about the server / credentials isn't valid anymore
   */
  private connectionFieldChanged(urlChanged: boolean): void {
    // nothing to reset ?
    const serverStateChanged: boolean = urlChanged && (
      this._serverStatus !== 'idle' ||
      !!this._serverResult
    );
    if (
      !this._credentialsResult &&
      !this._testingCredentials &&
      !serverStateChanged
    ) {
      return;
    }

    // ignore the pending response, it was made for other values
    if (
      this._testingCredentials ||
      serverStateChanged
    ) {
      this._checkSubscription?.unsubscribe();
      this._checkSubscription = undefined;
    }

    // credentials test doesn't apply anymore
    this._testingCredentials = false;
    this._credentialsResult = undefined;

    // server check doesn't apply to a different url
    if (serverStateChanged) {
      this._serverStatus = 'idle';
      this._serverResult = undefined;
    }

    // redraw
    this.refreshCheckUi();
  }

  /**
   * Update the state with the status of the server
   */
  private applyServerResult(server: ISystemUpstreamServerCheckServer): void {
    if (server.online) {
      this._serverStatus = 'online';
      this._serverResult = {
        status: 'success',
        icon: 'check_circle',
        message: this.upstreamServerCheckHelperService.getServerOnlineMessage(server.responseTimeMs)
      };
    } else {
      this._serverStatus = 'offline';
      this._serverResult = {
        status: 'error',
        icon: 'error',
        message: this.upstreamServerCheckHelperService.getErrorMessage(
          server.errorCode,
          server.code
        )
      };
    }
  }

  /**
   * Result displayed next to the credentials test button
   */
  private getCredentialsCheckResult(connection: ISystemUpstreamServerConnection): ICheckResult {
    switch (connection.status) {
      case 'online':
        return {
          status: 'success',
          icon: 'check_circle',
          message: connection.message
        };

      case 'unknown':
        return {
          status: 'warning',
          icon: 'warning',
          message: connection.message
        };

      default:
        return {
          status: 'error',
          icon: 'error',
          message: connection.message
        };
    }
  }

  /**
   * The request failed before we got a result from the check
   */
  private handleCheckRequestError(
    err: any,
    credentialsTest: boolean
  ): void {
    this._serverStatus = 'idle';
    this._testingCredentials = false;

    // invalid url is displayed next to the button that made the check
    let result: ICheckResult;
    if (err?.code === 'REQUEST_VALIDATION_ERROR') {
      result = {
        status: 'error',
        icon: 'error',
        message: this.i18nService.instant('LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_INVALID_URL')
      };
    } else {
      this.toastV2Service.error(err);
    }

    if (credentialsTest) {
      this._credentialsResult = result;
    } else {
      this._serverResult = result;
    }

    this.refreshCheckUi();
  }

  /**
   * Check if the server is online, using only the url
   */
  private checkServer(): void {
    const url: string = this.itemData.url?.trim();
    if (!url) {
      return;
    }

    // only one check at a time
    this._checkSubscription?.unsubscribe();
    this._testingCredentials = false;
    this._serverStatus = 'checking';
    this._serverResult = undefined;
    this.refreshCheckUi();

    this._checkSubscription = this.systemSyncDataService
      .checkUpstreamServer({
        url
      })
      .subscribe({
        next: (result) => {
          this.applyServerResult(result.server);
          this.refreshCheckUi();
        },
        error: (err) => this.handleCheckRequestError(
          err,
          false
        )
      });
  }

  /**
   * Check the server and if it accepts the credentials
   */
  private testCredentials(): void {
    const url: string = this.itemData.url?.trim();
    const clientId: string = this.itemData.credentials.clientId;
    const clientSecret: string = this.itemData.credentials.clientSecret;
    if (
      !url ||
      !clientId ||
      !clientSecret
    ) {
      return;
    }

    // only one check at a time
    this._checkSubscription?.unsubscribe();
    this._testingCredentials = true;
    this._credentialsResult = undefined;
    this.refreshCheckUi();

    this._checkSubscription = this.systemSyncDataService
      .checkUpstreamServer({
        url,
        clientId,
        clientSecret
      })
      .subscribe({
        next: (result) => {
          this._testingCredentials = false;
          this.applyServerResult(result.server);

          // same summary displayed in the servers list
          this._credentialsResult = this.getCredentialsCheckResult(this.upstreamServerCheckHelperService.summarize(result));

          this.refreshCheckUi();
        },
        error: (err) => this.handleCheckRequestError(
          err,
          true
        )
      });
  }

  /**
   * Initialize buttons
   */
  private initializeButtons(): ICreateViewModifyV2Buttons {
    return {
      view: undefined,
      modify: undefined,
      createCancel: {
        link: {
          link: () => ['/system-config/upstream-servers']
        }
      },
      viewCancel: undefined,
      modifyCancel: {
        link: {
          link: () => ['/system-config/upstream-servers']
        }
      },
      quickActions: undefined
    };
  }

  /**
   * Initialize process data
   */
  private initializeProcessData(): ICreateViewModifyV2CreateOrUpdate {
    return (
      type,
      data,
      finished,
      _loading,
      _forms
    ) => {
      // a space at the end of the url would make the synchronization fail
      if (_.isString(data.url)) {
        data.url = data.url.trim();
      }

      // servers are saved as part of the system settings
      this.systemSettingsDataService
        .getSystemSettings()
        .pipe(
          catchError((err) => {
            // show error
            finished(err, undefined);

            // finished
            return throwError(err);
          }),

          // should be the last pipe
          takeUntil(this.destroyed$)
        )
        .subscribe((settings: SystemSettingsModel) => {
          settings.upstreamServers = settings.upstreamServers || [];

          if (type === CreateViewModifyV2ActionType.CREATE) {
            // add the new upstream server
            settings.upstreamServers.push(data);
          } else {
            // replace the server, keeping what isn't part of the form (e.g. auto encrypt)
            const index: number = settings.upstreamServers.findIndex((server) => server.url === this._originalUrl);
            if (index < 0) {
              finished('LNG_PAGE_MODIFY_SYSTEM_UPSTREAM_SERVER_NOT_FOUND', undefined);
              return;
            }

            // lists are replaced, otherwise outbreaks that were removed would be kept
            settings.upstreamServers[index] = _.mergeWith(
              {},
              settings.upstreamServers[index],
              data,
              (_objValue, srcValue) => Array.isArray(srcValue) ?
                srcValue :
                undefined
            );
          }

          // save upstream servers
          this.systemSettingsDataService
            .modifySystemSettings({
              upstreamServers: settings.upstreamServers
            })
            .pipe(
              catchError((err) => {
                // show error
                finished(err, undefined);

                // finished
                return throwError(err);
              }),

              // should be the last pipe
              takeUntil(this.destroyed$)
            )
            .subscribe(() => {
              // display success message
              this.toastV2Service.success(
                type === CreateViewModifyV2ActionType.CREATE ?
                  'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_ACTION_CREATE_UPSTREAM_SERVER_SUCCESS_MESSAGE' :
                  'LNG_PAGE_MODIFY_SYSTEM_UPSTREAM_SERVER_ACTION_MODIFY_UPSTREAM_SERVER_SUCCESS_MESSAGE'
              );

              // hide loading & redirect
              finished(undefined, settings);
            });
        });
    };
  }

  /**
   * Initialize expand list column renderer fields
   */
  protected initializeExpandListColumnRenderer(): void {}

  /**
   * Initialize expand list query fields
   */
  protected initializeExpandListQueryFields(): void {}

  /**
   * Initialize expand list advanced filters
   */
  protected initializeExpandListAdvancedFilters(): void {}

  /**
   * Refresh expand list
   */
  refreshExpandList(_data): void {}
}
