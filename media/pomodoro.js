(function () {
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);

  const RADIUS = 88;
  const CIRC = 2 * Math.PI * RADIUS;

  const defaults = {
    mode: "focus",
    focusMin: 25,
    breakMin: 5,
    running: false,
    remaining: 25 * 60000,
    endTime: 0,
    cycles: 1,
  };
  let state = Object.assign({}, defaults, vscode.getState() || {});

  const ringFg = document.querySelector(".ring-fg");
  ringFg.style.strokeDasharray = String(CIRC);

  function durMs(mode) {
    return (mode === "focus" ? state.focusMin : state.breakMin) * 60000;
  }

  function save() {
    vscode.setState(state);
  }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  }

  function currentRemaining() {
    if (state.running) return Math.max(0, state.endTime - Date.now());
    return state.remaining;
  }

  function applyPhaseEnd() {
    const ended = state.mode;
    const next = ended === "focus" ? "break" : "focus";
    if (ended === "focus") state.cycles += 1;
    state.mode = next;
    state.remaining = durMs(next);
    // Não auto-inicia: aguarda o usuário confirmar no modal (mensagem "start").
    state.running = false;
    state.endTime = 0;
    save();
    vscode.postMessage({ type: "phaseEnd", ended, next });
  }

  function startTimer() {
    state.endTime = Date.now() + currentRemaining();
    state.running = true;
    save();
    render();
  }

  function render() {
    let rem = currentRemaining();
    if (state.running && rem <= 0) {
      applyPhaseEnd();
      rem = currentRemaining();
    }

    const dur = durMs(state.mode);
    const progress = dur > 0 ? rem / dur : 0; // 1 = cheio, 0 = vazio
    ringFg.style.strokeDashoffset = String(CIRC * (1 - progress));

    document.body.classList.toggle("is-break", state.mode === "break");
    $("time").textContent = fmt(rem);
    $("mode").textContent = state.mode === "focus" ? "Foco" : "Pausa";
    $("cycles").textContent = "Ciclo " + state.cycles;
    $("toggle").textContent = state.running
      ? "Pausar"
      : rem < dur
      ? "Continuar"
      : "Iniciar";

    if (document.activeElement !== $("focusMin")) $("focusMin").value = state.focusMin;
    if (document.activeElement !== $("breakMin")) $("breakMin").value = state.breakMin;
  }

  function toggle() {
    if (state.running) {
      state.remaining = currentRemaining();
      state.running = false;
      save();
      render();
    } else {
      startTimer();
    }
  }

  function reset() {
    state.running = false;
    state.remaining = durMs(state.mode);
    save();
    render();
  }

  function skip() {
    const next = state.mode === "focus" ? "break" : "focus";
    if (state.mode === "focus") state.cycles += 1;
    state.mode = next;
    state.remaining = durMs(next);
    state.running = false;
    save();
    render();
  }

  function onConfig(id, key) {
    $(id).addEventListener("change", () => {
      let v = parseInt($(id).value, 10);
      if (isNaN(v)) v = defaults[key];
      v = Math.min(120, Math.max(1, v));
      state[key] = v;
      // Se a fase atual está ociosa, reflete o novo tempo imediatamente.
      if (!state.running && state.mode === (key === "focusMin" ? "focus" : "break")) {
        state.remaining = durMs(state.mode);
      }
      save();
      render();
    });
  }

  $("toggle").addEventListener("click", toggle);
  $("reset").addEventListener("click", reset);
  $("skip").addEventListener("click", skip);

  // O provider avisa quando o usuário clica "Continuar" no modal de fim de fase.
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "start") startTimer();
  });
  onConfig("focusMin", "focusMin");
  onConfig("breakMin", "breakMin");

  setInterval(render, 250);
  render();
})();
