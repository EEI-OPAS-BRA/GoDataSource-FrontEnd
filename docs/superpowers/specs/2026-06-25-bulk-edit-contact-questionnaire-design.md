# Edição em massa de respostas do questionário de contato

**Data:** 2026-06-25
**Status:** Aprovado (design) — pendente implementação
**Repositório:** GoDataSource-FrontEnd (somente front-end; backend já suportado)

## Objetivo

Na tela de **edição em massa de contatos** ("Modificar contatos em grupos"), além dos campos
fixos do contato, exibir e permitir editar as **variáveis do questionário de contato** definidas
no surto selecionado. Como cada surto tem um questionário diferente
(`outbreak.contactInvestigationTemplate`), as colunas devem ser geradas **dinamicamente** por surto.

## Contexto / estado atual

- Componente: `src/app/features/contact/pages/contacts-bulk-create-modify/contacts-bulk-create-modify.component.ts`.
  - `initializeTableColumns()` monta uma lista **estática** de colunas (propriedades do contato,
    documentos, endereço, epidemiologia, relacionamento). Não há nenhuma coluna de questionário.
  - `initializeRecords()` busca os contatos selecionados (via `bulkCacheHelperService`) e popula o grid.
  - `save()` (ramo `isModify`) envia `{ id, ...row.dirty.model }` por contato para
    `PUT outbreaks/{id}/contacts/bulk`.
- Editor de planilha: `src/app/shared/components-v2/app-spreadsheet-editor-v2/`.
  - Tipos de célula existentes (`V2SpreadsheetEditorColumnType`): `TEXT`, `SINGLE_SELECT`, `DATE`,
    `LOCATION`, `NUMBER`. **Não existe** multi-seleção nem upload de arquivo.
  - Caminhos de campo aninhados em array já são suportados (ex.: `model.documents[0].type`).
- Modelo: `ContactModel.questionnaireAnswers: { [variable: string]: IAnswerData[] }`,
  onde `IAnswerData = { date?: string | Moment, value: any }`.
- Template: `QuestionModel[]` (perguntas), cada `AnswerModel` pode ter `additionalQuestions: QuestionModel[]`
  (sub-perguntas condicionais). Tipos em `Constants.ANSWER_TYPES`:
  `FREE_TEXT`, `NUMERIC`, `DATE_TIME`, `SINGLE_SELECTION`, `MULTIPLE_OPTIONS`, `FILE_UPLOAD`, `MARKUP`.
- Backend: `Outbreak.modifyMultiplePersons` (`common/models/outbreak.js`) usa
  `updateAttributes(existingContact, options)` genérico do LoopBack — **aceita `questionnaireAnswers`
  sem alteração**. ⚠️ `updateAttributes` substitui o atributo `questionnaireAnswers` **inteiro**.

## Decisões de escopo (acordadas)

1. **Tipos de pergunta:** cobrir o máximo viável.
   - Fase 1: `FREE_TEXT`→TEXT, `NUMERIC`→NUMBER, `DATE_TIME`→DATE, `SINGLE_SELECTION`→SINGLE_SELECT.
   - Fase 2: `MULTIPLE_OPTIONS`→novo tipo MULTIPLE_SELECT.
   - **Fora de escopo:** `FILE_UPLOAD` (não editável em grid) e `MARKUP` (não tem valor/resposta).
   - Perguntas `inactive` são ignoradas.
2. **Multi-answer** (`question.multiAnswer === true`, lista de respostas datadas): editar **apenas a
   resposta mais recente**, preservando as anteriores.
3. **Sub-perguntas aninhadas:** incluir **todas como colunas planas**, sem a lógica condicional.
4. **Entidade:** somente **contatos** nesta entrega. A lógica reutilizável (achatamento, mapeamento,
   merge) fica em helper para casos adotarem depois.

## Arquitetura

### Novo helper: `BulkQuestionnaireHelper`
Local sugerido: `src/app/core/helperClasses/bulk-questionnaire-helper.ts` (ou método em
`PersonAndRelatedHelperService` se preferir seguir o padrão de serviços já injetados).
Responsabilidades, com interfaces bem definidas e testáveis isoladamente:

- `flattenTemplate(template: QuestionModel[]): IFlatQuestion[]`
  - Percorre recursivamente perguntas e `answers[].additionalQuestions`.
  - Retorna lista plana de `{ variable, text, answerType, multiAnswer, answers, depth }`.
  - Ignora `inactive` e tipos fora de escopo (`FILE_UPLOAD`, `MARKUP`).
  - Garante unicidade de `variable` (em caso de duplicidade, mantém a primeira e loga aviso).
- `buildColumns(flat: IFlatQuestion[]): IV2SpreadsheetEditorColumn[]`
  - Mapeia cada `IFlatQuestion` para uma coluna do editor.
  - `field = model.questionnaireAnswers.<variable>[0].value`.
  - Para `SINGLE_SELECTION`/`MULTIPLE_OPTIONS`: `options` derivadas de `question.answers`
    (`{ label: answer.label, value: answer.value }`).
  - `label`: usa `question.text` (texto livre do template; **não** é token de tradução).
- `normalizeAnswersForEdit(contact: ContactModel, flat: IFlatQuestion[]): void`
  - Para cada variável: garante `questionnaireAnswers[variable]` como array.
  - Multi-answer: ordena por `date` desc para que o índice `[0]` seja a resposta mais recente.
  - Single-answer: já é `[0]`; se vazio, deixa o array vazio (a edição cria `[0]`).
- `mergeEditedAnswers(fullContact: ContactModel, dirtyModel: any, flat: IFlatQuestion[]): { [variable]: IAnswerData[] }`
  - Reconstrói o objeto `questionnaireAnswers` **completo** a partir do `fullContact`,
    aplicando os valores editados (presentes em `dirtyModel.questionnaireAnswers.<var>[0].value`)
    na entrada `[0]` (a mais recente). Preserva entradas anteriores e variáveis não tocadas.
  - Se uma variável editada não existia, cria `[{ date: now, value }]`.
  - Define/atualiza `date` da entrada `[0]` para `now` quando o valor muda (alinhado ao comportamento
    do formulário de questionário individual — **confirmar na implementação**).

### Mudanças em `contacts-bulk-create-modify.component.ts`

- `initializeTableColumns()`: após as colunas estáticas, concatenar
  `BulkQuestionnaireHelper.buildColumns(flattenTemplate(this.selectedOutbreak.contactInvestigationTemplate))`.
  Apenas no modo **modify** (questionário em massa não se aplica a create de relacionamento; confirmar).
- `initializeRecords()`: após mapear cada `ContactModel`, chamar `normalizeAnswersForEdit`.
- `save()` (ramo `isModify`): para cada `row` cujo `dirty.model` contenha mudança em
  `questionnaireAnswers`, substituir o `questionnaireAnswers` parcial pelo resultado de
  `mergeEditedAnswers(row.full.model, row.dirty.model, flat)` antes de montar o payload.
  Campos não-questionário permanecem inalterados.

### Fase 2 — novo tipo de célula MULTIPLE_SELECT

- Adicionar `MULTIPLE_SELECT` em `V2SpreadsheetEditorColumnType`.
- Criar renderer (`...-cell-multi-select-renderer.model.ts`) exibindo lista de labels.
- Criar editor (`components/editor-multi-select/...`) análogo a `editor-single-select`, com seleção
  múltipla; valor da célula é `string[]`.
- Registrar nos mapas `V2SpreadsheetEditorColumnTypeToRenderer` e `...ToEditor`.
- Serialização: `questionnaireAnswers.<var>[0].value` recebe `string[]`.

## Fluxo de dados

1. **Carregar:** busca contatos → `normalizeAnswersForEdit` reordena multi-answer (recente em `[0]`)
   → grid usa `model.questionnaireAnswers.<var>[0].value`.
2. **Editar:** usuário altera células; editor marca `dirty` nos caminhos aninhados.
3. **Salvar:** para linhas com questionário sujo, `mergeEditedAnswers` produz o objeto completo →
   payload `{ id, ...outrosCamposSujos, questionnaireAnswers: <completo> }` → `PUT .../contacts/bulk`.

## Tratamento de erros / casos de borda

- Surto sem `contactInvestigationTemplate` ou vazio: nenhuma coluna de questionário (comportamento atual).
- Variável duplicada no template (incluindo entre níveis): manter a primeira, ignorar repetidas com aviso.
- Resposta inexistente para um contato: editar cria a entrada `[0]`; não preencher nada não cria entrada.
- Multi-answer sem `date` em alguma entrada: tratar como mais antiga na ordenação (vai para o fim).
- `value` de múltipla escolha vazio (`[]`): considerar como "sem resposta" (não enviar entrada vazia).
- Não impor `required` do questionário em edição em massa (edições são parciais/opcionais).
- Permissões: respeitar as mesmas regras já aplicadas à edição em massa de contatos.

## Testes

- **Unit (helper):**
  - `flattenTemplate`: achata sub-perguntas; ignora `inactive`, `FILE_UPLOAD`, `MARKUP`; deduplica variáveis.
  - `buildColumns`: mapeia cada tipo ao tipo de célula correto; deriva options de `answers`.
  - `normalizeAnswersForEdit`: multi-answer ordenado (recente em `[0]`); arrays ausentes criados.
  - `mergeEditedAnswers`: preserva histórico e variáveis não tocadas; cria entrada nova quando ausente;
    aplica valor em `[0]`; não corrompe `questionnaireAnswers` completo.
- **Manual/E2E:** abrir edição em massa em surtos com questionários distintos; confirmar que as colunas
  mudam por surto; editar valores de cada tipo; salvar; reabrir um contato e confirmar persistência e
  preservação do histórico de multi-answer.

## Faseamento

- **Fase 1:** helper + colunas TEXT/NUMBER/DATE/SINGLE_SELECT + sub-perguntas planas + multi-answer
  (mais recente) + normalização e merge no save. (Entrega primária.)
- **Fase 2:** tipo de célula MULTIPLE_SELECT e mapeamento de `MULTIPLE_OPTIONS`.

## Itens a confirmar na implementação

- Comportamento de `date` ao editar/criar entrada de resposta (espelhar o formulário individual).
- Se a edição em massa de questionário deve aparecer também no modo **create** ou apenas **modify**.
- Local definitivo do helper (classe utilitária vs método em `PersonAndRelatedHelperService`).
