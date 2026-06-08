import * as vscode from "vscode";
import { WiboorClient } from "./api/client";
import { clearApiKey, getApiKey, promptAndStoreApiKey } from "./auth/apiKey";
import { extractUserId } from "./auth/jwt";
import { PomodoroProvider } from "./views/pomodoroProvider";
import { TaskDetailProvider } from "./views/taskDetailProvider";
import { TasksTreeProvider } from "./views/tasksTreeProvider";

const USER_ID_KEY = "wiboor.userExecutorId";

export function activate(context: vscode.ExtensionContext): void {
  const getBaseUrl = () =>
    vscode.workspace.getConfiguration("wiboor").get<string>("baseUrl") ?? "";

  /**
   * Resolve o userExecutorId: primeiro tenta extrair o `userId` do JWT
   * (API key); se o token não tiver, cai no valor definido manualmente.
   */
  const getUserId = async (): Promise<string | undefined> => {
    const apiKey = await getApiKey(context);
    const fromToken = apiKey ? extractUserId(apiKey) : undefined;
    return fromToken ?? context.globalState.get<string>(USER_ID_KEY);
  };

  async function promptUserId(): Promise<boolean> {
    const value = await vscode.window.showInputBox({
      title: "Wiboor — User Executor ID",
      prompt: "Informe seu userExecutorId (usado para filtrar suas tarefas)",
      ignoreFocusOut: true,
      value: context.globalState.get<string>(USER_ID_KEY) ?? "",
    });
    if (value === undefined) {
      return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    await context.globalState.update(USER_ID_KEY, trimmed);
    return true;
  }

  const client = new WiboorClient(getBaseUrl, () => getApiKey(context), getUserId);

  const tasksProvider = new TasksTreeProvider(client);
  const detailProvider = new TaskDetailProvider(context, client, tasksProvider);

  let prompting = false;

  /**
   * Garante que existam API key e userExecutorId antes de carregar as tarefas.
   * Se faltar algo, pede ao usuário (uma vez por vez) e então atualiza a lista.
   */
  async function ensureConfiguredAndRefresh(): Promise<void> {
    if (prompting) {
      return;
    }
    prompting = true;
    try {
      if (!(await getApiKey(context))) {
        if (!(await promptAndStoreApiKey(context))) {
          return;
        }
      }
      if (!(await getUserId())) {
        if (!(await promptUserId())) {
          return;
        }
      }
    } finally {
      prompting = false;
    }
    await tasksProvider.refresh();
  }

  const treeView = vscode.window.createTreeView("wiboor.tasksView", {
    treeDataProvider: tasksProvider,
  });

  // Ao abrir a aba da Wiboor (view fica visível), pede a config se necessário.
  treeView.onDidChangeVisibility((e) => {
    if (e.visible) {
      void ensureConfiguredAndRefresh();
    }
  });

  context.subscriptions.push(
    treeView,
    vscode.window.registerWebviewViewProvider(
      TaskDetailProvider.viewType,
      detailProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.window.registerWebviewViewProvider(
      PomodoroProvider.viewType,
      new PomodoroProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wiboor.setApiKey", async () => {
      if (await promptAndStoreApiKey(context)) {
        if (!(await getUserId())) {
          await promptUserId();
        }
        void tasksProvider.refresh();
      }
    }),
    vscode.commands.registerCommand("wiboor.setUserId", async () => {
      if (await promptUserId()) {
        void tasksProvider.refresh();
      }
    }),
    vscode.commands.registerCommand("wiboor.clearApiKey", () =>
      clearApiKey(context)
    ),
    vscode.commands.registerCommand("wiboor.refreshTasks", () =>
      tasksProvider.refresh()
    ),
    vscode.commands.registerCommand("wiboor.openTask", (taskId: string) =>
      detailProvider.open(taskId)
    )
  );

  if (treeView.visible) {
    void ensureConfiguredAndRefresh();
  }
}

export function deactivate(): void {
  // nada a limpar além das subscriptions geridas pelo VSCode.
}
