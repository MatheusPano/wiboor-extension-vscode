// Modelos de dados da API Wiboor (api.azzimuti.com.br).

export type TaskStatus = "STARTED" | "PAUSED" | "DONE" | "FINISHED" | string;

export interface UserRef {
  name: string;
  avatarUrl: string | null;
}

export interface ProjectRef {
  id: string;
  title: string;
  project_number: number;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size?: string;
}

export interface Task {
  id: string;
  task_number?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  type?: string;
  priority?: number;
  startedAt?: string | null;
  endedAt?: string | null;
  finishedAt?: string | null;
  userExecutorId?: string;
  userRequesterId?: string;
  userExecutor?: UserRef;
  userRequester?: UserRef;
  project?: ProjectRef | null;
  attachments?: Attachment[];
  checklist?: unknown[];

  [key: string]: unknown;
}

export interface Comment {
  id: string;
  author?: string;
  body: string;
  createdAt?: string;
}

export interface Pagination {
  totalItems: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
}

export interface Paginated<T> {
  data: T[];
  pagination?: Pagination;
}
