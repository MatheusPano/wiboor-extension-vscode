import * as vscode from "vscode";
import * as path from "path";

enum RefType {
  Head = 0,
  RemoteHead = 1,
  Tag = 2,
}

interface Ref {
  readonly type: RefType;
  readonly name?: string;
}

interface RefQuery {
  readonly contains?: string;
  readonly count?: number;
  readonly pattern?: string | string[];
}

interface Repository {
  readonly rootUri: vscode.Uri;
  getRefs(query?: RefQuery): Promise<Ref[]>;
  checkout(treeish: string): Promise<void>;
  createBranch(name: string, checkout: boolean, ref?: string): Promise<void>;
}

interface GitAPI {
  readonly repositories: Repository[];
}

interface GitExtension {
  getAPI(version: 1): GitAPI;
}

export function sanitizeBranchName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[~^:?*[\]\\]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/\/{2,}/g, "/")
    .replace(/^[/.]+|[/.]+$/g, "");
}

async function getGitApi(): Promise<GitAPI | undefined> {
  const gitExt =
    vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!gitExt) {
    vscode.window.showErrorMessage(
      "Wiboor: extensão Git do VSCode não encontrada. O Git está instalado?"
    );
    return undefined;
  }
  if (!gitExt.isActive) {
    await gitExt.activate();
  }
  return gitExt.exports.getAPI(1);
}

async function pickRepository(
  api: GitAPI
): Promise<Repository | undefined> {
  const repos = api.repositories;
  if (repos.length === 0) {
    vscode.window.showWarningMessage(
      "Wiboor: nenhum repositório Git aberto no workspace."
    );

    return undefined;
  }
  if (repos.length === 1) {
    return repos[0];
  }
  const pick = await vscode.window.showQuickPick(
    repos.map((repo) => ({
      label: path.basename(repo.rootUri.fsPath),
      description: repo.rootUri.fsPath,
      repo,
    })),
    {
      title: "Wiboor — em qual repositório criar a branch?",
      placeHolder: "Selecione o repositório",
    }
  );
  return pick?.repo;
}

export async function createOrCheckoutBranch(rawName: string): Promise<void> {
  const branch = sanitizeBranchName(rawName);


  const api = await getGitApi();
  if (!api) {
    return;
  }

  const repo = await pickRepository(api);
  if (!repo) {
    return;
  }

  const refs = await repo.getRefs({ pattern: `refs/heads/${branch}` });
  const exists = refs.some(
    (ref) => ref.type === RefType.Head && ref.name === branch
  );

  try {
    const repoName = path.basename(repo.rootUri.fsPath);
    if (exists) {
      await repo.checkout(branch);
      vscode.window.showInformationMessage(
        `Wiboor: trocou para a branch "${branch}" em ${repoName}.`
      );
    } else {
      await repo.createBranch(branch, true);
      vscode.window.showInformationMessage(
        `Wiboor: branch "${branch}" criada e selecionada em ${repoName}.`
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(
      `Wiboor: falha ao trocar para a branch "${branch}": ${message}`
    );
  }
}
