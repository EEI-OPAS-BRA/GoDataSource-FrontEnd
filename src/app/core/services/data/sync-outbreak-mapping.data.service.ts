import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ModelHelperService } from '../helper/model-helper.service';
import { RequestQueryBuilder } from '../../helperClasses/request-query-builder';
import {
  ISyncOutbreakMappingApproveResult,
  ISyncOutbreakMappingDetails,
  ISyncOutbreakMappingQuestionMappings,
  ISyncOutbreakMappingQuestionnaires,
  SyncOutbreakMappingMode,
  SyncOutbreakMappingModel
} from '../../models/sync-outbreak-mapping.model';

@Injectable({
  providedIn: 'root'
})
export class SyncOutbreakMappingDataService {
  /**
   * Constructor
   */
  constructor(
    private http: HttpClient,
    private modelHelper: ModelHelperService
  ) {}

  /**
   * Mappings of the outbreaks received from other instances
   */
  getMappingsList(
    queryBuilder: RequestQueryBuilder = new RequestQueryBuilder()
  ): Observable<SyncOutbreakMappingModel[]> {
    const filter = queryBuilder.buildQuery();
    return this.modelHelper.mapObservableListToModel(
      this.http.get(`sync-outbreak-mappings?filter=${filter}`),
      SyncOutbreakMappingModel
    );
  }

  /**
   * What is needed to map a received outbreak
   */
  getMappingDetails(id: string): Observable<ISyncOutbreakMappingDetails> {
    return this.http
      .get(`sync-outbreak-mappings/${id}/details`)
      .pipe(
        map((details: ISyncOutbreakMappingDetails) => Object.assign({}, details, {
          mapping: new SyncOutbreakMappingModel(details.mapping)
        }))
      );
  }

  /**
   * Questionnaires of an outbreak of this instance
   */
  getTargetQuestionnaires(outbreakId: string): Observable<ISyncOutbreakMappingQuestionnaires> {
    return this.http.get(`sync-outbreak-mappings/target-questionnaires?outbreakId=${encodeURIComponent(outbreakId)}`) as Observable<ISyncOutbreakMappingQuestionnaires>;
  }

  /**
   * Approve a mapping & import the records that were waiting for it
   */
  approveMapping(
    id: string,
    data: {
      mode: SyncOutbreakMappingMode,
      targetOutbreakId?: string,
      questionMappings?: ISyncOutbreakMappingQuestionMappings
    }
  ): Observable<ISyncOutbreakMappingApproveResult> {
    return this.http.post(`sync-outbreak-mappings/${id}/approve`, data) as Observable<ISyncOutbreakMappingApproveResult>;
  }
}
