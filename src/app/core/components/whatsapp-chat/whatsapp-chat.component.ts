import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { Subscription, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RequestQueryBuilder } from '../../helperClasses/request-query-builder';
import { RequestSortDirection } from '../../helperClasses/request-query-builder/request-sort';
import { Constants } from '../../models/constants';
import { WhatsappMessageModel } from '../../models/whatsapp-message.model';
import { WhatsappMessageDataService } from '../../services/data/whatsapp-message.data.service';
import { ToastV2Service } from '../../services/helper/toast-v2.service';
import { IWhatsappChatRecipient, WhatsappChatService } from '../../services/helper/whatsapp-chat.service';

// WhatsApp logo ( registered as the "whatsapp" svg icon )
const WHATSAPP_ICON_SVG: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.41 9.41 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.79.72.7 5.81.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.62l6.02-1.58a11.34 11.34 0 0 0 5.42 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.03"/></svg>';

@Component({
  selector: 'app-whatsapp-chat',
  templateUrl: './whatsapp-chat.component.html',
  styleUrls: ['./whatsapp-chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhatsappChatComponent implements OnInit, OnDestroy {
  // chat state
  visible: boolean = false;
  minimized: boolean = false;
  loading: boolean = false;

  // recipient
  recipient: IWhatsappChatRecipient;
  phoneNumber: string;

  // messages configured for the recipient outbreak
  templates: WhatsappMessageModel[] = [];
  selectedTemplateId: string;
  message: string;

  // subscriptions
  private _openSubscription: Subscription;
  private _loadSubscription: Subscription;

  /**
   * Constructor
   */
  constructor(
    private whatsappChatService: WhatsappChatService,
    private whatsappMessageDataService: WhatsappMessageDataService,
    private toastV2Service: ToastV2Service,
    private changeDetectorRef: ChangeDetectorRef,
    matIconRegistry: MatIconRegistry,
    domSanitizer: DomSanitizer
  ) {
    // register the WhatsApp icon ( used by the chat and by the list actions )
    matIconRegistry.addSvgIconLiteral(
      'whatsapp',
      domSanitizer.bypassSecurityTrustHtml(WHATSAPP_ICON_SVG)
    );
  }

  /**
   * Component initialized
   */
  ngOnInit(): void {
    this._openSubscription = this.whatsappChatService.open$.subscribe((recipient) => {
      this.openChat(recipient);
    });
  }

  /**
   * Release resources
   */
  ngOnDestroy(): void {
    this._openSubscription?.unsubscribe();
    this._openSubscription = undefined;
    this.stopLoading();
  }

  /**
   * Full name of the recipient
   */
  get recipientName(): string {
    return [
      this.recipient?.firstName,
      this.recipient?.lastName
    ].filter((item) => !!item).join(' ');
  }

  /**
   * Phone digits used by WhatsApp
   */
  get normalizedPhoneNumber(): string {
    return WhatsappChatService.normalizePhoneNumber(this.phoneNumber);
  }

  /**
   * Phone is valid ?
   */
  get validPhoneNumber(): boolean {
    return WhatsappChatService.isValidPhoneNumber(this.phoneNumber);
  }

  /**
   * Can send ?
   */
  get canSend(): boolean {
    return this.validPhoneNumber &&
      !!this.message?.trim();
  }

  /**
   * Open the chat for a recipient
   */
  private openChat(recipient: IWhatsappChatRecipient): void {
    // reset
    this.recipient = recipient;
    this.phoneNumber = recipient.phoneNumber || '';
    this.templates = [];
    this.selectedTemplateId = undefined;
    this.message = '';
    this.visible = true;
    this.minimized = false;

    // load the messages configured for the outbreak
    this.stopLoading();
    this.loading = true;
    this.changeDetectorRef.detectChanges();

    const qb = new RequestQueryBuilder();
    qb.fields('id', 'title', 'message', 'appliesTo', 'active', 'outbreakId');
    qb.filter.where({
      outbreakId: recipient.outbreakId
    });
    qb.filter.where({
      active: true
    });
    qb.filter.where({
      appliesTo: {
        inq: [
          Constants.WHATSAPP_MESSAGE_APPLIES_TO.ALL.value,
          recipient.type
        ]
      }
    });
    qb.sort.by('title', RequestSortDirection.ASC);
    this._loadSubscription = this.whatsappMessageDataService
      .getWhatsappMessagesList(qb)
      .pipe(
        catchError((err) => {
          this.toastV2Service.error(err);
          this.loading = false;
          this.changeDetectorRef.detectChanges();
          return throwError(err);
        })
      )
      .subscribe((templates) => {
        this.templates = templates;
        this.loading = false;

        // select the first message
        if (templates.length > 0) {
          this.selectTemplate(templates[0].id);
        }

        // update ui
        this.changeDetectorRef.detectChanges();
      });
  }

  /**
   * Stop loading messages
   */
  private stopLoading(): void {
    this._loadSubscription?.unsubscribe();
    this._loadSubscription = undefined;
  }

  /**
   * Select a configured message
   */
  selectTemplate(templateId: string): void {
    this.selectedTemplateId = templateId;
    const template = this.templates.find((item) => item.id === templateId);
    this.message = template ?
      WhatsappChatService.applyPlaceholders(
        template.message,
        this.recipient
      ) :
      '';
  }

  /**
   * Open WhatsApp Web with the message ready to be sent
   */
  send(): void {
    // nothing to send ?
    if (!this.canSend) {
      return;
    }

    // open WhatsApp Web in a small window docked on the right side of the screen
    // ( same window for all messages, so the browser session is reused )
    const whatsappWindow = window.open(
      WhatsappChatService.whatsappWebUrl(
        this.phoneNumber,
        this.message
      ),
      WhatsappChatService.WHATSAPP_WEB_WINDOW_NAME,
      WhatsappChatService.whatsappWindowFeatures()
    );

    // popup blocked ?
    if (!whatsappWindow) {
      this.toastV2Service.notice('LNG_WHATSAPP_CHAT_POPUP_BLOCKED');
      return;
    }

    // bring it to the front
    whatsappWindow.focus();
  }

  /**
   * Minimize / restore
   */
  toggleMinimized(): void {
    this.minimized = !this.minimized;
    this.changeDetectorRef.detectChanges();
  }

  /**
   * Close chat
   */
  close(): void {
    this.stopLoading();
    this.visible = false;
    this.recipient = undefined;
    this.changeDetectorRef.detectChanges();
  }
}
