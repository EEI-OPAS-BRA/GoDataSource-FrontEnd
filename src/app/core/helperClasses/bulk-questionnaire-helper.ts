import * as _ from 'lodash';
import { QuestionModel, AnswerModel, IAnswerData } from '../models/question.model';
import { Constants } from '../models/constants';
import {
  V2SpreadsheetEditorColumn,
  V2SpreadsheetEditorColumnType
} from '../../shared/components-v2/app-spreadsheet-editor-v2/models/column.model';
import { ILabelValuePairModel } from '../../shared/forms-v2/core/label-value-pair.model';
import { LocalizationHelper } from './localization-helper';

/**
 * Pergunta do questionário achatada para virar uma coluna do grid
 */
export interface IBulkFlatQuestion {
  variable: string;
  text: string;
  answerType: string;
  multiAnswer: boolean;
  answers: AnswerModel[];
}

export abstract class BulkQuestionnaireHelper {
  /**
   * Tipos de pergunta suportados na Fase 1 e a célula correspondente.
   * MULTIPLE_OPTIONS (Fase 2), FILE_UPLOAD e MARKUP ficam de fora.
   */
  private static readonly SUPPORTED_ANSWER_TYPES: {
    [answerType: string]: V2SpreadsheetEditorColumnType
  } = {
      [Constants.ANSWER_TYPES.FREE_TEXT.value]: V2SpreadsheetEditorColumnType.TEXT,
      [Constants.ANSWER_TYPES.NUMERIC.value]: V2SpreadsheetEditorColumnType.NUMBER,
      [Constants.ANSWER_TYPES.DATE_TIME.value]: V2SpreadsheetEditorColumnType.DATE,
      [Constants.ANSWER_TYPES.SINGLE_SELECTION.value]: V2SpreadsheetEditorColumnType.SINGLE_SELECT
    };

  /**
   * Achata o template (perguntas + sub-perguntas aninhadas) numa lista plana.
   * - Ignora perguntas inativas, sem variável e de tipos não suportados.
   * - Mesmo quando o tipo do "pai" não é suportado (ex.: múltipla escolha),
   *   continua descendo nas sub-perguntas para não perder colunas aninhadas.
   * - Deduplica por variável (mantém a primeira ocorrência).
   */
  static flattenTemplate(template: QuestionModel[]): IBulkFlatQuestion[] {
    const result: IBulkFlatQuestion[] = [];
    const seen: { [variable: string]: true } = {};

    const walk = (questions: QuestionModel[]) => {
      (questions || []).forEach((question) => {
        if (!question) {
          return;
        }

        // pergunta editável ?
        const supported: boolean = !question.inactive &&
          !!question.variable &&
          !!BulkQuestionnaireHelper.SUPPORTED_ANSWER_TYPES[question.answerType];

        if (
          supported &&
          !seen[question.variable]
        ) {
          seen[question.variable] = true;
          result.push({
            variable: question.variable,
            text: question.text,
            answerType: question.answerType,
            multiAnswer: !!question.multiAnswer,
            answers: question.answers || []
          });
        }

        // sempre descer nas sub-perguntas (mesmo se o pai não for suportado)
        (question.answers || []).forEach((answer: AnswerModel) => {
          walk(answer.additionalQuestions);
        });
      });
    };

    walk(template);
    return result;
  }

  /**
   * Gera uma coluna do editor de planilha por pergunta plana.
   */
  static buildColumns(flat: IBulkFlatQuestion[]): V2SpreadsheetEditorColumn[] {
    return (flat || []).map((question) => {
      const type: V2SpreadsheetEditorColumnType = BulkQuestionnaireHelper.SUPPORTED_ANSWER_TYPES[question.answerType];
      const field = `model.questionnaireAnswers.${question.variable}[0].value`;

      // resposta única -> dropdown com opções vindas das respostas do template
      if (type === V2SpreadsheetEditorColumnType.SINGLE_SELECT) {
        const options: ILabelValuePairModel[] = (question.answers || []).map((answer) => ({
          label: answer.label,
          value: answer.value
        }));
        return {
          type: V2SpreadsheetEditorColumnType.SINGLE_SELECT,
          label: question.text,
          field,
          options
        };
      }

      // texto / número / data
      return {
        type,
        label: question.text,
        field
      } as V2SpreadsheetEditorColumn;
    });
  }

  /**
   * Timestamp (ms) de uma resposta para ordenação; entradas sem data vão para o fim (mais antigas).
   */
  private static answerTimestamp(answer: IAnswerData): number {
    if (!answer || !answer.date) {
      return Number.NEGATIVE_INFINITY;
    }
    const moment = LocalizationHelper.toMoment(answer.date);
    return moment && moment.isValid() ?
      moment.valueOf() :
      Number.NEGATIVE_INFINITY;
  }

  /**
   * Prepara as respostas de um contato para edição:
   * - garante que questionnaireAnswers exista;
   * - em perguntas multi-answer, ordena por data desc (mais recente no índice [0]).
   * Não cria entradas vazias para perguntas sem resposta.
   */
  static normalizeAnswersForEdit(
    contact: { questionnaireAnswers?: { [variable: string]: IAnswerData[] } },
    flat: IBulkFlatQuestion[]
  ): void {
    if (!contact.questionnaireAnswers) {
      contact.questionnaireAnswers = {};
    }

    (flat || []).forEach((question) => {
      const entries = contact.questionnaireAnswers[question.variable];
      if (
        !question.multiAnswer ||
        !Array.isArray(entries) ||
        entries.length < 2
      ) {
        return;
      }

      // mais recente primeiro
      entries.sort((a, b) =>
        BulkQuestionnaireHelper.answerTimestamp(b) - BulkQuestionnaireHelper.answerTimestamp(a)
      );
    });
  }

  /**
   * Reconstrói o objeto questionnaireAnswers completo do contato aplicando os valores editados.
   * - Parte do full (já normalizado) para preservar histórico e variáveis não tocadas.
   * - Para cada variável alterada no dirty, sobrescreve o valor da entrada mais recente [0]
   *   (criando a entrada se não existir).
   */
  static mergeEditedAnswers(
    fullContact: { questionnaireAnswers?: { [variable: string]: IAnswerData[] } },
    dirtyModel: any,
    flat: IBulkFlatQuestion[]
  ): { [variable: string]: IAnswerData[] } {
    const merged: { [variable: string]: IAnswerData[] } = _.cloneDeep(fullContact.questionnaireAnswers || {});
    const dirtyAnswers = _.get(dirtyModel, 'questionnaireAnswers');
    if (!dirtyAnswers) {
      return merged;
    }

    (flat || []).forEach((question) => {
      // a variável foi alterada ?
      const path: [string, number, string] = [question.variable, 0, 'value'];
      if (!_.has(dirtyAnswers, path)) {
        return;
      }

      const newValue = _.get(dirtyAnswers, path);
      if (
        !Array.isArray(merged[question.variable]) ||
        merged[question.variable].length < 1
      ) {
        // criar a primeira (mais recente) entrada
        merged[question.variable] = [{
          date: LocalizationHelper.now().toISOString(),
          value: newValue
        }];
      } else {
        // sobrescrever valor da entrada mais recente, mantendo a data (ou definindo se ausente)
        merged[question.variable][0] = {
          ...merged[question.variable][0],
          value: newValue,
          date: merged[question.variable][0].date || LocalizationHelper.now().toISOString()
        };
      }
    });

    return merged;
  }
}
