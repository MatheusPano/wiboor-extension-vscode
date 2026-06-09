(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");


  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const STATUS_LABEL = {
    STARTED: "Em andamento",
    PAUSED: "Pausada",
    DONE: "Finalizada",
    FINISHED: "Finalizada",
  };

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function avatar(user) {
    if (!user) return "";
    const img = user.avatarUrl
      ? `<img class="avatar" src="${esc(user.avatarUrl)}" alt="" />`
      : `<span class="avatar avatar-fallback">${esc(
        (user.name || "?").charAt(0)
      )}</span>`;
    return `<span class="person">${img}<span class="person-name">${esc(
      user.name || "—"
    )}</span></span>`;
  }

  function isImage(url) {
    return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url || "");
  }

  function taskNumber(task) {
    return task.task_number ?? task.taskNumber ?? task.number ?? null;
  }

  function identifier(task) {
    const num = taskNumber(task);
    if (num == null) return "";
    const type = String(task.type || "TASK").toUpperCase();
    return `${type}#${num}`;
  }

  /** Nome de branch sugerido: feature/ para TASK, hotfix/ para BUG. */
  function branchName(task) {
    const ident = identifier(task);
    if (!ident) return "";
    const prefix = String(task.type || "TASK").toUpperCase() === "BUG"
      ? "hotfix"
      : "feature";
    return `${prefix}/${ident}`;
  }

  function priorityTag(p) {
    if (typeof p !== "number") return "";
    let label, cls;
    if (p <= 4) {
      label = "Baixa";
      cls = "prio-low";
    } else if (p <= 6) {
      label = "Média";
      cls = "prio-med";
    } else {
      label = "Alta";
      cls = "prio-high";
    }
    return `<span class="tag ${cls}">${esc(label)}</span>`;
  }

  /** Botões de ação dependentes do status atual. */
  function actionsFor(status) {
    let primary;
    if (status === "STARTED") {
      primary = `<button class="btn btn-primary" data-action="pause">‖ Pausar</button>`;
    } else {
      const label = status === "PAUSED" ? "Retomar" : "Iniciar";
      primary = `<button class="btn btn-primary" data-action="start">▶ ${label}</button>`;
    }
    const finish = `<button class="btn btn-secondary" data-action="finish">✓ Finalizar</button>`;
    const refresh = `<button class="btn btn-ghost" data-action="refresh" title="Atualizar">↻</button>`;
    return `<div class="actions">${primary}${finish}${refresh}</div>`;
  }

  function renderEmpty() {
    app.innerHTML = `
      <div class="placeholder">
        <p class="muted">Nenhuma tarefa selecionada.</p>
        <p class="muted">Selecione uma tarefa na lista ao lado para ver os detalhes aqui.</p>
        <div class="actions">
          <button class="btn btn-ghost" data-action="setApiKey">Definir API Key</button>
          <button class="btn btn-ghost" data-action="openSettings">Abrir Settings</button>
        </div>
      </div>`;
  }

  function renderLoading() {
    app.innerHTML = `<div class="placeholder"><p class="muted">Carregando…</p></div>`;
  }

  function renderError(message) {
    app.innerHTML = `
      <div class="placeholder">
        <p class="error">${esc(message)}</p>
        <div class="actions">
          <button class="btn btn-ghost" data-action="setApiKey">Definir API Key</button>
          <button class="btn btn-ghost" data-action="openSettings">Abrir Settings</button>
          <button class="btn btn-ghost" data-action="refresh">Tentar novamente</button>
        </div>
      </div>`;
  }

  function renderTask(task) {
    const status = task.status || "";
    const statusLabel = STATUS_LABEL[status] || status;
    const ident = identifier(task);
    const branch = branchName(task);

    const attachments = Array.isArray(task.attachments)
      ? task.attachments
      : [];
    const attachmentsHtml = attachments.length
      ? attachments
        .map((a) =>
          isImage(a.url)
            ? `<a class="attachment" href="${esc(a.url)}" title="${esc(
              a.name
            )}"><img src="${esc(a.url)}" alt="${esc(a.name)}" /></a>`
            : `<a class="attachment-link" href="${esc(a.url)}">📎 ${esc(
              a.name
            )}</a>`
        )
        .join("")
      : "";

    const checklist = Array.isArray(task.checklist) ? task.checklist : [];
    const hasPeriod = task.startedAt || task.endedAt;

    app.innerHTML = `
      <div class="header">
        ${ident
        ? `<div class="ident">
                 <span class="ident-text">${esc(ident)}</span>
                 <button class="copy-btn" data-action="copy" data-copy="${esc(
          branch
        )}" title="Copiar branch: ${esc(
          branch
        )}" aria-label="Copiar branch">⧉</button>
                 <button class="copy-btn" data-action="branch" data-branch="${esc(
          branch
        )}" title="Criar/trocar para a branch: ${esc(
          branch
        )}" aria-label="Criar ou trocar de branch">Branch ⎇</button>
               </div>`
        : "<span></span>"
      }
        <span class="status status-${esc(status)}">${esc(statusLabel)}</span>
      </div>

      <h1 class="title">${esc(task.title || task.id)}</h1>

      <div class="section">
        <div class="section-title">Descrição</div>
        <div class="description"></div>
      </div>

      <div class="card">
        ${task.userRequester
        ? `<div class="row">
                 <span class="row-label">Solicitante</span>
                 <span class="row-value">${avatar(task.userRequester)}</span>
               </div>`
        : ""
      }
        ${task.project
        ? `<div class="row">
                 <span class="row-label">Projeto</span>
                 <span class="row-value">${esc(task.project.title)}${task.project.project_number
          ? ` <span class="muted">#${esc(
            task.project.project_number
          )}</span>`
          : ""
        }</span>
               </div>`
        : ""
      }
        ${hasPeriod
        ? `<div class="row">
                 <span class="row-label">Período</span>
                 <span class="row-value">${esc(fmtDate(task.startedAt))} <span class="muted">→</span> ${esc(
          fmtDate(task.endedAt)
        )}</span>
               </div>`
        : ""
      }
        ${priorityTag(task.priority)
        ? `<div class="row">
                 <span class="row-label">Prioridade</span>
                 <span class="row-value">${priorityTag(task.priority)}</span>
               </div>`
        : ""
      }
      </div>

      ${actionsFor(status)}

      ${attachmentsHtml
        ? `<div class="section">
               <div class="section-title">Anexos</div>
               <div class="attachments">${attachmentsHtml}</div>
             </div>`
        : ""
      }

      ${checklist.length
        ? `<div class="section">
               <div class="section-title">Checklist</div>
               <div class="muted">${checklist.length} item(s)</div>
             </div>`
        : ""
      }`;

    // Descrição vem como HTML da API; injetada à parte (o CSP impede execução
    // de <script> inline e handlers, então a renderização é contida).
    const descEl = app.querySelector(".description");
    if (descEl) {
      descEl.innerHTML = task.description || "<span class='muted'>—</span>";
    }
  }

  // Delegação de eventos para os botões.
  app.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (!action) return;

    if (action === "copy") {
      const text = btn.getAttribute("data-copy") || "";
      if (text) vscode.postMessage({ type: "copy", text });
      return;
    }

    if (action === "branch") {
      const text = btn.getAttribute("data-branch") || "";
      if (text) vscode.postMessage({ type: "branch", text });
      return;
    }

    if (action === "comment") {
      const input = document.getElementById("comment-input");
      const body = input ? input.value : "";
      if (!body.trim()) return;
      vscode.postMessage({ type: "comment", body });
      return;
    }

    vscode.postMessage({ type: action });
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "empty":
        renderEmpty();
        break;
      case "loading":
        renderLoading();
        break;
      case "error":
        renderError(msg.message);
        break;
      case "task":
        renderTask(msg.task);
        break;
    }
  });

  renderLoading();
  // Avisa o provider que o listener já está ativo e pode receber o estado.
  vscode.postMessage({ type: "ready" });
})();
