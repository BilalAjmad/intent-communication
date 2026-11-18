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
    annotating: false,
    annotations: [],
    stroke: null,
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
    el.interviewTab = $("tab-interview");
    el.interviewPanel = $("interview-panel");
    el.interviewBody = $("interview-body");
    el.profileTab = $("tab-profile");
    el.profilePanel = $("profile-panel");
    el.profileBody = $("profile-body");
    el.addToQueue = $("add-to-queue");
    el.lintChip = $("lint-chip");
    el.lintPanel = $("lint-panel");
    el.annotateToggle = $("annotate-toggle");
    el.pinToggle = $("pin-toggle");
    el.pinsLayer = $("pins-layer");
    el.annotationCanvas = $("annotation-canvas");
    el.annotationsFieldset = $("annotations-fieldset");
    el.annotationsList = $("annotations-list");
    el.attachAnnotations = $("attach-annotations");
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
    state.locked = Array.isArray(data && data.locked) ? data.locked : [];
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
      li.setAttribute("aria-level", String(row.depth + 1));
      li.setAttribute("aria-selected", String(state.selectedId === row.id));
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
      // Annotations belong to a screen; repaint the ones for the new preview.
      clearAnnotationCanvas();
      redrawAnnotations();
      renderPins();
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

  function lockedObjectIds() {
    var locked = state.locked;
    return Array.isArray(locked) ? locked : [];
  }

  function mergedStyleValue(objectId, additions) {
    var obj = state.scene && state.scene.objects ? state.scene.objects[objectId] : null;
    var base = obj && obj.style ? Object.assign({}, obj.style) : {};
    return Object.assign(base, additions || {});
  }

  async function commitStyleEdit(objectId, additions, done) {
    try {
      await fetchJson("/api/object-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: state.sceneId,
          objectId: objectId,
          baseRevision: state.scene ? state.scene.revision : 0,
          style: mergedStyleValue(objectId, additions),
        }),
      });
      await loadScene();
      await renderPreview();
      renderSelection();
      if (typeof done === "function") done(true);
    } catch (err) {
      var message = err && err.message ? err.message : "Could not apply the edit.";
      if (message.indexOf("E_CONFLICT") !== -1 || /changed/i.test(message)) {
        showToast("The scene changed since you last saw it — reloaded it. Try again.");
        await loadScene();
        await renderPreview();
        renderSelection();
      } else {
        showToast(message);
      }
      if (typeof done === "function") done(false);
    }
  }

  function snapToGrid(value, event) {
    if (event && event.altKey) return Math.round(value);
    return Math.round(value / 4) * 4;
  }

  function renderOverlay(rects) {
    el.overlay.innerHTML = "";
    state.lastRects = rects;
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

      var dragEnabled =
        !state.pinMode &&
        !state.annotating &&
        lockedObjectIds().indexOf(id) === -1;
      if (dragEnabled) {
        box.classList.add("drag-enabled");
        attachDragHandlers(box, id, r);
        var handle = document.createElement("div");
        handle.className = "resize-handle";
        handle.setAttribute("title", "Resize");
        attachResizeHandlers(handle, box, id, r);
        box.appendChild(handle);
      }
      el.overlay.appendChild(box);
    });
  }

  function attachDragHandlers(box, id, rect) {
    box.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      if (event.target && event.target.classList && event.target.classList.contains("resize-handle")) return;
      var base = { x: rect.x, y: rect.y };
      var start = { x: event.clientX, y: event.clientY };
      var moved = false;
      box.setPointerCapture(event.pointerId);
      document.body.classList.add("resizing-active");
      function onMove(ev) {
        var dx = ev.clientX - start.x;
        var dy = ev.clientY - start.y;
        var snappedDx = snapToGrid(dx, ev);
        var snappedDy = snapToGrid(dy, ev);
        if (Math.abs(snappedDx) < 2 && Math.abs(snappedDy) < 2) return;
        moved = true;
        box.style.left = (base.x + snappedDx) + "px";
        box.style.top = (base.y + snappedDy) + "px";
      }
      function onUp(ev) {
        box.removeEventListener("pointermove", onMove);
        box.removeEventListener("pointerup", onUp);
        box.removeEventListener("pointercancel", onUp);
        document.body.classList.remove("resizing-active");
        try {
          box.releasePointerCapture(event.pointerId);
        } catch (err) {
          // capture may already be released
        }
        if (!moved) return;
        var dx = snapToGrid(ev.clientX - start.x, ev);
        var dy = snapToGrid(ev.clientY - start.y, ev);
        var left = Math.max(0, base.x + dx);
        var top = Math.max(0, base.y + dy);
        var obj = state.scene && state.scene.objects ? state.scene.objects[id] : null;
        var additions = { left: Math.round(left) + "px", top: Math.round(top) + "px" };
        var alreadyAbsolute = obj && obj.style && String(obj.style.position || "") === "absolute";
        if (!alreadyAbsolute) additions.position = "absolute";
        void commitStyleEdit(id, additions, function () {
          postToPreview({ t: "select", channel: state.channel, ids: [id] });
        });
      }
      box.addEventListener("pointermove", onMove);
      box.addEventListener("pointerup", onUp);
      box.addEventListener("pointercancel", onUp);
    });
  }

  function attachResizeHandlers(handle, box, id, rect) {
    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      event.stopPropagation();
      var base = { w: rect.w, h: rect.h };
      var start = { x: event.clientX, y: event.clientY };
      var moved = false;
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add("resizing-active");
      function onMove(ev) {
        var dw = ev.clientX - start.x;
        var dh = ev.clientY - start.y;
        var snappedW = Math.max(24, snapToGrid(base.w + dw, ev));
        var snappedH = Math.max(24, snapToGrid(base.h + dh, ev));
        if (Math.abs(snappedW - base.w) < 2 && Math.abs(snappedH - base.h) < 2) return;
        moved = true;
        box.style.width = snappedW + "px";
        box.style.height = snappedH + "px";
      }
      function onUp(ev) {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.classList.remove("resizing-active");
        try {
          handle.releasePointerCapture(event.pointerId);
        } catch (err) {
          // capture may already be released
        }
        if (!moved) return;
        var dw = ev.clientX - start.x;
        var dh = ev.clientY - start.y;
        var width = Math.max(24, snapToGrid(base.w + dw, ev));
        var height = Math.max(24, snapToGrid(base.h + dh, ev));
        void commitStyleEdit(id, { width: Math.round(width) + "px", height: Math.round(height) + "px" }, function () {
          postToPreview({ t: "select", channel: state.channel, ids: [id] });
        });
      }
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
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

  async function renderVersionsSection(body) {
    var wrap = document.createElement("div");
    wrap.className = "versions-section";
    var title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = "Snapshots";
    wrap.appendChild(title);
    var list = document.createElement("ul");
    list.className = "versions-list";
    var loading = document.createElement("li");
    loading.className = "muted";
    loading.textContent = "Loading…";
    list.appendChild(loading);
    wrap.appendChild(list);
    body.appendChild(wrap);
    try {
      var data = await fetchJson("/api/versions?sceneId=" + encodeURIComponent(state.sceneId));
      var versions = Array.isArray(data && data.versions) ? data.versions : [];
      list.innerHTML = "";
      if (versions.length === 0) {
        var empty = document.createElement("li");
        empty.className = "muted";
        empty.textContent = "No snapshots yet — they appear after the first Send.";
        list.appendChild(empty);
        return;
      }
      versions.slice(0, 5).forEach(function (v) {
        var li = document.createElement("li");
        li.className = "version-item";
        var label = document.createElement("span");
        var when = new Date(v.createdAt);
        var whenText = isNaN(when.getTime()) ? String(v.createdAt) : when.toLocaleString();
        label.textContent = "r" + v.revision + " — " + whenText;
        label.title = v.file;
        var restore = document.createElement("button");
        restore.className = "icon-button";
        restore.type = "button";
        restore.textContent = "Restore";
        restore.setAttribute("aria-label", "Restore snapshot " + v.file);
        restore.addEventListener("click", function () {
          void restoreVersion(v.file);
        });
        li.appendChild(label);
        li.appendChild(restore);
        list.appendChild(li);
      });
    } catch (err) {
      list.innerHTML = "";
      var errItem = document.createElement("li");
      errItem.className = "muted";
      errItem.textContent = "Could not load snapshots.";
      list.appendChild(errItem);
    }
  }

  async function renderMetricsSection(body) {
    var wrap = document.createElement("div");
    wrap.className = "versions-section";
    var title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = "Acceptance";
    wrap.appendChild(title);
    var line = document.createElement("p");
    line.className = "muted";
    line.textContent = "Loading…";
    wrap.appendChild(line);
    body.appendChild(wrap);
    try {
      var data = await fetchJson("/api/metrics?sceneId=" + encodeURIComponent(state.sceneId));
      var metrics = data && data.metrics ? data.metrics : null;
      if (!metrics || !metrics.available) {
        var reason = metrics && typeof metrics.reason === "string" ? metrics.reason : "Not enough data yet";
        line.textContent = "Not enough data yet — the baseline appears after the agent's first applied change. " +
          (reason ? "(" + reason + ")" : "");
        return;
      }
      var pct = typeof metrics.acceptanceRate === "number" ? (metrics.acceptanceRate * 100).toFixed(1) : "—";
      wrap.innerHTML = "";
      wrap.appendChild(title);
      var big = document.createElement("p");
      big.className = "metric-value";
      big.textContent = pct + "%";
      wrap.appendChild(big);
      var detail = document.createElement("p");
      detail.className = "muted";
      detail.textContent = metrics.unchanged + " of " + metrics.baselineObjectsStillPresent +
        " baseline objects unchanged by the agent · " + metrics.removedAfterBaseline + " removed · " +
        metrics.addedAfterBaseline + " added";
      wrap.appendChild(detail);
    } catch (err) {
      line.textContent = "Could not load the acceptance metric.";
    }
  }

  // ---------- profile (trd 17.1) ----------

  async function renderProfilePanel() {
    var body = el.profileBody;
    body.innerHTML = '<p class="muted">Loading…</p>';
    var data;
    try {
      data = await fetchJson("/api/profile-intent");
    } catch (err) {
      body.innerHTML = '<p class="muted">Could not load the profile.</p>';
      return;
    }
    var entries = Array.isArray(data && data.entries) ? data.entries : [];
    body.innerHTML = "";
    var intro = document.createElement("p");
    intro.className = "muted profile-intro";
    intro.textContent = "Remembered preferences from your interview answers. Agents see a short summary, never your scene. Values are normalized choices only.";
    body.appendChild(intro);
    if (entries.length === 0) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Nothing learned yet — answer a few interview questions (or give explicit answers with a value) and the profile builds itself.";
      body.appendChild(empty);
      return;
    }
    var list = document.createElement("ul");
    list.className = "profile-list";
    entries.slice(0, 100).forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "profile-item";
      var main = document.createElement("p");
      main.className = "profile-text";
      main.textContent = String(entry.text || "");
      li.appendChild(main);
      var meta = document.createElement("p");
      meta.className = "profile-meta";
      var confidence = typeof entry.confidence === "number" ? Math.round(entry.confidence * 100) : 0;
      var when = entry.updatedAt ? new Date(entry.updatedAt) : null;
      meta.textContent = confidence + "% confidence · " + (entry.count || 1) + " signal" + ((entry.count || 1) === 1 ? "" : "s") +
        (when && !isNaN(when.getTime()) ? " · " + when.toLocaleDateString() : "");
      li.appendChild(meta);
      var actions = document.createElement("div");
      actions.className = "profile-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", "Edit profile entry: " + String(entry.text));
      edit.addEventListener("click", function () { beginProfileEdit(li, entry); });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "icon-button";
      del.textContent = "Delete";
      del.setAttribute("aria-label", "Delete profile entry: " + String(entry.text));
      del.addEventListener("click", function () { void deleteProfileEntry(entry.id); });
      actions.appendChild(edit);
      actions.appendChild(del);
      li.appendChild(actions);
      list.appendChild(li);
    });
    body.appendChild(list);
  }

  function beginProfileEdit(li, entry) {
    li.innerHTML = "";
    var form = document.createElement("form");
    form.className = "profile-edit-form";
    var input = document.createElement("input");
    input.type = "text";
    input.value = String(entry.text || "");
    input.maxLength = 200;
    input.className = "profile-edit-input";
    input.setAttribute("aria-label", "Edit remembered preference");
    var save = document.createElement("button");
    save.type = "submit";
    save.className = "icon-button";
    save.textContent = "Save";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "icon-button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", function () { void renderProfilePanel(); });
    form.appendChild(input);
    form.appendChild(save);
    form.appendChild(cancel);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      void saveProfileEntry(entry.id, String(input.value));
    });
    li.appendChild(form);
    input.focus();
    input.select();
  }

  async function saveProfileEntry(id, text) {
    var trimmed = text.trim();
    if (!trimmed || trimmed.length > 200) {
      showToast("Text must be 1–200 characters.");
      return;
    }
    try {
      await fetchJson("/api/profile-intent/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: trimmed }) });
      await renderProfilePanel();
    } catch (err) {
      showToast("Could not save the entry.");
    }
  }

  async function deleteProfileEntry(id) {
    if (!window.confirm("Delete this remembered preference? It will not be re-learned automatically.")) return;
    try {
      await fetchJson("/api/profile-intent/" + encodeURIComponent(id), { method: "DELETE" });
      await renderProfilePanel();
    } catch (err) {
      showToast("Could not delete the entry.");
    }
  }

  async function restoreVersion(file) {
    if (!window.confirm("Restore this snapshot? The current scene will be replaced, and its revision will be bumped.")) return;
    try {
      await fetchJson(
        "/api/versions/" + encodeURIComponent(file) + "/restore?sceneId=" + encodeURIComponent(state.sceneId),
        { method: "POST" },
      );
      showToast("Snapshot restored.");
      await loadScene();
      await loadAnnotations();
      await loadLint();
      renderInspector();
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not restore the snapshot.");
    }
  }

  // ---------- inspector ----------

  // ---------- animation editor (trd 13.6) ----------

  var ANIM_PROPERTIES = ["background-color", "color", "opacity", "transform", "border-color"];
  var ANIM_DURATIONS = [100, 150, 200, 300, 500];
  var ANIM_EASINGS = ["ease", "ease-in", "ease-out", "linear", "cubic-bezier(0.2, 0, 0, 1)"];

  function renderAnimationRow(body, obj, id) {
    var wrap = document.createElement("div");
    wrap.className = "animation-row";
    var title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = "Animation";
    wrap.appendChild(title);

    var grid = document.createElement("div");
    grid.className = "anim-grid";

    var propLabel = document.createElement("label");
    propLabel.className = "anim-field";
    propLabel.textContent = "Property";
    var propSelect = document.createElement("select");
    ANIM_PROPERTIES.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      propSelect.appendChild(opt);
    });
    propLabel.appendChild(propSelect);

    var durLabel = document.createElement("label");
    durLabel.className = "anim-field";
    durLabel.textContent = "Duration";
    var durSelect = document.createElement("select");
    ANIM_DURATIONS.forEach(function (ms) {
      var opt = document.createElement("option");
      opt.value = String(ms);
      opt.textContent = ms + "ms";
      durSelect.appendChild(opt);
    });
    durSelect.value = "200";
    durLabel.appendChild(durSelect);

    var easLabel = document.createElement("label");
    easLabel.className = "anim-field";
    easLabel.textContent = "Easing";
    var easSelect = document.createElement("select");
    ANIM_EASINGS.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e;
      opt.textContent = e;
      easSelect.appendChild(opt);
    });
    easLabel.appendChild(easSelect);

    grid.appendChild(propLabel);
    grid.appendChild(durLabel);
    grid.appendChild(easLabel);
    wrap.appendChild(grid);

    var actions = document.createElement("div");
    actions.className = "anim-actions";
    var applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "chip anim-apply";
    applyBtn.textContent = "Apply transition";
    applyBtn.addEventListener("click", function () {
      var value = propSelect.value + " " + Number(durSelect.value) + "ms " + easSelect.value;
      var additions = { transition: value };
      void commitStyleEdit(id, additions, function () {
        postToPreview({ t: "select", channel: state.channel, ids: [id] });
      });
    });
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "chip";
    removeBtn.textContent = "Remove transition";
    removeBtn.addEventListener("click", function () {
      // Unset via empty value; the engine drops empty declarations so the
      // transition stops rendering. Any future full @keyframes editor lands here.
      void commitStyleEdit(id, { transition: "" }, function () {
        postToPreview({ t: "select", channel: state.channel, ids: [id] });
      });
    });
    actions.appendChild(applyBtn);
    actions.appendChild(removeBtn);
    wrap.appendChild(actions);
    body.appendChild(wrap);
  }

  function statesForType(type) {
    switch (type) {
      case "button": return ["hover", "pressed", "focus", "loading", "error"];
      case "input": return ["focus", "filled", "error"];
      case "checkbox":
      case "radio":
      case "switch": return ["checked", "focus", "disabled"];
      case "link": return ["visited", "hover"];
      case "list": return ["empty", "loading"];
      case "modal": return ["open"];
      default: return [];
    }
  }

  function toggleForceState(id, stateName, btn) {
    // Pressing the active state again clears it.
    var isActive = btn.getAttribute("aria-pressed") === "true";
    var next = isActive ? "" : stateName;
    var siblings = btn.parentElement ? btn.parentElement.querySelectorAll("button[aria-pressed]") : [];
    siblings.forEach(function (sib) { sib.setAttribute("aria-pressed", "false"); });
    if (!isActive) btn.setAttribute("aria-pressed", "true");
    postToPreview({ t: "forceState", channel: state.channel, id: id, state: next });
  }

  function renderForceStateRow(body, obj, id) {
    var states = statesForType(obj.type);
    if (states.length === 0) return;
    var wrap = document.createElement("div");
    wrap.className = "force-state-row";
    var title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = "Preview state";
    wrap.appendChild(title);
    states.forEach(function (s) {
      var btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.textContent = s;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () { toggleForceState(id, s, btn); });
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
  }

  function renderInspector() {
    var body = el.inspectorBody;
    body.innerHTML = "";
    if (!state.selectedId) {
      body.innerHTML = '<p class="muted">Select an object on the canvas or in Layers to see its details.</p>';
      renderVersionsSection(body);
      renderMetricsSection(body);
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
    if (obj) renderForceStateRow(body, obj, id);
    if (obj) renderAnimationRow(body, obj, id);
    renderVersionsSection(body);
    renderMetricsSection(body);
  }

  // ---------- annotations (trd 9.7) ----------

  function currentScreenIdSafe() {
    var id = orderedScreenIds()[state.screenIndex];
    return typeof id === "string" ? id : null;
  }

  var STROKE_HEX = { red: "#dc2626", blue: "#2563eb", green: "#16a34a", black: "#111827" };

  async function loadAnnotations() {
    try {
      var data = await fetchJson("/api/annotations?sceneId=" + encodeURIComponent(state.sceneId));
      state.annotations = Array.isArray(data && data.annotations) ? data.annotations : [];
    } catch (err) {
      state.annotations = [];
    }
    renderAnnotations();
    redrawAnnotations();
    renderPins();
  }

  function renderAnnotations() {
    var screenId = currentScreenIdSafe();
    var open = state.annotations.filter(function (a) { return a.status === "open" && a.screenId === screenId; });
    if (open.length === 0) {
      el.annotationsFieldset.hidden = true;
      el.annotationsList.innerHTML = "";
      return;
    }
    el.annotationsFieldset.hidden = false;
    el.annotationsList.innerHTML = "";
    open.forEach(function (a) {
      var li = document.createElement("li");
      li.className = "annotation-item";
      var strokeCount = Array.isArray(a.strokes) ? a.strokes.length : 0;
      var summary = a.kind === "pencil"
        ? "Pencil stroke (" + strokeCount + ")"
        : "Pin: " + (typeof a.text === "string" ? a.text.slice(0, 80) : "(no text)");
      var text = document.createElement("span");
      text.textContent = summary;
      text.title = summary;
      var del = document.createElement("button");
      del.className = "icon-button";
      del.type = "button";
      del.textContent = "Discard";
      del.setAttribute("aria-label", "Discard annotation");
      del.addEventListener("click", function () {
        void deleteAnnotation(a.id);
      });
      li.appendChild(text);
      li.appendChild(del);
      el.annotationsList.appendChild(li);
    });
  }

  async function deleteAnnotation(id) {
    try {
      await fetchJson(
        "/api/annotations/" + encodeURIComponent(id) + "?sceneId=" + encodeURIComponent(state.sceneId),
        { method: "DELETE" },
      );
      await loadAnnotations();
      showToast("Annotation discarded.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not discard the annotation.");
    }
  }

  function openAnnotationIds() {
    var screenId = currentScreenIdSafe();
    return state.annotations
      .filter(function (a) { return a.status === "open" && a.screenId === screenId; })
      .map(function (a) { return a.id; });
  }

  function syncAnnotationCanvas() {
    var canvas = el.annotationCanvas;
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.floor(rect.width));
    var h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function annotationCtx() {
    return el.annotationCanvas.getContext("2d");
  }

  function clearAnnotationCanvas() {
    var ctx = annotationCtx();
    var canvas = el.annotationCanvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function redrawAnnotations() {
    var canvas = el.annotationCanvas;
    if (!canvas) return;
    var ctx = annotationCtx();
    var screenId = currentScreenIdSafe();
    clearAnnotationCanvas();
    state.annotations.forEach(function (a) {
      if (a.screenId !== screenId || !Array.isArray(a.strokes)) return;
      a.strokes.forEach(function (stroke) {
        if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return;
        ctx.strokeStyle = STROKE_HEX[stroke.color] || STROKE_HEX.red;
        ctx.lineWidth = typeof stroke.width === "number" ? stroke.width : 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (var i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        }
        ctx.stroke();
      });
    });
  }

  function canvasPoint(event) {
    var rect = el.annotationCanvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function snap(value) {
    return Math.round(value * 10) / 10;
  }

  function wireAnnotationCanvas() {
    var canvas = el.annotationCanvas;
    canvas.addEventListener("pointerdown", function (event) {
      if (!state.annotating) return;
      canvas.setPointerCapture(event.pointerId);
      syncAnnotationCanvas();
      var p = canvasPoint(event);
      state.stroke = { color: "red", width: 4, points: [[snap(p[0]), snap(p[1])]] };
      var ctx = annotationCtx();
      ctx.strokeStyle = STROKE_HEX.red;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(snap(p[0]), snap(p[1]));
      event.preventDefault();
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!state.annotating || !state.stroke) return;
      var p = canvasPoint(event);
      var ctx = annotationCtx();
      state.stroke.points.push([snap(p[0]), snap(p[1])]);
      var n = state.stroke.points.length;
      var last = state.stroke.points[n - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
      event.preventDefault();
    });
    var finish = function (event) {
      if (!state.annotating || !state.stroke) return;
      var stroke = state.stroke;
      state.stroke = null;
      if (stroke.points.length >= 2) {
        void saveStroke(stroke);
      }
      if (event && typeof event.preventDefault === "function") event.preventDefault();
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
  }

  async function saveStroke(stroke) {
    try {
      await fetchJson("/api/annotations?sceneId=" + encodeURIComponent(state.sceneId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "pencil",
          objectId: state.selectedId,
          screenId: currentScreenIdSafe(),
          anchor: { x: stroke.points[0][0], y: stroke.points[0][1] },
          strokes: [stroke],
        }),
      });
      await loadAnnotations();
      showToast("Annotation saved.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not save the annotation.");
    }
  }

  function setAnnotateMode(on) {
    state.annotating = on;
    if (on) state.pinMode = false;
    syncMarkupMode();
  }

  function setPinMode(on) {
    state.pinMode = on;
    if (on) state.annotating = false;
    syncMarkupMode();
  }

  function syncMarkupMode() {
    document.body.classList.toggle("annotating", state.annotating);
    document.body.classList.toggle("pin-mode", state.pinMode);
    el.annotateToggle.setAttribute("aria-pressed", String(state.annotating));
    el.pinToggle.setAttribute("aria-pressed", String(state.pinMode));
    if (state.annotating) {
      syncAnnotationCanvas();
      redrawAnnotations();
    }
  }

  function wirePinsLayer() {
    el.pinsLayer.addEventListener("click", function (event) {
      if (!state.pinMode) return;
      var rect = el.pinsLayer.getBoundingClientRect();
      var x = Math.round((event.clientX - rect.left) * 10) / 10;
      var y = Math.round((event.clientY - rect.top) * 10) / 10;
      openPinDraft(x, y);
      event.preventDefault();
    });
  }

  function closePinDraft() {
    var draft = el.pinsLayer.querySelector(".pin-draft");
    if (draft) draft.remove();
  }

  function openPinDraft(x, y) {
    closePinDraft();
    var draft = document.createElement("div");
    draft.className = "pin-draft";
    draft.style.left = x + "px";
    draft.style.top = y + "px";
    var ta = document.createElement("textarea");
    ta.rows = 3;
    ta.maxLength = 1000;
    ta.placeholder = "What is this pin about?";
    ta.setAttribute("aria-label", "Pin note");
    var row = document.createElement("div");
    row.className = "pin-draft-row";
    var cancel = document.createElement("button");
    cancel.className = "icon-button";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    var save = document.createElement("button");
    save.className = "primary";
    save.type = "button";
    save.textContent = "Add pin";
    row.appendChild(cancel);
    row.appendChild(save);
    draft.appendChild(ta);
    draft.appendChild(row);
    el.pinsLayer.appendChild(draft);
    ta.focus();
    cancel.addEventListener("click", closePinDraft);
    save.addEventListener("click", function () {
      void savePin(x, y, ta.value.trim());
    });
    ta.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void savePin(x, y, ta.value.trim());
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePinDraft();
      }
    });
  }

  async function savePin(x, y, text) {
    if (!text) {
      showToast("Write a note for the pin first.");
      return;
    }
    try {
      await fetchJson("/api/annotations?sceneId=" + encodeURIComponent(state.sceneId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "pin",
          objectId: state.selectedId,
          screenId: currentScreenIdSafe(),
          anchor: { x: x, y: y },
          text: text,
        }),
      });
      closePinDraft();
      await loadAnnotations();
      showToast("Pin added.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not save the pin.");
    }
  }

  function renderPins() {
    var existing = el.pinsLayer.querySelectorAll(".pin");
    existing.forEach(function (n) {
      n.remove();
    });
    var screenId = currentScreenIdSafe();
    var pins = state.annotations.filter(function (a) {
      return a.status === "open" && a.screenId === screenId && a.kind === "pin";
    });
    pins.forEach(function (pin, i) {
      var marker = document.createElement("button");
      marker.className = "pin";
      marker.type = "button";
      marker.textContent = String(i + 1);
      marker.style.left = pin.anchor.x + "px";
      marker.style.top = pin.anchor.y + "px";
      marker.title = pin.text || "Pin";
      marker.setAttribute("aria-label", "Pin " + (i + 1) + ": " + (pin.text || ""));
      marker.addEventListener("click", function (event) {
        event.stopPropagation();
        if (window.confirm("Delete this pin?")) {
          void deleteAnnotation(pin.id);
        }
      });
      el.pinsLayer.appendChild(marker);
    });
  }

  function toggleAnnotate() {
    setAnnotateMode(!state.annotating);
  }

  function togglePin() {
    setPinMode(!state.pinMode);
  }

  function wireAnnotate() {
    el.annotateToggle.addEventListener("click", toggleAnnotate);
    el.pinToggle.addEventListener("click", togglePin);
    wireAnnotationCanvas();
    wirePinsLayer();
    window.addEventListener("resize", function () {
      if (!state.annotating && !state.pinMode) return;
      syncAnnotationCanvas();
      redrawAnnotations();
    });
  }

  // ---------- lint badge (trd 11.3) ----------

  async function loadLint() {
    try {
      var data = await fetchJson("/api/lint?sceneId=" + encodeURIComponent(state.sceneId));
      renderLintChip(data);
    } catch (err) {
      el.lintChip.hidden = true;
    }
  }

  function renderLintChip(data) {
    var violations = data && Array.isArray(data.violations) ? data.violations : [];
    var errors = violations.filter(function (v) { return v.severity === "error"; }).length;
    var warnings = violations.filter(function (v) { return v.severity === "warning"; }).length;
    var chip = el.lintChip;
    chip.hidden = false;
    chip.classList.remove("ok", "warn", "error");
    if (violations.length === 0) {
      chip.classList.add("ok");
      chip.textContent = "✓ Lint clean";
      chip.title = "No lint violations (trd 11.3)";
    } else if (errors > 0) {
      chip.classList.add("error");
      chip.textContent = "✗ " + errors + " error" + (errors === 1 ? "" : "s") + (warnings > 0 ? " · " + warnings + " warn" : "");
      chip.title = errors + " lint error" + (errors === 1 ? "" : "s");
    } else {
      chip.classList.add("warn");
      chip.textContent = "⚠ " + warnings + " warning" + (warnings === 1 ? "" : "s");
      chip.title = warnings + " lint warning" + (warnings === 1 ? "" : "s");
    }
    renderLintPanel(violations);
  }

  function renderLintPanel(violations) {
    var panel = el.lintPanel;
    panel.innerHTML = "";
    var title = document.createElement("div");
    title.className = "lint-panel-title";
    title.textContent = "Lint violations (" + violations.length + ")";
    panel.appendChild(title);
    if (violations.length === 0) {
      var empty = document.createElement("p");
      empty.className = "lint-empty";
      empty.textContent = "No violations — the scene passes the full M1+M2 ruleset.";
      panel.appendChild(empty);
      return;
    }
    var ul = document.createElement("ul");
    violations.slice(0, 50).forEach(function (v) {
      var li = document.createElement("li");
      li.className = "lint-item " + (v.severity === "error" ? "error" : "warning");
      var rule = document.createElement("span");
      rule.className = "lint-rule";
      rule.textContent = v.ruleId || "?";
      var msg = document.createElement("span");
      msg.textContent = (v.message || "") + (v.path ? " (" + v.path + ")" : "");
      if (v.suggestion) msg.title = "Fix: " + v.suggestion;
      li.appendChild(rule);
      li.appendChild(msg);
      ul.appendChild(li);
    });
    panel.appendChild(ul);
  }

  function setLintPanelOpen(open) {
    el.lintPanel.hidden = !open;
    el.lintChip.setAttribute("aria-expanded", String(open));
  }

  function wireLintChip() {
    el.lintChip.addEventListener("click", function (event) {
      event.stopPropagation();
      setLintPanelOpen(el.lintPanel.hidden);
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest("#lint-panel") && !event.target.closest("#lint-chip")) {
        setLintPanelOpen(false);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setLintPanelOpen(false);
    });
    wireNudgeKeys();
  }

  // design.md 4.2: Arrow keys move the selected object by 4 px (Shift = 8 px).
  // Bursts coalesce: one atomic style op per ~300 ms of quiet, through the same
  // /api/object-style path as canvas drags.
  function wireNudgeKeys() {
    var nudge = { id: null, dx: 0, dy: 0, timer: 0, base: null };

    function isTypingTarget(target) {
      return !!(target && target.closest && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
    }

    function commitNudge() {
      var id = nudge.id;
      var dx = nudge.dx;
      var dy = nudge.dy;
      var base = nudge.base;
      nudge = { id: null, dx: 0, dy: 0, timer: 0, base: null };
      if (!id || !base || (!dx && !dy)) return;
      if (state.scene && lockedObjectIds().indexOf(id) !== -1) return;
      var left = Math.max(0, Math.round(base.x + dx));
      var top = Math.max(0, Math.round(base.y + dy));
      var obj = state.scene && state.scene.objects ? state.scene.objects[id] : null;
      var alreadyAbsolute = obj && obj.style && String(obj.style.position || "") === "absolute";
      var additions = { left: left + "px", top: top + "px" };
      if (!alreadyAbsolute) additions.position = "absolute";
      void commitStyleEdit(id, additions, function () {
        postToPreview({ t: "select", channel: state.channel, ids: [id] });
      });
    }

    document.addEventListener("keydown", function (event) {
      if (isTypingTarget(event.target)) return;
      if (state.pinMode || state.annotating) return;
      var deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      var delta = deltas[event.key];
      if (!delta) return;
      var id = state.selectedId;
      if (!id || lockedObjectIds().indexOf(id) !== -1) return;
      var rects = state.lastRects;
      var base = rects && rects[id];
      if (!base) return;
      event.preventDefault();
      var step = event.shiftKey ? 8 : 4;
      if (nudge.id !== id) {
        nudge = { id: id, dx: 0, dy: 0, timer: nudge.timer, base: base };
        if (nudge.timer) {
          clearTimeout(nudge.timer);
          nudge.timer = 0;
        }
      }
      nudge.dx += delta[0] * step;
      nudge.dy += delta[1] * step;
      if (nudge.timer) clearTimeout(nudge.timer);
      nudge.timer = setTimeout(commitNudge, 300);
    });
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
          feedback: {
            text: text || undefined,
            chips: chips,
            annotationIds: el.attachAnnotations && el.attachAnnotations.checked && !el.annotationsFieldset.hidden
              ? openAnnotationIds()
              : [],
          },
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
      await loadAnnotations();
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
        loadLint();
      } else if (data.type === "patch.changed") {
        loadPatches();
      } else if (data.type === "interview.changed") {
        loadInterview();
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


  // ---------- Interview tab ----------

  var TOPIC_LABELS = {
    goal: "Goal", users: "Users", screens: "Screens", flow: "Flow",
    style: "Style", content: "Content", behavior: "Behavior", "edge-cases": "Edge cases",
  };

  function interviewFreshState() {
    return {
      status: "not_started",
      meter: 0,
      meterTopics: {},
      requiredTopics: [],
      answeredTopics: [],
      pendingQuestion: null,
      answers: [],
    };
  }

  async function loadInterview() {
    try {
      var data = await fetchJson("/api/interview?scene=" + encodeURIComponent(state.sceneId));
      var fresh = data && data.state;
      if (!validInterviewState(fresh)) {
        console.warn("Ignoring malformed interview state from /api/interview");
        fresh = interviewFreshState();
      }
      state.interview = fresh;
      if (!isInterviewEditing()) renderInterview();
    } catch (err) {
      // Interview tab stays visible with an error note; the rest of the shell is unaffected.
      el.interviewBody.innerHTML = "";
      var error = document.createElement("p");
      error.className = "muted";
      error.textContent = "The interview could not be loaded. (" + (err && err.message ? err.message : "unknown error") + ")";
      el.interviewBody.appendChild(error);
    }
  }

  function meterIcon(status) {
    if (status === "covered") return "\u2713";
    if (status === "partial") return "\u25D0";
    return "\u2013";
  }

  function meterLabel(status) {
    if (status === "covered") return "covered";
    if (status === "partial") return "partly";
    return "not covered";
  }

  var interviewInflight = false;

  // H3: focus preservation across re-renders. Capture before the panel is wiped,
  // restore after. Key = tag + class + trimmed text (stable across renders).
  var lastPanelFocusKey = null;
  function focusKeyOf(elm) {
    if (!elm) return null;
    return (elm.tagName || "") + "|" + (elm.className || "") + "|" + (elm.textContent || "").trim().slice(0, 30);
  }
  function capturePanelFocus() {
    lastPanelFocusKey =
      el.interviewBody && el.interviewBody.contains(document.activeElement) ? focusKeyOf(document.activeElement) : null;
  }
  function restorePanelFocus() {
    if (!lastPanelFocusKey) return;
    var els = el.interviewBody.querySelectorAll("button, textarea, input, [tabindex='-1']");
    for (var i = 0; i < els.length; i++) {
      if (focusKeyOf(els[i]) === lastPanelFocusKey) {
        els[i].focus();
        break;
      }
    }
    lastPanelFocusKey = null;
  }
  function isInterviewEditing() {
    return !!(el.interviewBody && el.interviewBody.querySelector('.summary-items .summary-item span[contenteditable="true"]'));
  }

  // M12: never trust the wire shape; a malformed payload used to blank the tab.
  function validInterviewState(s) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return false;
    if (typeof s.status !== "string") return false;
    if (s.meter !== undefined && typeof s.meter !== "number") return false;
    if (s.meterTopics !== undefined && (typeof s.meterTopics !== "object" || s.meterTopics === null || Array.isArray(s.meterTopics))) {
      return false;
    }
    if (s.requiredTopics !== undefined && !Array.isArray(s.requiredTopics)) return false;
    if (s.answers !== undefined && !Array.isArray(s.answers)) return false;
    var pending = s.pendingQuestion;
    if (pending === null || pending === undefined) return true;
    if (typeof pending !== "object" || Array.isArray(pending)) return false;
    var validKind = ["start", "choice", "text", "scale", "confirm", "skip", "summary"].indexOf(pending.kind) !== -1;
    if (!validKind) return false;
    if (typeof pending.prompt !== "string") return false;
    if (pending.options !== undefined && !Array.isArray(pending.options)) return false;
    if (pending.kind === "summary" && pending.summary !== undefined) {
      if (typeof pending.summary !== "object" || pending.summary === null || Array.isArray(pending.summary)) return false;
      if (pending.summary.items !== undefined && !Array.isArray(pending.summary.items)) return false;
      if (pending.summary.delegated !== undefined && !Array.isArray(pending.summary.delegated)) return false;
    }
    return true;
  }

  function renderInterview() {
    capturePanelFocus();
    var state_interview = state.interview || interviewFreshState();
    var body = el.interviewBody;
    body.innerHTML = "";

    // ---- Summary screen (kind === "summary")
    var pending = state_interview.pendingQuestion;
    if (pending && pending.kind === "summary" && pending.summary) {
      renderSummaryScreen(body, state_interview, pending);
      restorePanelFocus();
      return;
    }

    // ---- Pending question card
    if (pending) {
      renderQuestionCard(body, state_interview, pending);
      restorePanelFocus();
      return;
    }

    // ---- Empty / waiting states
    if (state_interview.status === "complete") {
      var done = document.createElement("div");
      done.className = "interview-complete";
      done.innerHTML = "<strong>Interview complete.</strong><br><br>The brief is recorded. Anything else can go to the Feedback tab.";
      body.appendChild(done);
      restorePanelFocus();
      return;
    }
    var empty = document.createElement("div");
    empty.className = "interview-empty";
    var message = state_interview.status === "not_started"
      ? "No interview yet. When the agent asks questions, they will appear here."
      : "Waiting for the agent\u2026";
    empty.textContent = message;
    body.appendChild(empty);
    restorePanelFocus();
  }

  function renderMetaLine(body, pending, meter) {
    var meta = document.createElement("div");
    meta.className = "interview-meta";
    var number = pending.questionNumber || 1;
    var total = pending.estimatedTotal || 15;
    var round = pending.round || pending.topic || "Interview";
    meta.textContent =
      "Question " + number + " of about " + total + " | Understanding: ~" + Math.round(meter) + "% (estimate) | Round: " + round;
    body.appendChild(meta);
  }

  function renderMeter(body, interviewState) {
    var wrap = document.createElement("div");
    wrap.className = "meter-block";
    var label = document.createElement("div");
    label.className = "meter-label";
    var left = document.createElement("span");
    left.textContent = "Estimated understanding";
    left.title = "The agent's own estimate. Always check the preview.";
    var right = document.createElement("span");
    right.textContent = Math.round(interviewState.meter || 0) + "%";
    label.appendChild(left);
    label.appendChild(right);
    wrap.appendChild(label);
    var track = document.createElement("div");
    track.className = "meter-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(interviewState.meter || 0)));
    track.setAttribute("aria-label", "Estimated understanding");
    var fill = document.createElement("div");
    fill.className = "meter-fill";
    fill.style.width = Math.max(2, Math.round(interviewState.meter || 0)) + "%";
    track.appendChild(fill);
    wrap.appendChild(track);
    body.appendChild(wrap);

    var topics = interviewState.requiredTopics || [];
    if (topics.length > 0) {
      var chipRow = document.createElement("div");
      chipRow.className = "topic-chips";
      topics.forEach(function (topic) {
        var status = (interviewState.meterTopics && interviewState.meterTopics[topic]) || "none";
        var chip = document.createElement("span");
        chip.className = "topic-chip";
        chip.setAttribute("data-state", status);
        chip.textContent = meterIcon(status) + " " + (TOPIC_LABELS[topic] || topic) + " — " + meterLabel(status);
        chipRow.appendChild(chip);
      });
      body.appendChild(chipRow);
    }
  }

  function renderQuestionCard(body, interviewState, pending) {
    renderMetaLine(body, pending, interviewState.meter || 0);

    var q = document.createElement("p");
    q.className = "interview-question";
    q.setAttribute("tabindex", "-1");
    q.textContent = pending.prompt;
    body.appendChild(q);

    // Options (single-select; buttons activate immediately as the answer)
    if (Array.isArray(pending.options) && pending.options.length > 0) {
      var list = document.createElement("div");
      list.className = "interview-options";
      pending.options.forEach(function (option, i) {
        var btn = document.createElement("button");
        btn.className = "interview-option";
        btn.type = "button";
        var num = document.createElement("span");
        num.className = "option-number";
        num.textContent = String(i + 1) + ")";
        var text = document.createElement("span");
        text.textContent = option.label;
        btn.appendChild(num);
        btn.appendChild(text);
        btn.addEventListener("click", function () {
          submitInterviewAnswer(pending.questionId, { kind: "choice", option: option.value, label: option.label });
        });
        list.appendChild(btn);
      });
      body.appendChild(list);
    }

    // Free-text answer
    var ta = document.createElement("textarea");
    ta.className = "interview-freetext";
    ta.setAttribute("aria-label", "Or describe it in your own words");
    ta.placeholder = "Or describe it in your own words";
    ta.maxLength = 2000;
    body.appendChild(ta);
    var sendText = document.createElement("button");
    sendText.className = "primary block-button";
    sendText.type = "button";
    sendText.textContent = "Send answer";
    sendText.style.marginTop = "8px";
    sendText.addEventListener("click", function () {
      var value = ta.value.trim();
      if (!value) {
        showToast("Describe the answer first, or pick an option.");
        return;
      }
      submitInterviewAnswer(pending.questionId, { kind: "text", text: value });
    });
    body.appendChild(sendText);

    // Fixed secondary actions
    var row = document.createElement("div");
    row.className = "interview-secondary-row";
    var dk = document.createElement("button");
    dk.className = "icon-button";
    dk.type = "button";
    dk.textContent = "0) Don't know, you choose";
    dk.addEventListener("click", function () {
      submitInterviewAnswer(pending.questionId, { kind: "choice", option: "dont-know", label: "Don't know, you choose" });
    });
    var skip = document.createElement("button");
    skip.className = "icon-button";
    skip.type = "button";
    skip.textContent = "s) Skip";
    skip.addEventListener("click", function () {
      submitInterviewAnswer(pending.questionId, { kind: "skip" });
    });
    row.appendChild(dk);
    row.appendChild(skip);
    body.appendChild(row);

    // Why am I being asked this?
    if (pending.whyAsked) {
      var toggle = document.createElement("button");
      toggle.className = "why-asked-toggle";
      toggle.type = "button";
      toggle.textContent = "Why am I being asked this?";
      toggle.setAttribute("aria-expanded", "false");
      var panel = document.createElement("p");
      panel.className = "why-asked-panel";
      panel.hidden = true;
      panel.textContent = pending.whyAsked;
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        panel.hidden = open;
      });
      body.appendChild(toggle);
      body.appendChild(panel);
    }

    renderMeter(body, interviewState);

    var hint = document.createElement("p");
    hint.className = "interview-hint";
    hint.textContent = "Reply with a number, or describe it in your own words.";
    body.appendChild(hint);
  }

  function renderSummaryScreen(body, interviewState, pending) {
    var title = document.createElement("h2");
    title.className = "summary-title";
    title.setAttribute("tabindex", "-1");
    title.textContent = "Here is what I understood";
    body.appendChild(title);

    if (pending.summary.paragraph) {
      var p = document.createElement("p");
      p.className = "summary-paragraph";
      p.textContent = pending.summary.paragraph;
      body.appendChild(p);
    }

    var items = pending.summary.items || [];
    if (items.length) {
      var ul = document.createElement("ul");
      ul.className = "summary-items";
      ul.setAttribute("aria-label", "Interview summary items");
      items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "summary-item";
        var tag = document.createElement("span");
        tag.className = "tag tag-user";
        tag.textContent = "[you said]";
        var text = document.createElement("span");
        text.textContent = (item.topic ? item.topic + ": " : "") + item.text;
        li.appendChild(tag);
        li.appendChild(text);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    var delegated = pending.summary.delegated || [];
    if (delegated.length) {
      var box = document.createElement("div");
      box.className = "summary-delegated";
      var h = document.createElement("h3");
      h.textContent = "Decided by me (agent)";
      box.appendChild(h);
      delegated.forEach(function (item) {
        var line = document.createElement("p");
        line.className = "summary-item";
        var tag = document.createElement("span");
        tag.className = "tag tag-chosen";
        tag.textContent = "[chosen by me]";
        var text = document.createElement("span");
        text.textContent = (item.topic ? item.topic + ": " : "") + item.text;
        line.appendChild(tag);
        line.appendChild(text);
        box.appendChild(line);
      });
      body.appendChild(box);
    }

    renderMeter(body, interviewState);

    var actions = document.createElement("div");
    actions.className = "summary-actions";

    var exactly = document.createElement("button");
    exactly.className = "primary";
    exactly.type = "button";
    exactly.textContent = "Exactly right";
    exactly.addEventListener("click", function () {
      submitInterviewAnswer(pending.questionId, { kind: "summary", summaryChoice: "exactly-right" });
    });

    var change = document.createElement("button");
    change.className = "icon-button";
    change.type = "button";
    change.textContent = "Change something";
    change.addEventListener("click", function () {
      // Only [you said] items are editable; [chosen by me] stays readonly.
      var items = body.querySelectorAll(".summary-items .summary-item");
      items.forEach(function (item) {
        var textSpan = item.querySelector("span:last-child");
        if (textSpan) textSpan.setAttribute("contenteditable", "true");
      });
      change.disabled = true;
      exactly.disabled = true;
      more.disabled = true;
      if (!body.querySelector(".save-summary-changes")) {
        var save = document.createElement("button");
        save.className = "primary save-summary-changes";
        save.type = "button";
        save.textContent = "Save changes";
        save.addEventListener("click", function () {
          var changes = [];
          body.querySelectorAll(".summary-items .summary-item").forEach(function (item) {
            var textSpan = item.querySelector("span:last-child");
            if (textSpan) changes.push(textSpan.textContent || "");
          });
          exactly.disabled = false;
          more.disabled = false;
          submitInterviewAnswer(pending.questionId, { kind: "summary", summaryChoice: "change", changes: changes });
        });
        actions.appendChild(save);
      }
    });

    var more = document.createElement("button");
    more.className = "icon-button";
    more.type = "button";
    more.textContent = "Ask more questions";
    more.addEventListener("click", function () {
      submitInterviewAnswer(pending.questionId, { kind: "summary", summaryChoice: "ask-more" });
    });

    actions.appendChild(exactly);
    actions.appendChild(change);
    actions.appendChild(more);
    body.appendChild(actions);
  }

  async function submitInterviewAnswer(questionId, answer) {
    if (interviewInflight) return;
    interviewInflight = true;
    try {
      var data = await fetchJson("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: state.sceneId, questionId: questionId, answer: answer }),
      });
      var saved = data && data.state;
      if (!validInterviewState(saved)) {
        console.warn("Ignoring malformed interview state after answer");
        saved = interviewFreshState();
      }
      state.interview = saved;
      try {
        if (!isInterviewEditing()) renderInterview();
      } catch (renderErr) {
        console.error(renderErr);
        showToast("Answer saved. (View refresh failed.)");
        return;
      }
      showToast("Answer saved.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not save the answer.");
    } finally {
      interviewInflight = false;
    }
  }

  // ---------- interview keyboard (design 2.4: "reply with a number, or describe it in your own words") ----------
  function wireInterview() {
    el.interviewPanel.addEventListener("keydown", function (event) {
      var t = event.target;
      if (!t) return;
      if (t.closest && (t.closest("textarea") || t.closest('[contenteditable="true"]'))) {
        return; // the user is typing in the free-text field or the summary editor
      }
      if (/^[0-9]$/.test(event.key)) {
        var body = el.interviewBody;
        if (event.key === "0") {
          var dk = body.querySelector(".interview-secondary-row .icon-button:first-child");
          if (dk) {
            event.preventDefault();
            dk.click();
          }
          return;
        }
        var option = body.querySelectorAll(".interview-option")[parseInt(event.key, 10) - 1];
        if (option) {
          event.preventDefault();
          option.click();
        }
        return;
      }
      if (event.key === "s" || event.key === "S") {
        var skip = el.interviewBody.querySelector(".interview-secondary-row .icon-button:nth-child(2)");
        if (skip) {
          event.preventDefault();
          skip.click();
        }
      }
    });
  }

  function wireFrameSwitcher() {
    var buttons = {
      phone: document.getElementById("frame-phone"),
      tablet: document.getElementById("frame-tablet"),
      desktop: document.getElementById("frame-desktop"),
    };
    function setFrame(name) {
      document.body.classList.remove("frame-phone", "frame-tablet", "frame-desktop");
      document.body.classList.add("frame-" + name);
      Object.keys(buttons).forEach(function (key) {
        if (buttons[key]) buttons[key].setAttribute("aria-pressed", String(key === name));
      });
    }
    Object.keys(buttons).forEach(function (key) {
      if (buttons[key]) buttons[key].addEventListener("click", function () { setFrame(key); });
    });
    setFrame("desktop");
  }

  // design.md 4.7: Undo = restore the latest named snapshot. Real history
  // lives in .intent/versions/ (before-send). Ctrl+Z asks the user to confirm,
  // then calls the same restoreVersion path the Inspector button uses.
  function wireUndoKey() {
    document.addEventListener("keydown", function (event) {
      if (!((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && (event.key === "z" || event.key === "Z"))) return;
      var target = event.target;
      if (target && target.closest && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
      if (state.pinMode || state.annotating) return;
      event.preventDefault();
      fetchJson("/api/versions?sceneId=" + encodeURIComponent(state.sceneId))
        .then(function (data) {
          var versions = Array.isArray(data && data.versions) ? data.versions : [];
          if (versions.length === 0) {
            showToast("Nothing to undo — snapshots are created on Send.");
            return null;
          }
          return restoreVersion(versions[0].file);
        })
        .catch(function () {
          showToast("Could not load snapshots for undo.");
        });
    });
  }

  // ---------- wiring ----------

  function wireTabs() {
    el.inspectorTab.addEventListener("click", function () {
      activateTab("inspector");
    });
    el.feedbackTab.addEventListener("click", function () {
      activateTab("feedback");
    });
    el.interviewTab.addEventListener("click", function () {
      activateTab("interview");
    });
    el.profileTab.addEventListener("click", function () {
      activateTab("profile");
    });
    // Roving tabindex: one tab is tabbable at a time; arrows/Home/End move between tabs.
    el.inspectorTab.setAttribute("tabindex", "0");
    el.feedbackTab.setAttribute("tabindex", "-1");
    el.interviewTab.setAttribute("tabindex", "-1");
    el.profileTab.setAttribute("tabindex", "-1");
    var tablist = el.inspectorTab.parentElement;
    if (tablist) {
      tablist.addEventListener("keydown", function (event) {
        var tabs = [el.inspectorTab, el.feedbackTab, el.interviewTab, el.profileTab];
        var current = tabs.indexOf(document.activeElement);
        if (current === -1) return;
        var next = null;
        if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        tabs[next].focus();
        var which = tabs[next] === el.interviewTab ? "interview" : tabs[next] === el.feedbackTab ? "feedback" : tabs[next] === el.profileTab ? "profile" : "inspector";
        activateTab(which);
      });
    }
  }

  function activateTab(which) {
    var showFeedback = which === "feedback";
    var showInterview = which === "interview";
    var showProfile = which === "profile";
    el.feedbackTab.setAttribute("aria-selected", String(showFeedback));
    el.inspectorTab.setAttribute("aria-selected", String(!showFeedback && !showInterview && !showProfile));
    el.interviewTab.setAttribute("aria-selected", String(showInterview));
    el.profileTab.setAttribute("aria-selected", String(showProfile));
    el.feedbackTab.setAttribute("tabindex", showFeedback ? "0" : "-1");
    el.inspectorTab.setAttribute("tabindex", showFeedback || showInterview || showProfile ? "-1" : "0");
    el.interviewTab.setAttribute("tabindex", showInterview ? "0" : "-1");
    el.profileTab.setAttribute("tabindex", showProfile ? "0" : "-1");
    el.feedbackPanel.hidden = !showFeedback;
    el.inspectorPanel.hidden = showFeedback || showInterview || showProfile;
    el.interviewPanel.hidden = !showInterview;
    el.profilePanel.hidden = !showProfile;
    if (showFeedback) el.feedbackText.focus();
    if (showInterview) {
      var target = el.interviewBody.querySelector(".interview-question, .interview-option, .summary-title");
      if (target) target.focus();
    }
    if (showProfile) {
      renderProfilePanel();
    }
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
    wireInterview();
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
    wireFrameSwitcher();
    wireUndoKey();
    wireSendButton();
    wireTray();
    wireCopyPrompt();
    wireAnnotate();
    wireLintChip();

    try {
      await loadScene();
      renderInspector();
      await loadLint();
      await loadPatches();
      await loadAnnotations();
      await loadInterview();
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
