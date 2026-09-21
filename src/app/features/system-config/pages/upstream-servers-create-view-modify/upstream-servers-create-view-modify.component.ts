import { Component, OnDestroy, Renderer2 } from '@angular/core';
import { CreateViewModifyComponent } from '../../../../core/helperClasses/create-view-modify-component';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardModel } from '../../../../core/models/dashboard.model';
import { AuthDataService } from '../../../../core/services/data/auth.data.service';
import { Observable, Subscription, throwError } from 'rxjs';
import {
  CreateViewModifyV2TabInput,
  CreateViewModifyV2TabInputType,
  ICreateViewModifyV2Buttons,
  ICreateViewModifyV2CreateOrUpdate,
  ICreateViewModifyV2Tab
} from '../../../../shared/components-v2/app-create-view-modify-v2/models/tab.model';
import { SystemUpstreamServerModel } from '../../../../core/models/system-upstream-server.model';
import { SystemSettingsDataService } from '../../../../core/services/data/system-settings.data.service';
import { SystemSyncDataService } from '../../../../core/services/data/system-sync.data.service';
import { ISystemUpstreamServerCheckServer } from '../../../../core/models/system-upstream-server-check.model';
import { IAppFormIconButtonV2 } from '../../../../shared/forms-v2/core/app-form-icon-button-v2';
import { catchError } from 'rxjs/operators';
import { SystemSettingsModel } from '../../../../core/models/system-settings.model';
import { OutbreakAndOutbreakTemplateHelperService } from '../../../../core/services/helper/outbreak-and-outbreak-template-helper.service';
import { RedirectService } from '../../../../core/services/helper/redirect.service';
import { ToastV2Service } from '../../../../core/services/helper/toast-v2.service';
import { I18nService } from '../../../../core/services/helper/i18n.service';

/**
 * Component
 */
@Component({
  selector: 'app-upstream-servers-create-view-modify',
  templateUrl: './upstream-servers-create-view-modify.component.html'
})
export class UpstreamServersCreateViewModifyComponent extends CreateViewModifyComponent<SystemUpstreamServerModel> implements OnDestroy {
  // message displayed for each error code returned by the api when checking a server
  private static readonly CHECK_ERROR_MESSAGES: {
    [errorCode: string]: string
  } = {
      CONNECTION_REFUSED: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_CONNECTION_REFUSED',
      HOST_NOT_FOUND: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_HOST_NOT_FOUND',
      TIMEOUT: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_TIMEOUT',
      CERTIFICATE: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_CERTIFICATE',
      UNEXPECTED_RESPONSE: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_NOT_GODATA',
      HTTP_ERROR: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_NOT_GODATA',
      INVALID_CREDENTIALS: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_INVALID_CREDENTIALS',
      API_NOT_FOUND: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_API_NOT_FOUND'
    };

  // upstream servers map
  private _upstreamServersMap: {
    [url: string]: true
  } = {};

  // url input; its icons show if the server is online
  private _urlInput: Extract<CreateViewModifyV2TabInput, { type: CreateViewModifyV2TabInputType.TEXT }>;

  // status of the server that has the url from the form
  private _serverStatus: 'idle' | 'checking' | 'online' | 'offline' = 'idle';

  // connection test
  private _testingConnection: boolean = false;
  private _checkResult: {
    status: 'success' | 'error' | 'warning',
    icon: string,
    message: string
  };
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

    // map upstream servers
    const upstreamServers: SystemUpstreamServerModel[] = activatedRoute.snapshot.data.upstreamServers;
    upstreamServers.forEach((upstreamServer) => {
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
    return null;
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
    this.pageTitle = 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TITLE';
    this.pageTitleData = undefined;
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
      label: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TITLE',
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
    // url input is kept to be able to refresh its icons
    this._urlInput = {
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
          this.itemData.url = value;

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
      },
      suffixIconButtons: this.buildUrlSuffixIconButtons()
    };

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
            this._urlInput, {
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
              name: 'testConnection',
              label: () => 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_TEST_CONNECTION_BUTTON',
              icon: 'vpn_lock',
              loading: () => this._testingConnection,
              disabled: () => !this.itemData.url?.trim() ||
                !this.itemData.credentials.clientId ||
                !this.itemData.credentials.clientSecret ||
                this._serverStatus === 'checking',
              click: () => this.testConnection(),
              result: () => this._checkResult
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
   * Icons displayed at the right of the url input: check if the server is online + result of the last check
   */
  private buildUrlSuffixIconButtons(): IAppFormIconButtonV2[] {
    const buttons: IAppFormIconButtonV2[] = [{
      icon: 'power',
      tooltip: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_BUTTON',
      disabled: () => !this.itemData.url?.trim() ||
        this._serverStatus === 'checking',
      clickAction: () => this.checkServer()
    }];

    switch (this._serverStatus) {
      case 'checking':
        buttons.push({
          icon: 'hourglass_empty',
          tooltip: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_CHECKING',
          disabled: () => true
        });
        break;

      case 'online':
        buttons.push({
          icon: 'check_circle',
          color: 'var(--gd-success)',
          tooltip: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_ONLINE',
          clickAction: () => this.checkServer()
        });
        break;

      case 'offline':
        buttons.push({
          icon: 'error',
          color: 'var(--gd-danger)',
          tooltip: 'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_OFFLINE',
          clickAction: () => this.checkServer()
        });
        break;
    }

    return buttons;
  }

  /**
   * Redraw the form, since the inputs don't check for changes on their own
   */
  private refreshCheckUi(): void {
    // new reference, otherwise the url input doesn't redraw its icons
    this._urlInput.suffixIconButtons = this.buildUrlSuffixIconButtons();
    this.createViewModifyComponent?.detectChanges();
  }

  /**
   * Url / credentials changed, so what we know about the server isn't valid anymore
   */
  private connectionFieldChanged(urlChanged: boolean): void {
    // nothing to reset ?
    if (
      !this._checkResult &&
      !this._testingConnection &&
      (!urlChanged || this._serverStatus === 'idle')
    ) {
      return;
    }

    // ignore the pending response, it was made for other values
    this._checkSubscription?.unsubscribe();
    this._checkSubscription = undefined;
    this._testingConnection = false;
    this._checkResult = undefined;
    if (
      urlChanged ||
      this._serverStatus === 'checking'
    ) {
      this._serverStatus = 'idle';
    }

    // redraw
    this.refreshCheckUi();
  }

  /**
   * Message for an error returned by the api when checking a server
   */
  private getCheckErrorMessage(
    errorCode: string,
    code?: string
  ): string {
    const message: string = this.i18nService.instant(
      UpstreamServersCreateViewModifyComponent.CHECK_ERROR_MESSAGES[errorCode] ||
      'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_CONNECTION_FAILED'
    );

    // technical code helps to find out what is wrong
    return !UpstreamServersCreateViewModifyComponent.CHECK_ERROR_MESSAGES[errorCode] && code ?
      `${message} (${code})` :
      message;
  }

  /**
   * Update the state with the status of the server
   */
  private applyServerResult(server: ISystemUpstreamServerCheckServer): void {
    if (server.online) {
      this._serverStatus = 'online';
      this._checkResult = {
        status: 'success',
        icon: 'check_circle',
        message: this.i18nService.instant(
          'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_SERVER_ONLINE_MESSAGE', {
            ms: server.responseTimeMs
          }
        )
      };
    } else {
      this._serverStatus = 'offline';
      this._checkResult = {
        status: 'error',
        icon: 'error',
        message: this.getCheckErrorMessage(
          server.errorCode,
          server.code
        )
      };
    }
  }

  /**
   * The request failed before we got a result from the check
   */
  private handleCheckRequestError(err: any): void {
    this._serverStatus = 'idle';
    this._testingConnection = false;

    // invalid url is displayed with the check results
    if (err?.code === 'REQUEST_VALIDATION_ERROR') {
      this._checkResult = {
        status: 'error',
        icon: 'error',
        message: this.i18nService.instant('LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_ERROR_INVALID_URL')
      };
    } else {
      this._checkResult = undefined;
      this.toastV2Service.error(err);
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
    this._testingConnection = false;
    this._serverStatus = 'checking';
    this._checkResult = undefined;
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
        error: (err) => this.handleCheckRequestError(err)
      });
  }

  /**
   * Check the server and if it accepts the credentials
   */
  private testConnection(): void {
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
    this._testingConnection = true;
    this._checkResult = undefined;
    this.refreshCheckUi();

    this._checkSubscription = this.systemSyncDataService
      .checkUpstreamServer({
        url,
        clientId,
        clientSecret
      })
      .subscribe({
        next: (result) => {
          this._testingConnection = false;
          this.applyServerResult(result.server);

          // credentials are checked only if the server is online
          if (
            result.server.online &&
            result.credentials
          ) {
            if (result.credentials.valid) {
              const outbreaksCount: number = result.credentials.outbreakIDs?.length || 0;
              this._checkResult = {
                status: 'success',
                icon: 'check_circle',
                message: this.i18nService.instant(
                  outbreaksCount > 0 ?
                    'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_CREDENTIALS_ACCEPTED_SOME_OUTBREAKS' :
                    'LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_CHECK_CREDENTIALS_ACCEPTED_ALL_OUTBREAKS', {
                    count: outbreaksCount
                  }
                )
              };
            } else {
              this._checkResult = {
                status: 'error',
                icon: 'error',
                message: this.getCheckErrorMessage(
                  result.credentials.errorCode,
                  result.credentials.code
                )
              };
            }
          }

          this.refreshCheckUi();
        },
        error: (err) => this.handleCheckRequestError(err)
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
      modifyCancel: undefined,
      quickActions: undefined
    };
  }

  /**
   * Initialize process data
   */
  private initializeProcessData(): ICreateViewModifyV2CreateOrUpdate {
    return (
      _type,
      data,
      finished,
      _loading,
      _forms
    ) => {
      // always create
      this.systemSettingsDataService
        .getSystemSettings()
        .pipe(
          catchError((err) => {
            // show error
            finished(err, undefined);

            // finished
            return throwError(err);
          })
        )
        .subscribe((settings: SystemSettingsModel) => {
          // add the new upstream server
          settings.upstreamServers = settings.upstreamServers || [];
          settings.upstreamServers.push(data);

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
              })
            )
            .subscribe(() => {
              // display success message
              this.toastV2Service.success('LNG_PAGE_CREATE_SYSTEM_UPSTREAM_SERVER_ACTION_CREATE_UPSTREAM_SERVER_SUCCESS_MESSAGE');

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
