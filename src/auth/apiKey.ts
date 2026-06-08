import * as vscode from "vscode";

const SECRET_KEY = "wiboor.apiKey";

export function getApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return Promise.resolve(context.secrets.get(SECRET_KEY));
}

export async function promptAndStoreApiKey(
  context: vscode.ExtensionContext
): Promise<boolean> {
  const value = await vscode.window.showInputBox({
    title: "Wiboor — API Key",
    prompt: "Cole sua API key da Wiboor",
    password: true,
    ignoreFocusOut: true,
  });

  if (value === undefined) {
    return false; // usuário cancelou
  }

  const trimmed = value.trim();
  if (!trimmed) {
    await context.secrets.delete(SECRET_KEY);
    vscode.window.showInformationMessage("API key removida.");
    return false;
  }

  await context.secrets.store(SECRET_KEY, trimmed);
  vscode.window.showInformationMessage("API key da Wiboor salva com sucesso.");
  return true;
}

export async function clearApiKey(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
  vscode.window.showInformationMessage("API key da Wiboor removida.");
}
