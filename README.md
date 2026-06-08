# Wiboor — extensão VSCode

Visualize e gerencie tarefas da Wiboor sem sair do vscode: uma aba dedicada na
Activity Bar lista suas tarefas; ao clicar, abre o detalhe com ações de
**comentar**, **iniciar**, **pausar** e **finalizar**.

## Como rodar em desenvolvimento

```bash
npm install
```

Depois pressione **F5** no VSCode (config "Run Extension"). Isso compila em modo
watch e abre uma janela Extension Development Host com a extensão carregada.

## Configuração

A primeira vez que você abre a aba da Wiboor, a extensão pede a **API key** com essa informação ela já pega o executorID

1. **Base URL** — Settings → `wiboor.baseUrl` (padrão `https://api.azzimuti.com.br`).
2. **API key** — Command Palette → `Wiboor: Definir API Key`. Guardada com
   segurança no SecretStorage do VSCode (não fica em settings/arquivo).
3. **User Executor ID** — Command Palette → `Wiboor: Definir User Executor ID`.
   Usado no filtro `?status[]=STARTED&status[]=PAUSED&userExecutorId=…`.

## Onde ajustar a integração com a API

Todo o contato com a API está isolado em `src/api/client.ts`:

- **Autenticação**: por padrão envia `Authorization: Bearer <apikey>`.
- **Modelo de dados**: `src/api/types.ts` define `Task`. Ajuste os campos ao JSON
  que sua API retorna.

