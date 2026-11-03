# Célula de upload de arquivo na edição em massa (questionário) — Plano

**Data:** 2026-06-26
**Objetivo:** Permitir subir/substituir/remover arquivos nas perguntas de tipo `FILE_UPLOAD` do questionário, direto nas células da edição em massa de contatos. Markup continua como coluna somente-leitura.

## Decisões (acordadas)
- Anexo existente: exibir **rótulo genérico** (`LNG_MODULE_LABEL_FILE_ATTACHMENT`), sem buscar o nome via API. Nome real só após subir um novo (cache em memória).
- Ações: **subir/substituir** e **remover**.
- Markup: somente-leitura (texto no cabeçalho da coluna).

## Arquitetura
Novo tipo de célula `V2SpreadsheetEditorColumnType.FILE`:
- **Renderer** (`...-cell-file-renderer.model.ts`): mostra ícone de clipe + nome em cache (se recém-enviado) ou `LNG_MODULE_LABEL_FILE_ATTACHMENT` quando há valor (id); vazio + ícone de upload quando não há. Clique no ícone → `startEditCell`.
- **Editor** (`editor-file/`): componente Angular com `<input type=file>` (botão "Escolher arquivo") + botão "Remover" (se houver valor). Usa `FileUploader` (ng2-file-upload) postando em `outbreaks/{id}/attachments` (id via `OutbreakDataService`, token via `AuthDataService`). Em sucesso: `value = attachment.id`, grava nome no cache, `stopEditing`. Remover: `value = null`, `stopEditing`. Erros via `ToastV2Service`.
- **Cache de nomes**: objeto module-level `fileNameCache: { [id]: string }` (escrito pelo editor, lido pelo renderer).
- Registro nos mapas `...ToRenderer`/`...ToEditor` e em `components-v2/index.ts`.

## Helper
`bulk-questionnaire-helper.ts`: mover `FILE_UPLOAD` de READONLY (TEXT) para EDITABLE → `FILE`. `MARKUP` permanece READONLY (TEXT).

## Valor / persistência
A célula guarda o **id do anexo** em `model.questionnaireAnswers.<var>[0].value` (mesmo caminho dos demais). O merge no save já é agnóstico ao tipo do valor — sem mudanças.

## Verificação
`tsc --noEmit` + `npm run lint` (sem infra de testes). Teste manual: subir, substituir, remover, salvar e reabrir.
