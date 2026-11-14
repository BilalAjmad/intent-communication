/* Intent Studio — shell. Talks to the same-origin /api routes only.
 * The preview is sandboxed (allow-scripts) and speaks the channel-id protocol (trd 12.2). */
(function () {
  "use strict";

  var COPY_PROMPT =
    "Please read the feedback queue and apply the sent patches (.intent/patches), then report what you changed.";

  var CHIPS = [
    { value: "bigger", label: "Bigger" },
    { value: "smaller", label: "Smaller" },
    { value: "more-space", label: "More space" },
    { value: "less-clutter", label: "Less clutter" },
    { value: "different-color", label: "Different color" },
    { value: "more-premium", label: "More premium" },
    { value: "simpler", label: "Simpler" },
  ];

  var STATUS_META = {
    draft: { icon: "✎", label: "Draft" },
    sent: { icon: "→", label: "Sent" },
    applied: { icon: "✓", label: "Applied" },
    rejected: { icon: "✕", label: "Rejected" },
    conflict: { icon: "!", label: "Conflict" },
  };

  var state = {
    scene: null,
    sceneId: "default",
    screenIndex: 0,
    selectedId: null,
    patches: [],
    channel: randomChannel(),
    trayOpen: false,
  };

  var el = {};
  var toastTimer = 0;

  function randomChannel() {
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    el.projectName = $("project-name");
    el.screenSelect = $("screen-select");
    el.screensList = $("screens-list");
    el.layersList = $("layers-list");
    el.frame = $("preview-frame");
    el.overlay = $("overlay");
    el.canvasError = $("canvas-error");
    el.sendBtn = $("send-btn");
    el.inspectorTab = $("tab-inspector");
    el.feedbackTab = $("tab-feedback");
    el.inspectorPanel = $("inspector-panel");
    el.feedbackPanel = $("feedback-panel");
    el.inspectorBody = $("inspector-body");
    el.feedbackTarget = $("feedback-target");
    el.feedbackText = $("feedback-text");
    el.chips = $("chips");
    el.addToQueue = $("add-to-queue");
    el.trayToggle = $("tray-toggle");
    el.trayCaret = $("tray-caret");
    el.trayBody = $("tray-body");
    el.traySummary = $("tray-summary");
    el.queueList = $("queue-list");
    el.waitingBanner = $("waiting-banner");
    el.copyPrompt = $("copy-prompt");
    el.trayNotice = $("tray-notice");
    el.toast = $("toast");
  }

  function showToast(message) {
    el.toast.textContent = message;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.toast.textContent = "";
    }, 4000);
  }

  function setTrayNotice(message) {
    if (message) {
      el.trayNotice.textContent = message;
      el.trayNotice.hidden = false;
    } else {
      el.trayNotice.textContent = "";
      el.trayNotice.hidden = true;
    }
  }

  function showCanvasError(message) {
    el.canvasError.textContent = message;
    el.canvasError.hidden = false;
  }

  function clearCanvasError() {
    el.canvasError.textContent = "";
    el.canvasError.hidden = true;
  }

  function showFatal(message) {
    showCanvasError(message);
    el.sendBtn.disabled = true;
    el.addToQueue.disabled = true;
  }

  async function fetchJson(url, options) {
    var res = await fetch(url, options);
    var data = null;
    var text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      var errorMessage = "Request failed (" + res.status + ")";
      if (data && data.error) {
        if (typeof data.error === "string") errorMessage = data.error;
        else if (data.error.message) errorMessage = data.error.code ? data.error.code + ": " + data.error.message : data.error.message;
      }
      throw new Error(errorMessage);
    }
    return data;
  }

  // ---------- scene ----------

  async function loadScene() {
    var data = await fetchJson("/api/scene?scene=" + encodeURIComponent(state.sceneId));
    state.scene = data.scene;
    el.projectName.textContent = (state.scene.metadata && state.scene.metadata.name) || "Intent Project";
    renderScreens();
    renderLayers();
    await renderPreview();
  }

  function orderedScreenIds() {
    var order = (state.scene.screenOrder || []).filter(function (id) {
      return state.scene.screens[id];
    });
    var rest = Object.keys(state.scene.screens).filter(function (id) {
      return order.indexOf(id) === -1;
    });
    return order.concat(rest);
  }

  function currentScreenId() {
    var ids = orderedScreenIds();
    var id = ids[state.screenIndex] || ids[0];
    if (!id) return null;
    return id;
  }

  function renderScreens() {
    var ids = orderedScreenIds();
    el.screensList.innerHTML = "";
    el.screenSelect.innerHTML = "";
    ids.forEach(function (id, i) {
      var screen = state.scene.screens[id];
      var title = (screen.props && screen.props.title) || id;

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.className = "screen-item";
      btn.type = "button";
      btn.textContent = title;
      btn.setAttribute("aria-pressed", String(i === state.screenIndex));
      btn.addEventListener("click", function () {
        state.screenIndex = i;
        renderScreens();
        renderPreview();
      });
      li.appendChild(btn);
      el.screensList.appendChild(li);

      var option = document.createElement("option");
      option.value = String(i);
      option.textContent = title;
      if (i === state.screenIndex) option.selected = true;
      el.screenSelect.appendChild(option);
    });
  }

  function layerDepth(id, memo) {
    var depth = 0;
    var current = state.scene.objects[id];
    var guard = 0;
    while (current && current.parentId && guard++ < 24) {
      depth += 1;
      current = state.scene.objects[current.parentId];
      if (!current) break;
    }
    return depth;
  }

  function renderLayers() {
    el.layersList.innerHTML = "";
    var screenId = currentScreenId();
    if (!screenId) {
      el.layersList.innerHTML = '<li class="muted" style="padding: 8px">No screens yet.</li>';
      return;
    }
    var screen = state.scene.screens[screenId];
    var rows = [];
    var seen = new Set();
    function walk(objectId, depth) {
      var obj = state.scene.objects[objectId];
      if (!obj || seen.has(objectId)) return;
      seen.add(objectId);
      rows.push({ id: objectId, depth: depth, object: obj });
      (obj.children || []).forEach(function (childId) {
        walk(childId, depth + 1);
      });
    }
    (screen.children || []).forEach(function (id) {
      walk(id, 0);
    });

    if (rows.length === 0) {
      el.layersList.innerHTML = '<li class="muted" style="padding: 8px">This screen has no objects.</li>';
      return;
    }
    rows.forEach(function (row) {
      var li = document.createElement("li");
      li.setAttribute("role", "treeitem");
      var btn = document.createElement("button");
      btn.className = "layer-item";
      btn.type = "button";
      btn.style.paddingLeft = String(8 + row.depth * 14) + "px";
      btn.setAttribute("data-object-id", row.id);
      btn.setAttribute("aria-pressed", String(state.selectedId === row.id));
      var type = document.createElement("span");
      type.className = "layer-type";
      type.textContent = row.object.type;
      var label = document.createElement("span");
      label.textContent = row.id;
      btn.appendChild(type);
      btn.appendChild(label);
      btn.addEventListener("click", function () {
        selectObject(row.id);
      });
      btn.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          var items = Array.prototype.slice.call(el.layersList.querySelectorAll(".layer-item"));
          var index = items.indexOf(btn);
          var next = event.key === "ArrowDown" ? index + 1 : index - 1;
          if (items[next]) items[next].focus();
        }
      });
      li.appendChild(btn);
      el.layersList.appendChild(li);
    });
  }

  // ---------- preview iframe + protocol ----------

  function postToPreview(msg) {
    try {
      el.frame.contentWindow.postMessage(msg, "*");
    } catch (err) {
      // frame not ready; parent will resend on ready
    }
  }

  async function renderPreview() {
    clearCanvasError();
    try {
      var res = await fetch("/api/preview?scene=" + encodeURIComponent(state.sceneId));
      if (!res.ok) {
        throw new Error("The preview could not be loaded (" + res.status + ").");
      }
      el.frame.srcdoc = await res.text();
    } catch (err) {
      showCanvasError(err && err.message ? err.message : "The preview could not be loaded.");
    }
  }

  function handlePreviewMessage(event) {
    if (!el.frame || event.source !== el.frame.contentWindow) return;
    var msg = event.data;
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;

    if (msg.t === "ready") {
      postToPreview({ t: "init", channel: state.channel });
      if (state.selectedId) {
        postToPreview({ t: "select", channel: state.channel, ids: [state.selectedId] });
      }
      return;
    }
    if (msg.channel !== state.channel) return;

    if (msg.t === "click" && typeof msg.id === "string") {
      selectObject(msg.id);
    } else if (msg.t === "bounds" && msg.rects && typeof msg.rects === "object") {
      renderOverlay(msg.rects);
    }
  }

  function renderOverlay(rects) {
    el.overlay.innerHTML = "";
    Object.keys(rects).forEach(function (id) {
      var r = rects[id];
      if (!r) return;
      var box = document.createElement("div");
      box.className = "selection-box";
      box.style.left = r.x + "px";
      box.style.top = r.y + "px";
      box.style.width = r.w + "px";
      box.style.height = r.h + "px";
      var label = document.createElement("div");
      label.className = "selection-label";
      label.textContent = id;
      box.appendChild(label);
      el.overlay.appendChild(box);
    });
  }

  function clearOverlay() {
    el.overlay.innerHTML = "";
  }

  function selectObject(id) {
    state.selectedId = id;
    postToPreview({ t: "select", channel: state.channel, ids: id ? [id] : [] });
    renderSelection();
  }

  function renderSelection() {
    var target = state.selectedId || "nothing selected";
    el.feedbackTarget.textContent = target;
    var buttons = el.layersList.querySelectorAll(".layer-item");
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-object-id") === state.selectedId));
    });
    renderInspector();
    if (!state.selectedId) clearOverlay();
  }

  // ---------- inspector ----------

  function renderInspector() {
    var body = el.inspectorBody;
    body.innerHTML = "";
    if (!state.selectedId) {
      body.innerHTML = '<p class="muted">Select an object on the canvas or in Layers to see its details.</p>';
      return;
    }
    var id = state.selectedId;
    var obj = state.scene.objects[id];
    var screen = state.scene.screens[id];
    var dl = document.createElement("dl");
    dl.className = "kv";
    function row(term, description) {
      var dt = document.createElement("dt");
      dt.textContent = term;
      var dd = document.createElement("dd");
      dd.textContent = description;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    if (screen) {
      row("Type", "screen");
      row("Id", screen.id);
      row("Title", String((screen.props && screen.props.title) || "Untitled"));
      row("Size", String((screen.props && screen.props.width) || "?") + " × " + String((screen.props && screen.props.height) || "?"));
      row("Objects", String((screen.children || []).length));
    } else if (obj) {
      row("Type", obj.type);
      row("Id", obj.id);
      if (obj.type === "text" && obj.props && typeof obj.props.content === "string") {
        row("Text", obj.props.content.length > 120 ? obj.props.content.slice(0, 120) + "…" : obj.props.content);
      }
      if (obj.type === "button" && obj.props && typeof obj.props.label === "string") {
        row("Label", obj.props.label);
      }
      if (obj.type === "input" && obj.props && typeof obj.props.placeholder === "string") {
        row("Placeholder", obj.props.placeholder);
      }
      row("Style", String(Object.keys(obj.style || {}).length) + " properties");
    } else {
      row("Id", id);
      row("Note", "Not in the current scene.");
    }
    body.appendChild(dl);
  }

  // ---------- feedback queue ----------

  function wireChips() {
    el.chips.innerHTML = "";
    CHIPS.forEach(function (chip) {
      var btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.textContent = chip.label;
      btn.setAttribute("data-chip", chip.value);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        btn.setAttribute("aria-pressed", String(btn.getAttribute("aria-pressed") !== "true"));
      });
      el.chips.appendChild(btn);
    });
  }

  function selectedChips() {
    return Array.prototype.slice
      .call(el.chips.querySelectorAll('.chip[aria-pressed="true"]'))
      .map(function (btn) {
        return btn.getAttribute("data-chip");
      });
  }

  function resetFeedbackForm() {
    el.feedbackText.value = "";
    el.chips.querySelectorAll('.chip[aria-pressed="true"]').forEach(function (btn) {
      btn.setAttribute("aria-pressed", "false");
    });
  }

  async function addToQueue() {
    if (!state.selectedId) {
      showToast("Select an object first.");
      return;
    }
    var text = el.feedbackText.value.trim();
    var chips = selectedChips();
    if (!text && chips.length === 0) {
      showToast("Describe the change or pick a quick-feedback chip.");
      return;
    }
    el.addToQueue.disabled = true;
    try {
      await fetchJson("/api/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: state.sceneId,
          objectId: state.selectedId,
          baseRevision: state.scene ? state.scene.revision : 0,
          feedback: { text: text || undefined, chips: chips },
        }),
      });
      resetFeedbackForm();
      await loadPatches();
      showToast("Added to the queue.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not add to the queue.");
    } finally {
      el.addToQueue.disabled = false;
    }
  }

  function queueCounts() {
    var counts = { draft: 0, sent: 0, applied: 0, rejected: 0, conflict: 0 };
    state.patches.forEach(function (patch) {
      if (Object.prototype.hasOwnProperty.call(counts, patch.status)) {
        counts[patch.status] += 1;
      }
    });
    return counts;
  }

  function renderTray() {
    var counts = queueCounts();
    el.traySummary.textContent =
      counts.draft +
      " draft · " +
      counts.sent +
      " sent · " +
      counts.applied +
      " applied · " +
      counts.rejected +
      " rejected · " +
      counts.conflict +
      " conflict";

    el.queueList.innerHTML = "";
    if (state.patches.length === 0) {
      var empty = document.createElement("li");
      empty.className = "muted";
      empty.style.padding = "8px 4px";
      empty.textContent = "No feedback queued yet. Select an object and add feedback.";
      el.queueList.appendChild(empty);
    } else {
      state.patches.forEach(function (patch) {
        var meta = STATUS_META[patch.status] || { icon: "?", label: patch.status };
        var li = document.createElement("li");
        li.className = "queue-item";

        var status = document.createElement("span");
        status.className = "status status-" + patch.status;
        status.textContent = meta.icon + " " + meta.label;
        li.appendChild(status);

        var objectCell = document.createElement("span");
        objectCell.className = "item-object";
        objectCell.textContent = patch.objectId;
        li.appendChild(objectCell);

        var message = document.createElement("span");
        message.className = "item-message";
        message.title = patch.message;
        message.textContent = patch.message;
        li.appendChild(message);

        var actions = document.createElement("span");
        actions.className = "item-actions";
        if (patch.status === "draft") {
          actions.appendChild(actionButton("Discard", "Discard this draft", function () {
            discardPatch(patch.id);
          }));
        } else if (patch.status === "conflict") {
          actions.appendChild(actionButton("Keep mine", "Keep your version and re-queue the draft", function () {
            resolvePatch(patch.id, "keep-mine");
          }));
          actions.appendChild(actionButton("Take agent's", "Accept the agent's change and mark applied", function () {
            resolvePatch(patch.id, "take-agents");
          }));
        }
        li.appendChild(actions);
        el.queueList.appendChild(li);
      });
    }

    el.sendBtn.disabled = counts.draft === 0;
    el.sendBtn.textContent =
      counts.draft === 0 ? "Send changes" : "Send " + counts.draft + " change" + (counts.draft === 1 ? "" : "s");

    var waiting = counts.draft === 0 && counts.sent > 0;
    el.waitingBanner.hidden = !waiting;
  }

  function actionButton(label, title, onClick) {
    var btn = document.createElement("button");
    btn.className = "icon-button";
    btn.type = "button";
    btn.textContent = label;
    btn.setAttribute("title", title);
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", onClick);
    return btn;
  }

  async function loadPatches() {
    try {
      var data = await fetchJson("/api/patches?scene=" + encodeURIComponent(state.sceneId));
      state.patches = data.patches || [];
      renderTray();
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not load the patch queue.");
    }
  }

  async function sendDrafts() {
    el.sendBtn.disabled = true;
    try {
      var data = await fetchJson("/api/patches/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: state.sceneId }),
      });
      var sent = (data.patches || []).length;
      // Open the tray so the user sees the sent items and the waiting banner (design.md 4.10)
      state.trayOpen = true;
      el.trayToggle.setAttribute("aria-expanded", "true");
      el.trayBody.hidden = false;
      el.trayCaret.textContent = "▾";
      await loadPatches();
      showToast(sent > 0 ? "Sent " + sent + " change" + (sent === 1 ? "" : "s") + " to the agent." : "Nothing to send.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not send drafts.");
      await loadPatches();
    }
  }

  async function discardPatch(id) {
    try {
      await fetchJson("/api/patches/" + encodeURIComponent(id) + "?scene=" + encodeURIComponent(state.sceneId), {
        method: "DELETE",
      });
      await loadPatches();
      showToast("Draft discarded.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not discard the draft.");
    }
  }

  async function resolvePatch(id, choice) {
    try {
      await fetchJson("/api/patches/" + encodeURIComponent(id) + "/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: state.sceneId, choice: choice }),
      });
      await loadPatches();
      showToast(choice === "keep-mine" ? "Kept your version; re-queued as a draft." : "Accepted the agent's change.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not resolve the conflict.");
    }
  }

  // ---------- SSE ----------

  function connectEvents() {
    var source = new EventSource("/api/events?scene=" + encodeURIComponent(state.sceneId));
    source.onmessage = function (event) {
      var data = null;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        return;
      }
      if (!data || typeof data !== "object") return;
      if (data.type === "revision") {
        setTrayNotice("");
        loadPatches();
        loadSceneSoft();
      } else if (data.type === "patch.changed") {
        loadPatches();
      }
    };
    source.onopen = function () {
      setTrayNotice("");
    };
    source.onerror = function () {
      setTrayNotice("Live updates paused — retrying…");
    };
  }

  async function loadSceneSoft() {
    try {
      var data = await fetchJson("/api/scene?scene=" + encodeURIComponent(state.sceneId));
      var revisionChanged = !state.scene || state.scene.revision !== data.scene.revision;
      state.scene = data.scene;
      if (revisionChanged) {
        renderScreens();
        renderLayers();
        renderInspector();
        await renderPreview();
      }
    } catch (err) {
      // Keep the current scene on screen; a toast would be noisy on transient errors.
    }
  }

  // ---------- wiring ----------

  function wireTabs() {
    el.inspectorTab.addEventListener("click", function () {
      activateTab("inspector");
    });
    el.feedbackTab.addEventListener("click", function () {
      activateTab("feedback");
    });
  }

  function activateTab(which) {
    var showFeedback = which === "feedback";
    el.feedbackTab.setAttribute("aria-selected", String(showFeedback));
    el.inspectorTab.setAttribute("aria-selected", String(!showFeedback));
    el.feedbackPanel.hidden = !showFeedback;
    el.inspectorPanel.hidden = showFeedback;
    if (showFeedback) el.feedbackText.focus();
  }

  function wireSendButton() {
    el.sendBtn.addEventListener("click", sendDrafts);
    el.addToQueue.addEventListener("click", addToQueue);
    el.screenSelect.addEventListener("change", function () {
      var i = Number(el.screenSelect.value);
      if (Number.isFinite(i)) {
        state.screenIndex = i;
        renderScreens();
        renderPreview();
      }
    });
  }

  function wireTray() {
    el.trayToggle.addEventListener("click", function () {
      state.trayOpen = !state.trayOpen;
      el.trayToggle.setAttribute("aria-expanded", String(state.trayOpen));
      el.trayBody.hidden = !state.trayOpen;
      el.trayCaret.textContent = state.trayOpen ? "▾" : "▸";
    });
  }

  function wireCopyPrompt() {
    el.copyPrompt.addEventListener("click", function () {
      var done = function () {
        showToast("Prompt copied — paste it into your agent.");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(COPY_PROMPT).then(done, done);
      } else {
        var area = document.createElement("textarea");
        area.value = COPY_PROMPT;
        area.setAttribute("readonly", "");
        area.style.position = "absolute";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand("copy");
        } catch (err) {
          // best effort
        }
        document.body.removeChild(area);
        done();
      }
    });
  }

  async function boot() {
    cacheEls();
    window.addEventListener("message", handlePreviewMessage);
    window.addEventListener("resize", function () {
      if (state.selectedId) {
        postToPreview({ t: "select", channel: state.channel, ids: [state.selectedId] });
      }
    });

    // Token exchange via the URL fragment (trd 11.2), then scrub the fragment.
    var match = /#t=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    if (match) {
      var ok = false;
      try {
        var res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: match[1] }),
        });
        ok = res.status === 204;
      } catch (err) {
        ok = false;
      }
      if (!ok) {
        showFatal("This link is invalid or has expired. Open the Studio again instead of reusing a stale link.");
        return;
      }
      window.history.replaceState(null, "", window.location.pathname);
    }

    wireChips();
    wireTabs();
    wireSendButton();
    wireTray();
    wireCopyPrompt();

    try {
      await loadScene();
      await loadPatches();
      connectEvents();
    } catch (err) {
      showFatal(err && err.message ? err.message : "The scene could not be loaded.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
