import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AddressModel } from '../../models/address.model';

/**
 * Record the WhatsApp message is sent to
 */
export interface IWhatsappChatRecipient {
  // record
  id: string;
  type: 'case' | 'contact';
  outbreakId: string;
  outbreakName?: string;

  // used by the message placeholders
  firstName?: string;
  lastName?: string;
  visualId?: string;

  // phone saved on the record ( current address first )
  phoneNumber?: string;
}

/**
 * Opens the floating WhatsApp chat ( app-whatsapp-chat, rendered by the authenticated layout )
 */
@Injectable({
  providedIn: 'root'
})
export class WhatsappChatService {
  // name of the browser tab used for WhatsApp Web ( reused by all messages, so the logged in session is kept in one tab )
  static readonly WHATSAPP_WEB_WINDOW_NAME: string = 'gd-whatsapp-web';

  // default country code used when the saved phone doesn't have one ( Brazil )
  static readonly DEFAULT_COUNTRY_CODE: string = '55';

  // open requests
  private _open$: Subject<IWhatsappChatRecipient> = new Subject<IWhatsappChatRecipient>();

  /**
   * Open requests
   */
  get open$(): Observable<IWhatsappChatRecipient> {
    return this._open$.asObservable();
  }

  /**
   * Determine the phone saved on a case / contact - current address first, then any address that has a phone
   */
  static personPhoneNumber(person: {
    mainAddress?: AddressModel,
    addresses?: AddressModel[]
  }): string {
    // current address
    const mainPhone: string = person?.mainAddress?.phoneNumber;
    if (mainPhone) {
      return mainPhone;
    }

    // any other address
    const address = (person?.addresses || []).find((item) => !!item?.phoneNumber);
    return address?.phoneNumber;
  }

  /**
   * Phone digits used by WhatsApp ( country code + number, no symbols )
   * - numbers without country code ( up to 11 digits ) receive the default country code
   */
  static normalizePhoneNumber(phoneNumber: string): string {
    // keep only digits
    const value: string = (phoneNumber || '').trim();
    let digits: string = value.replace(/\D/g, '');

    // international number ( +CC... / 00CC... ) - already has the country code
    if (value.startsWith('+')) {
      return digits;
    }
    if (digits.startsWith('00')) {
      return digits.substring(2);
    }

    // national trunk prefix ( e.g. 0 61 99999-9999 )
    if (
      digits.startsWith('0') &&
      digits.length >= 11 &&
      digits.length <= 12
    ) {
      digits = digits.substring(1);
    }

    // no country code ( area code + number ) ?
    if (
      digits.length >= 10 &&
      digits.length <= 11
    ) {
      digits = WhatsappChatService.DEFAULT_COUNTRY_CODE + digits;
    }

    // finished
    return digits;
  }

  /**
   * Check if the normalized phone looks valid for WhatsApp
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    const digits: string = WhatsappChatService.normalizePhoneNumber(phoneNumber);
    return digits.length >= 10 &&
      digits.length <= 15;
  }

  /**
   * Replace the message placeholders with the record data
   */
  static applyPlaceholders(
    message: string,
    recipient: IWhatsappChatRecipient
  ): string {
    const firstName: string = recipient?.firstName || '';
    const lastName: string = recipient?.lastName || '';
    const values: {
      [placeholder: string]: string
    } = {
      nome: firstName,
      sobrenome: lastName,
      nome_completo: [firstName, lastName].filter((item) => !!item).join(' '),
      id: recipient?.visualId || '',
      surto: recipient?.outbreakName || ''
    };

    return (message || '').replace(
      /\{(nome|sobrenome|nome_completo|id|surto)\}/gi,
      (_match, placeholder: string) => values[placeholder.toLowerCase()]
    );
  }

  /**
   * WhatsApp Web url that opens the conversation with the message ready to be sent
   */
  static whatsappWebUrl(
    phoneNumber: string,
    message: string
  ): string {
    return `https://web.whatsapp.com/send?phone=${WhatsappChatService.normalizePhoneNumber(phoneNumber)}&text=${encodeURIComponent(message || '')}`;
  }

  /**
   * Features of the small WhatsApp Web window, docked on the right side of the screen
   * - applied only when the window is created; next messages reuse the same window ( same size / position )
   */
  static whatsappWindowFeatures(): string {
    const screenData: any = window.screen || {};
    const availWidth: number = screenData.availWidth || window.innerWidth;
    const availHeight: number = screenData.availHeight || window.innerHeight;
    const availLeft: number = screenData.availLeft || 0;
    const availTop: number = screenData.availTop || 0;

    // WhatsApp Web needs ~750px to show the conversation without horizontal scroll
    const width: number = Math.min(760, availWidth);
    const height: number = Math.max(500, availHeight - 40);
    const left: number = availLeft + availWidth - width;
    const top: number = availTop;

    return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
  }

  /**
   * Open the chat for a record
   */
  open(recipient: IWhatsappChatRecipient): void {
    this._open$.next(recipient);
  }
}
