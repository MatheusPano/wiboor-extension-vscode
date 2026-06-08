import * as vscode from "vscode";

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
 * WebviewView com um timer Pomodoro configurável (tempo de foco e de pausa).
 * O estado do timer vive no próprio webview (vscode.getState/setState), então
 * sobrevive a recarregar/esconder. Ao terminar uma fase, avisa o provider para
 * mostrar uma notificação.
 */
export class PomodoroProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "wiboor.pomodoro";

  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(
      async (msg: { type: string; next?: string }) => {
        if (msg.type === "phaseEnd") {
          const isBreak = msg.next === "break";
          const choice = await vscode.window.showInformationMessage(
            isBreak ? "☕ Hora da pausa!" : "🍅 Hora do foco!",
            {
              modal: true,
              detail: isBreak
                ? "Você concluiu um ciclo de foco. Clique em Continuar para iniciar a pausa."
                : "Pausa encerrada. Clique em Continuar para voltar ao foco.",
            },
            "Continuar"
          );
          // Só inicia a próxima fase se o usuário confirmar; Cancelar mantém parado.
          if (choice === "Continuar") {
            void this.view?.webview.postMessage({ type: "start" });
          }
        }
      }
    );
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "pomodoro.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "pomodoro.css")
    );

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Pomodoro</title>
</head>
<body>
  <div class="pomodoro">
    <div class="mode-pill" id="mode">Foco</div>

    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="ring-bg" cx="100" cy="100" r="88" />
        <circle class="ring-fg" cx="100" cy="100" r="88" />
      </svg>
      <div class="center">
        <div class="time" id="time">25:00</div>
        <div class="cycles" id="cycles">Ciclo 1</div>
      </div>
    </div>

    <div class="controls">
      <button class="btn-ghost" id="reset" title="Reiniciar fase" aria-label="Reiniciar">↺</button>
      <button class="btn-primary" id="toggle">Iniciar</button>
      <button class="btn-ghost" id="skip" title="Pular fase" aria-label="Pular">⏭</button>
    </div>

    <div class="config">
      <label>Foco (min)<input type="number" id="focusMin" min="1" max="120" /></label>
      <label>Pausa (min)<input type="number" id="breakMin" min="1" max="120" /></label>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
