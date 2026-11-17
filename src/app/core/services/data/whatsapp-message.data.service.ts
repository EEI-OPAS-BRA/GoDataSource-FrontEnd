import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ModelHelperService } from '../helper/model-helper.service';
import { RequestQueryBuilder } from '../../helperClasses/request-query-builder';
import { WhatsappMessageModel } from '../../models/whatsapp-message.model';
import { IBasicCount } from '../../models/basic-count.interface';

@Injectable()
export class WhatsappMessageDataService {

  constructor(
    private http: HttpClient,
    private modelHelper: ModelHelperService
  ) {
  }

  /**
   * Retrieve the list of WhatsApp messages
   */
  getWhatsappMessagesList(
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<WhatsappMessageModel[]> {
    const filter = queryBuilder.buildQuery();
    return this.modelHelper.mapObservableListToModel(
      this.http.get(`whatsapp-messages?filter=${filter}`),
      WhatsappMessageModel
    );
  }

  /**
   * Return total number of WhatsApp messages
   */
  getWhatsappMessagesCount(
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<IBasicCount> {
    const whereFilter = queryBuilder.filter.generateCondition(true);
    return this.http.get(`whatsapp-messages/count?where=${whereFilter}`);
  }

  /**
   * Create a new WhatsApp message
   */
  createWhatsappMessage(data: any): Observable<any> {
    return this.http.post('whatsapp-messages', data);
  }

  /**
   * Modify an existing WhatsApp message
   */
  modifyWhatsappMessage(whatsappMessageId: string, data: any): Observable<WhatsappMessageModel> {
    return this.modelHelper.mapObservableToModel(
      this.http.patch(`whatsapp-messages/${whatsappMessageId}`, data),
      WhatsappMessageModel
    );
  }

  /**
   * Delete an existing WhatsApp message
   */
  deleteWhatsappMessage(whatsappMessageId: string): Observable<any> {
    return this.http.delete(`whatsapp-messages/${whatsappMessageId}`);
  }
}
