import * as vscode from "vscode";
import { WiboorClient } from "../api/client";
import { TasksTreeProvider } from "./tasksTreeProvider";

const LAST_TASK_KEY = "wiboor.lastTaskId";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/**
 * WebviewView que mostra o detalhe da tarefa selecionada e expõe as ações
 * (comentar, iniciar, pausar, finalizar). Os dados vêm da lista já carregada
 * (TasksTreeProvider). Persiste a última tarefa aberta em globalState para
 * restaurá-la automaticamente ao reabrir o painel.
 */
export class TaskDetailProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "wiboor.taskDetail";

  private view?: vscode.WebviewView;
  private currentTaskId?: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: WiboorClient,
    private readonly tasks: TasksTreeProvider
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));

    // Restaura o id da última tarefa aberta. O conteúdo só é enviado quando o
    // webview avisa que está pronto (mensagem "ready"), evitando perder a
    // mensagem por enviá-la antes do script registrar o listener.
    this.currentTaskId =
      this.context.globalState.get<string>(LAST_TASK_KEY) ?? undefined;
  }

  /** Abre uma tarefa pelo id e a persiste como "última aberta". */
  async open(taskId: string): Promise<void> {
    this.currentTaskId = taskId;
    await this.context.globalState.update(LAST_TASK_KEY, taskId);

    if (!this.view) {
      await vscode.commands.executeCommand(
        `${TaskDetailProvider.viewType}.focus`
      );
    }

    await this.renderCurrent();
  }

  /** Envia ao webview o estado atual (vazio, ou a tarefa selecionada). */
  private async renderCurrent(): Promise<void> {
    const id = this.currentTaskId;
    if (!id) {
      this.post({ type: "empty" });
      return;
    }

    this.post({ type: "loading" });

    let task = this.tasks.getTaskById(id);
    if (!task) {
      // Lista ainda não carregada (ex.: restauração após reload) — busca agora.
      await this.tasks.refresh();
      task = this.tasks.getTaskById(id);
    }

    if (task) {
      this.post({ type: "task", task });
    } else {
      this.post({
        type: "error",
        message:
          "Tarefa não encontrada na lista atual (pode ter mudado de status).",
      });
    }
  }

  private async handleMessage(msg: {
    type: string;
    body?: string;
    text?: string;
  }): Promise<void> {
    if (msg.type === "ready") {
      await this.renderCurrent();
      return;
    }
    if (msg.type === "copy") {
      if (msg.text) {
        await vscode.env.clipboard.writeText(msg.text);
        vscode.window.setStatusBarMessage(
          `Wiboor: "${msg.text}" copiado`,
          2000
        );
      }
      return;
    }
    if (msg.type === "openSettings") {
      void vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "wiboor.baseUrl"
      );
      return;
    }
    if (msg.type === "setApiKey") {
      void vscode.commands.executeCommand("wiboor.setApiKey");
      return;
    }

    const id = this.currentTaskId;
    if (!id) {
      return;
    }

    this.post({ type: "loading" });
    try {
      switch (msg.type) {
        case "comment":
          if (msg.body && msg.body.trim()) {
            await this.client.addComment(id, msg.body.trim());
          }
          break;
        case "start":
          await this.client.startTask(id);
          break;
        case "pause":
          await this.client.pauseTask(id);
          break;
        case "finish":
          await this.client.finishTask(id);
          break;
        case "refresh":
          break;
        default:
          break;
      }
    } catch (e) {
      this.post({ type: "error", message: errMsg(e) });
      return;
    }

    await this.tasks.refresh();
    const task = this.tasks.getTaskById(id);
    if (task) {
      this.post({ type: "task", task });
    } else {
      this.post({
        type: "error",
        message: "A tarefa saiu da lista (STARTED/PAUSED) após a ação.",
      });
    }
  }

  private post(msg: unknown): void {
    void this.view?.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "style.css")
    );

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Detalhe da Tarefa</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
