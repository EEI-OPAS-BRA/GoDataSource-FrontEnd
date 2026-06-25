# Edição em massa de questionário de contato — Fase 1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir e permitir editar, na tela de edição em massa de contatos, as perguntas do questionário de contato do surto (tipos texto, número, data e resposta única), incluindo sub-perguntas achatadas, editando a resposta mais recente em perguntas multi-answer.

**Architecture:** Um helper puro (`BulkQuestionnaireHelper`) achata o template do surto em perguntas planas, gera colunas dinâmicas do editor de planilha, normaliza as respostas ao carregar (mais recente em `[0]`) e reconstrói o objeto `questionnaireAnswers` completo ao salvar (preservando histórico). O componente `ContactsBulkCreateModifyComponent` consome o helper em `initializeTableColumns`, `initializeRecords` e `save`.

**Tech Stack:** Angular (TypeScript), lodash, editor de planilha customizado `app-spreadsheet-editor-v2`.

## Global Constraints

- Projeto **sem infraestrutura de testes** (sem Karma/Jasmine, sem `.spec.ts`). Verificação por `npm run lint`, `npm run build` (typecheck) e teste manual. Não criar infra de testes.
- Tipos de pergunta suportados na Fase 1 (valores em `Constants.ANSWER_TYPES`): `FREE_TEXT`→TEXT, `NUMERIC`→NUMBER, `DATE_TIME`→DATE, `SINGLE_SELECTION`→SINGLE_SELECT. **Fora:** `MULTIPLE_OPTIONS` (Fase 2), `FILE_UPLOAD`, `MARKUP`.
- Multi-answer: editar **apenas a resposta mais recente**; preservar as demais.
- Sub-perguntas aninhadas: incluir **todas como colunas planas**.
- Apenas **contatos** e apenas no modo **modify**.
- `questionnaireAnswers` tem o formato `{ [variable: string]: IAnswerData[] }`, `IAnswerData = { date?: string | Moment, value: any }`.
- Caminho de campo das colunas: `model.questionnaireAnswers.<variable>[0].value`.
- Variáveis de pergunta são identificadores seguros (sem `.`/`[]`); paths internos do helper usam forma de array do lodash (`[variable, 0, 'value']`).
- Branch de trabalho: `bulk-edit-contact-questionnaire` (já criado, contém a spec).

---

### Task 1: Helper — achatamento do template e geração de colunas

**Files:**
- Create: `src/app/core/helperClasses/bulk-questionnaire-helper.ts`

**Interfaces:**
- Produces:
  - `interface IBulkFlatQuestion { variable: string; text: string; answerType: string; multiAnswer: boolean; answers: AnswerModel[]; }`
  - `BulkQuestionnaireHelper.flattenTemplate(template: QuestionModel[]): IBulkFlatQuestion[]`
  - `BulkQuestionnaireHelper.buildColumns(flat: IBulkFlatQuestion[]): V2SpreadsheetEditorColumn[]`

- [ ] **Step 1: Criar o arquivo do helper com flatten + buildColumns**

Create `src/app/core/helperClasses/bulk-questionnaire-helper.ts`:

```ts
import { QuestionModel, AnswerModel } from '../models/question.model';
import { Constants } from '../models/constants';
import {
  V2SpreadsheetEditorColumn,
  V2SpreadsheetEditorColumnType
} from '../../shared/components-v2/app-spreadsheet-editor-v2/models/column.model';
import { ILabelValuePairModel } from '../../shared/forms-v2/core/label-value-pair.model';

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
}
```

- [ ] **Step 2: Lint do arquivo novo**

Run: `npm run lint`
Expected: sem erros novos referentes a `bulk-questionnaire-helper.ts`.

- [ ] **Step 3: Typecheck (build)**

Run: `npm run build`
Expected: build conclui sem erros de tipo. (Build é lento; alternativamente `npx tsc --noEmit -p tsconfig.app.json` se disponível.)

- [ ] **Step 4: Commit**

```bash
git add src/app/core/helperClasses/bulk-questionnaire-helper.ts
git commit -m "feat: add BulkQuestionnaireHelper template flatten + column builder"
```

---

### Task 2: Helper — normalização ao carregar e merge ao salvar

**Files:**
- Modify: `src/app/core/helperClasses/bulk-questionnaire-helper.ts`

**Interfaces:**
- Consumes: `IBulkFlatQuestion` (Task 1)
- Produces:
  - `BulkQuestionnaireHelper.normalizeAnswersForEdit(contact: { questionnaireAnswers?: { [variable: string]: IAnswerData[] } }, flat: IBulkFlatQuestion[]): void`
  - `BulkQuestionnaireHelper.mergeEditedAnswers(fullContact: { questionnaireAnswers?: { [variable: string]: IAnswerData[] } }, dirtyModel: any, flat: IBulkFlatQuestion[]): { [variable: string]: IAnswerData[] }`

- [ ] **Step 1: Adicionar imports de lodash, IAnswerData e LocalizationHelper**

Modify `src/app/core/helperClasses/bulk-questionnaire-helper.ts` — adicionar no topo, junto aos imports existentes:

```ts
import * as _ from 'lodash';
import { QuestionModel, AnswerModel, IAnswerData } from '../models/question.model';
import { LocalizationHelper } from './localization-helper';
```

(Substitui a linha de import de `question.model` para incluir `IAnswerData`; mantém `QuestionModel, AnswerModel`.)

- [ ] **Step 2: Adicionar os métodos de timestamp, normalização e merge**

Modify `src/app/core/helperClasses/bulk-questionnaire-helper.ts` — adicionar dentro da classe `BulkQuestionnaireHelper`, após `buildColumns`:

```ts
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
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros novos. (Se `AnswerModel` deixar de ser usado após edição de import, remover do import — atualmente ainda é usado em `IBulkFlatQuestion` e `buildColumns`.)

- [ ] **Step 4: Typecheck (build)**

Run: `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/helperClasses/bulk-questionnaire-helper.ts
git commit -m "feat: add questionnaire answer normalize + merge to BulkQuestionnaireHelper"
```

---

### Task 3: Componente — colunas dinâmicas + normalização ao carregar

**Files:**
- Modify: `src/app/features/contact/pages/contacts-bulk-create-modify/contacts-bulk-create-modify.component.ts`

**Interfaces:**
- Consumes: `BulkQuestionnaireHelper.flattenTemplate`, `BulkQuestionnaireHelper.buildColumns`, `BulkQuestionnaireHelper.normalizeAnswersForEdit`, `IBulkFlatQuestion` (Tasks 1–2)

- [ ] **Step 1: Importar o helper e o tipo**

Modify — adicionar aos imports do componente:

```ts
import { BulkQuestionnaireHelper, IBulkFlatQuestion } from '../../../../core/helperClasses/bulk-questionnaire-helper';
```

- [ ] **Step 2: Adicionar accessor memoizado das perguntas planas**

Modify — adicionar como membro da classe `ContactsBulkCreateModifyComponent` (junto aos demais campos privados, ex.: após `_manualClearedDateCells`):

```ts
  // perguntas do questionário de contato achatadas (memoizado)
  private _questionnaireFlat: IBulkFlatQuestion[];
  private get questionnaireFlat(): IBulkFlatQuestion[] {
    if (!this._questionnaireFlat) {
      this._questionnaireFlat = BulkQuestionnaireHelper.flattenTemplate(
        this.selectedOutbreak?.contactInvestigationTemplate
      );
    }
    return this._questionnaireFlat;
  }
```

- [ ] **Step 3: Anexar colunas do questionário ao final de initializeTableColumns**

Modify — em `initializeTableColumns()`, imediatamente antes do fechamento do método (após a atribuição de `this.tableColumns = [ ... ];`), adicionar:

```ts
    // anexar colunas do questionário de contato (apenas no modo modify; dinâmico por surto)
    if (this.isModify) {
      const questionnaireColumns = BulkQuestionnaireHelper.buildColumns(this.questionnaireFlat);
      if (questionnaireColumns.length) {
        this.tableColumns = this.tableColumns.concat(
          questionnaireColumns as V2SpreadsheetEditorColumnToVisibleMandatoryConf[]
        );
      }
    }
```

(`V2SpreadsheetEditorColumnToVisibleMandatoryConf` já está importado no componente. O setter de `tableColumns` aceita colunas sem `visibleMandatory` e as mantém visíveis.)

- [ ] **Step 4: Normalizar respostas ao carregar em initializeRecords**

Modify — em `initializeRecords()`, dentro do `.map((contact) => { ... })`, após `entity.model = contact;` e antes de `return entity;`, adicionar:

```ts
            // preparar respostas do questionário para edição (mais recente em [0])
            BulkQuestionnaireHelper.normalizeAnswersForEdit(
              contact,
              this.questionnaireFlat
            );
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 7: Verificação manual (exibição)**

Run: `npm start` (servidor em http://localhost:4550)
Passos:
1. Selecionar um surto com questionário de contato preenchido.
2. Em Contatos, marcar alguns contatos → "Modificar contatos selecionados".
3. Confirmar que aparecem colunas novas correspondentes às perguntas do questionário do surto (texto, número, data e resposta única), com valores atuais preenchidos.
4. Trocar para outro surto com questionário diferente e repetir; confirmar que as colunas mudam conforme o template.

Expected: colunas do questionário aparecem e refletem o template do surto; valores existentes são exibidos.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/contact/pages/contacts-bulk-create-modify/contacts-bulk-create-modify.component.ts
git commit -m "feat: show contact questionnaire columns in bulk modify grid"
```

---

### Task 4: Componente — merge e persistência ao salvar

**Files:**
- Modify: `src/app/features/contact/pages/contacts-bulk-create-modify/contacts-bulk-create-modify.component.ts`

**Interfaces:**
- Consumes: `BulkQuestionnaireHelper.mergeEditedAnswers` (Task 2), `this.questionnaireFlat` (Task 3)

- [ ] **Step 1: Reconstruir questionnaireAnswers completo no payload de modify**

Modify — em `save()`, no ramo `else` (isModify), dentro do `event.rows.reduce(...)`, substituir o bloco que monta e empurra o item:

De:

```ts
          // add data
          acc.push({
            id: row.full.model.id,
            ...row.dirty.model
          });

          // finished
          return acc;
```

Para:

```ts
          // montar payload base com os campos sujos
          const payload: any = {
            id: row.full.model.id,
            ...row.dirty.model
          };

          // se houve alteração em respostas do questionário, enviar o objeto completo
          // (o backend substitui questionnaireAnswers inteiro; precisamos preservar histórico)
          if (row.dirty.model.questionnaireAnswers) {
            payload.questionnaireAnswers = BulkQuestionnaireHelper.mergeEditedAnswers(
              row.full.model,
              row.dirty.model,
              this.questionnaireFlat
            );
          }

          // add data
          acc.push(payload);

          // finished
          return acc;
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Verificação manual (persistência e histórico)**

Run: `npm start`
Passos:
1. Edição em massa de contatos (surto com questionário). Editar valores de perguntas de cada tipo (texto, número, data, resposta única). Salvar.
2. Reabrir um contato editado (visualizar/editar) e confirmar que os novos valores persistiram no questionário.
3. Para uma pergunta **multi-answer** com histórico (várias respostas datadas): antes de editar, anotar o histórico; editar a resposta mais recente via edição em massa; salvar; reabrir e confirmar que **apenas a entrada mais recente mudou** e as anteriores foram preservadas.
4. Verificar que campos de contato NÃO relacionados ao questionário continuam salvando normalmente (regressão).

Expected: valores persistem; histórico multi-answer preservado; campos comuns sem regressão.

⚠️ **Ponto de atenção a validar neste passo:** confirmar que o editor preenche `row.dirty.model.questionnaireAnswers` quando uma célula aninhada (`model.questionnaireAnswers.<var>[0].value`) é alterada. Se o diff de "dirty" não incluir o caminho aninhado, ajustar a detecção (ex.: comparar `row.full` vs valor atual) — registrar como follow-up se ocorrer.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/contact/pages/contacts-bulk-create-modify/contacts-bulk-create-modify.component.ts
git commit -m "feat: persist edited contact questionnaire answers in bulk modify"
```

---

## Cobertura da spec (self-review)

- Geração dinâmica de colunas por surto → Task 1 (`buildColumns`) + Task 3 (wire em `initializeTableColumns`).
- Achatamento de sub-perguntas → Task 1 (`flattenTemplate`).
- Mapeamento de tipos (texto/número/data/resposta única) → Task 1; multi-select fora (Fase 2).
- Ignorar inativas / FILE_UPLOAD / MARKUP → Task 1.
- Normalização multi-answer (mais recente em [0]) → Task 2 (`normalizeAnswersForEdit`) + Task 3 (wire em `initializeRecords`).
- Merge preservando histórico no save → Task 2 (`mergeEditedAnswers`) + Task 4 (wire em `save`).
- Somente contatos / somente modify → Task 3 (gate `isModify`).
- Verificação lint + build + manual (sem testes unitários) → todos os tasks.

## Follow-ups conhecidos (fora da Fase 1)

- Fase 2: tipo de célula `MULTIPLE_SELECT` e mapeamento de `MULTIPLE_OPTIONS`.
- Confirmar comportamento de `date` ao editar (espelhar formulário individual) — atualmente: mantém data existente ou usa `now()` em entrada nova.
- Avaliar edição em massa de questionário no modo create e reuso para casos.
