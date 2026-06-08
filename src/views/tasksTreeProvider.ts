import * as vscode from "vscode";
import { WiboorClient } from "../api/client";
import { Task, TaskStatus } from "../api/types";

function iconForStatus(status: TaskStatus): vscode.ThemeIcon {
  switch (status) {
    case "STARTED":
      return new vscode.ThemeIcon("play-circle");
    case "PAUSED":
      return new vscode.ThemeIcon("debug-pause");
    case "DONE":
    case "FINISHED":
      return new vscode.ThemeIcon("pass-filled");
    default:
      return new vscode.ThemeIcon("circle-large-outline");
  }
}

const STATUS_LABEL: Record<string, string> = {
  STARTED: "Em andamento",
  PAUSED: "Pausada",
  DONE: "Finalizada",
  FINISHED: "Finalizada",
};

export class TaskTreeItem extends vscode.TreeItem {
  constructor(public readonly task: Task) {
    super(task.title || task.id, vscode.TreeItemCollapsibleState.None);
    this.id = task.id;
    const status = String(task.status ?? "");
    const parts = [
      task.task_number ? `#${task.task_number}` : undefined,
      STATUS_LABEL[status] ?? status,
    ].filter(Boolean);
    this.description = parts.join(" · ");
    this.tooltip = task.title;
    this.contextValue = "wiboorTask";
    this.iconPath = iconForStatus(task.status);
    this.command = {
      command: "wiboor.openTask",
      title: "Abrir Tarefa",
      arguments: [task.id],
    };
  }
}

export class TasksTreeProvider
  implements vscode.TreeDataProvider<TaskTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];

  constructor(private readonly client: WiboorClient) {}

  async refresh(): Promise<void> {
    try {
      this.tasks = await this.client.listTasks();
    } catch (e) {
      this.tasks = [];
      vscode.window.showErrorMessage(
        `Wiboor: não foi possível carregar as tarefas. ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      this._onDidChangeTreeData.fire();
    }
  }

  getTaskById(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TaskTreeItem[] {
    return this.tasks.map((t) => new TaskTreeItem(t));
  }
}
