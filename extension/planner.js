(async function () {
  chrome.storage.local.get("selectedTheme", function (result) {
    if (result.selectedTheme && typeof applyThemeById === 'function')
      applyThemeById(result.selectedTheme);
  });

  // ==================== Panel resize (divider) ====================

  const appEl = document.getElementById('app');
  const timelinePanel = document.getElementById('timeline-panel');
  const timelineScroll = document.getElementById('timeline-scroll');
  const cardDeck = document.getElementById('card-deck');
  const divider = document.getElementById('divider');
  const WIDTH_KEY = 'plannerTimelineWidth';
  const MIN_W = 180;
  const MAX_W = 700;

  function setTimelineWidth(px) {
    timelinePanel.style.flex = '0 0 ' + px + 'px';
  }

  chrome.storage.local.get(WIDTH_KEY, function (result) {
    if (result[WIDTH_KEY]) setTimelineWidth(result[WIDTH_KEY]);
  });

  divider.addEventListener('pointerdown', function (e) {
    divider.setPointerCapture(e.pointerId);
    divider.classList.add('active');
    const startX = e.clientX;
    const startWLayout = timelinePanel.getBoundingClientRect().width / zoom;

    function onMove(ev) {
      const w = Math.min(MAX_W, Math.max(MIN_W, startWLayout + (ev.clientX - startX) / zoom));
      setTimelineWidth(w);
    }

    function onUp() {
      divider.classList.remove('active');
      divider.removeEventListener('pointermove', onMove);
      divider.removeEventListener('pointerup', onUp);
      chrome.storage.local.set({ [WIDTH_KEY]: Math.round(timelinePanel.getBoundingClientRect().width / zoom) });
    }

    divider.addEventListener('pointermove', onMove);
    divider.addEventListener('pointerup', onUp);
  });

  // ==================== UI zoom ====================

  const ZOOM_KEY = 'plannerZoom';
  const MIN_Z = 0.5;
  const MAX_Z = 2;
  let zoom = 1;

  function saveZoom() {
    chrome.storage.local.set({ [ZOOM_KEY]: zoom });
  }

  function reanchorScrolls() {
    const containers = [timelineScroll, cardDeck];
    const snap = containers.map(function (el) {
      return {
        el: el,
        ratio: el.scrollHeight > 0 ? (el.scrollTop + el.clientHeight / 2) / el.scrollHeight : 0
      };
    });
    snap.forEach(function (s) {
      s.el.scrollTop = s.ratio * s.el.scrollHeight - s.el.clientHeight / 2;
    });
  }

  function applyZoom(z) {
    z = Math.min(MAX_Z, Math.max(MIN_Z, z));
    if (z === zoom) return;
    zoom = z;
    appEl.style.zoom = zoom;
    appEl.style.width = 'calc(100vw / ' + zoom + ')';
    appEl.style.height = 'calc(100vh / ' + zoom + ')';
    reanchorScrolls();
    saveZoom();
  }

  function zoomBy(factor) {
    applyZoom(zoom * factor);
  }

  chrome.storage.local.get(ZOOM_KEY, function (result) {
    if (result[ZOOM_KEY]) applyZoom(result[ZOOM_KEY]);
  });

  document.addEventListener('keydown', function (e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!(e.ctrlKey || e.metaKey)) return;

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(1.1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomBy(1 / 1.1);
    } else if (e.key === '0') {
      e.preventDefault();
      applyZoom(1);
    }
  }, true);

  document.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomBy(Math.pow(1.0015, -e.deltaY));
  }, { passive: false });

  // ==================== State / storage ====================

  const CARD_COLORS = ['#ef5350', '#ff9800', '#ffca28', '#66bb6a', '#4db6ac', '#42a5f5', '#ab47bc', '#ec407a'];

  let cards = [];
  let slots = [];

  function saveCards() {
    chrome.storage.local.set({ plannerCards: cards });
  }

  async function loadState() {
    const result = await chrome.storage.local.get(['plannerCards', 'plannerSlots', RANGE_KEY]);
    cards = result.plannerCards || [];
    slots = result.plannerSlots || [];
    const r = result[RANGE_KEY];
    if (r && typeof r.startHour === 'number' && typeof r.endHour === 'number' && r.startHour >= 0 && r.startHour <= 23 && r.endHour > r.startHour && r.endHour <= 24) {
      rangeStartH = r.startHour;
      rangeEndH = r.endHour;
    }
    rangeFromInput.value = rangeStartH;
    rangeToInput.value = rangeEndH;
    renderCards();
    renderTimeline();
  }

  // ==================== Theme cards ====================

  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = card.id;

    const header = document.createElement('div');
    header.className = 'card-header';

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = card.color;
    dot.title = 'Click to change color';
    header.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = card.name;
    name.title = 'Click to rename';
    header.appendChild(name);

    const del = document.createElement('button');
    del.className = 'card-delete';
    del.textContent = '\u00d7';
    del.title = 'Delete theme';
    header.appendChild(del);

    el.appendChild(header);

    const body = document.createElement('div');
    body.className = 'card-body';

    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    (card.tasks || []).forEach(function (task) {
      taskList.appendChild(createTaskElement(task));
    });
    body.appendChild(taskList);

    const addRow = document.createElement('div');
    addRow.className = 'add-task-row';

    const addInput = document.createElement('input');
    addInput.className = 'add-task-input';
    addInput.type = 'text';
    addInput.placeholder = 'Add task…';

    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add task';

    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    el.appendChild(body);

    return el;
  }

  const DECK_GAP = 12;
  const DECK_COLS = 4;

  function renderCards() {
    cardDeck.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'card-deck-inner';
    cards.forEach(function (card) {
      inner.appendChild(createCardElement(card));
    });

    const addCard = document.createElement('button');
    addCard.className = 'add-card';
    addCard.title = 'Add theme card';
    addCard.textContent = '+';
    inner.appendChild(addCard);

    cardDeck.appendChild(inner);
    layoutDeck();
  }

  function layoutDeck() {
    const inner = cardDeck.querySelector('.card-deck-inner');
    const items = inner ? Array.prototype.slice.call(inner.children) : [];
    if (!items.length) return;

    const pad = 14;
    const colW = Math.floor((cardDeck.clientWidth - pad * 2 - DECK_GAP * (DECK_COLS - 1)) / DECK_COLS);

    const meas = document.createElement('div');
    meas.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;width:' + colW + 'px;';
    document.body.appendChild(meas);
    const heights = items.map(function (el) {
      const clone = el.cloneNode(true);
      meas.appendChild(clone);
      return clone.offsetHeight;
    });

    const colTops = new Array(DECK_COLS).fill(0);
    items.forEach(function (el, i) {
      const c = colTops.indexOf(Math.min.apply(null, colTops));
      el.style.cssText = 'position:absolute;width:' + colW + 'px;left:' + (pad + c * (colW + DECK_GAP)) + 'px;top:' + colTops[c] + 'px;';
      colTops[c] += heights[i] + DECK_GAP;
    });
    document.body.removeChild(meas);

    inner.style.height = (Math.max.apply(null, colTops) - DECK_GAP) + 'px';
  }

  function nextColor(current) {
    const i = CARD_COLORS.indexOf(current);
    return CARD_COLORS[(i + 1) % CARD_COLORS.length];
  }

  function addNewCard() {
    const card = {
      id: crypto.randomUUID(),
      name: 'New Theme',
      color: CARD_COLORS[cards.length % CARD_COLORS.length],
      tasks: []
    };
    cards.push(card);
    saveCards();
    renderCards();

    const cardEl = cardDeck.querySelector('.card[data-id="' + card.id + '"]');
    if (cardEl) {
      cardEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      beginRename(cardEl, card);
    }
  }

  function beginRename(cardEl, card) {
    const nameEl = cardEl.querySelector('.card-name');
    const input = document.createElement('input');
    input.className = 'card-name-input';
    input.type = 'text';
    input.value = card.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function commit(save) {
      if (done) return;
      done = true;
      const val = input.value.trim();
      if (save && val) card.name = val;
      input.replaceWith(nameEl);
      nameEl.textContent = card.name;
      if (save) saveCards();
    }

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') commit(true);
      else if (ev.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', function () { commit(true); });
  }

  function createTaskElement(task) {
    const row = document.createElement('div');
    row.className = 'task' + (task.done ? ' done' : '');
    row.dataset.id = task.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-check';
    cb.checked = task.done;
    row.appendChild(cb);

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;
    row.appendChild(text);

    const del = document.createElement('button');
    del.className = 'task-delete';
    del.textContent = '×';
    del.title = 'Delete task';
    row.appendChild(del);

    return row;
  }

  function addTask(card, input) {
    const text = input.value.trim();
    if (!text) return;
    card.tasks = card.tasks || [];
    card.tasks.push({ id: crypto.randomUUID(), text: text, done: false });
    saveCards();
    renderCards();
    const el = cardDeck.querySelector('.card[data-id="' + card.id + '"] .add-task-input');
    if (el) el.focus();
  }

  function beginTaskEdit(cardEl, taskRow, task) {
    const textEl = taskRow.querySelector('.task-text');
    const input = document.createElement('input');
    input.className = 'task-edit-input';
    input.type = 'text';
    input.value = task.text;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function commit(save) {
      if (done) return;
      done = true;
      const val = input.value.trim();
      if (save && val) task.text = val;
      input.replaceWith(textEl);
      textEl.textContent = task.text;
      if (save) saveCards();
    }

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') commit(true);
      else if (ev.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', function () { commit(true); });
  }

  cardDeck.addEventListener('click', function (e) {
    if (Date.now() < suppressClickUntil) return;
    if (e.target.closest('.add-card')) {
      addNewCard();
      return;
    }

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    const id = cardEl.dataset.id;
    const card = cards.find(function (c) { return c.id === id; });
    if (!card) return;

    if (e.target.classList.contains('color-dot')) {
      card.color = nextColor(card.color);
      e.target.style.background = card.color;
      saveCards();
      return;
    }

    if (e.target.classList.contains('card-delete')) {
      cards = cards.filter(function (c) { return c.id !== id; });
      saveCards();
      renderCards();
      return;
    }

    if (e.target.classList.contains('card-name')) {
      beginRename(cardEl, card);
      return;
    }

    if (e.target.classList.contains('task-delete')) {
      const taskRow = e.target.closest('.task');
      if (!taskRow) return;
      card.tasks = card.tasks || [];
      card.tasks = card.tasks.filter(function (t) { return t.id !== taskRow.dataset.id; });
      saveCards();
      renderCards();
      return;
    }

    if (e.target.classList.contains('task-text')) {
      const taskRow = e.target.closest('.task');
      if (!taskRow) return;
      const task = (card.tasks || []).find(function (t) { return t.id === taskRow.dataset.id; });
      if (task) beginTaskEdit(cardEl, taskRow, task);
      return;
    }

    if (e.target.classList.contains('add-task-btn')) {
      const input = cardEl.querySelector('.add-task-input');
      if (input) addTask(card, input);
      return;
    }
  });

  cardDeck.addEventListener('change', function (e) {
    if (!e.target.classList.contains('task-check')) return;
    const cardEl = e.target.closest('.card');
    const taskRow = e.target.closest('.task');
    if (!cardEl || !taskRow) return;
    const card = cards.find(function (c) { return c.id === cardEl.dataset.id; });
    const task = card ? (card.tasks || []).find(function (t) { return t.id === taskRow.dataset.id; }) : null;
    if (!task) return;
    task.done = e.target.checked;
    saveCards();
    taskRow.classList.toggle('done', task.done);
  });

  cardDeck.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const input = e.target;
    if (!input.classList.contains('add-task-input')) return;
    const cardEl = input.closest('.card');
    if (!cardEl) return;
    const card = cards.find(function (c) { return c.id === cardEl.dataset.id; });
    if (card) addTask(card, input);
  });



  // ==================== Timeline slots ====================

  const SNAP_MIN = 15;
  const DAY_MINUTES = 1440;
  const SLOT_MIN_DURATION = 15;
  const SLOT_CLICK_DURATION = 30;
  const RANGE_KEY = 'plannerTimelineRange';

  const timelineEl = document.getElementById('timeline');
  const slotLayer = document.getElementById('slot-layer');
  const hourAxis = document.getElementById('hour-axis');
  const rangeFromInput = document.getElementById('timeline-from');
  const rangeToInput = document.getElementById('timeline-to');
  const clearSlotsBtn = document.getElementById('clear-slots-btn');
  let selectedSlotId = null;
  let slotDraw = null;
  let slotMove = null;
  let slotResize = null;
  let rangeStartH = 0;
  let rangeEndH = 24;

  const nowLine = document.createElement('div');
  nowLine.className = 'now-line';
  timelineEl.appendChild(nowLine);

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function snapMinute(m) {
    return Math.round(m / SNAP_MIN) * SNAP_MIN;
  }

  function saveSlots() {
    chrome.storage.local.set({ plannerSlots: slots });
  }

  function todaySlots() {
    const t = todayStr();
    return slots.filter(function (s) { return s.date === t; });
  }

  function rangeStartMin() {
    return rangeStartH * 60;
  }

  function rangeEndMin() {
    return rangeEndH * 60;
  }

  function timelineScale() {
    const day = rangeEndMin() - rangeStartMin();
    return day > 0 ? timelineEl.clientHeight / day : 0;
  }

  function nowMinute() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function updateNowLine() {
    const m = nowMinute();
    if (m >= rangeStartMin() && m < rangeEndMin()) {
      nowLine.style.display = 'block';
      nowLine.style.top = ((m - rangeStartMin()) * timelineScale()) + 'px';
    } else {
      nowLine.style.display = 'none';
    }
  }

  function scheduleNowLine() {
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
    setTimeout(function () {
      updateNowLine();
      setInterval(updateNowLine, 60000);
    }, msToNextMinute);
  }

  function renderTimeline() {
    const scale = timelineScale();

    hourAxis.innerHTML = '';
    for (let h = rangeStartH; h <= rangeEndH; h++) {
      const y = (h - rangeStartH) * 60 * scale;
      const line = document.createElement('div');
      line.className = 'hour-line';
      line.style.top = y + 'px';
      hourAxis.appendChild(line);

      if (h < rangeEndH) {
        const label = document.createElement('div');
        label.className = 'hour-label';
        label.style.top = y + 'px';
        label.textContent = h + ':00';
        hourAxis.appendChild(label);
      }
    }

    slotLayer.innerHTML = '';
    todaySlots().forEach(function (slot) {
      if (slot.endMinute <= rangeStartMin() || slot.startMinute >= rangeEndMin()) return;
      slotLayer.appendChild(createSlotElement(slot, scale));
    });
    renderOverlapLayer(scale);
    clearSlotsBtn.disabled = todaySlots().length === 0;
    updateNowLine();
  }

  function renderOverlapLayer(scale) {
    const sorted = todaySlots().filter(function (slot) {
      return slot.endMinute > rangeStartMin() && slot.startMinute < rangeEndMin();
    }).sort(function (a, b) {
      return a.startMinute - b.startMinute || a.endMinute - b.endMinute;
    });

    const intervals = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const st = Math.max(sorted[i].startMinute, sorted[j].startMinute);
        const en = Math.min(sorted[i].endMinute, sorted[j].endMinute);
        if (en > st) intervals.push([st, en]);
      }
    }
    intervals.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });

    const merged = [];
    intervals.forEach(function (iv) {
      if (merged.length && iv[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
      } else {
        merged.push([iv[0], iv[1]]);
      }
    });

    merged.forEach(function (iv) {
      const el = document.createElement('div');
      el.className = 'slot-overlap';
      el.style.top = ((iv[0] - rangeStartMin()) * scale) + 'px';
      el.style.height = Math.max(1, (iv[1] - iv[0]) * scale) + 'px';
      slotLayer.appendChild(el);
    });
  }

  function createSlotElement(slot, scale) {
    const el = document.createElement('div');
    el.className = 'slot' + (slot.id === selectedSlotId ? ' selected' : '');
    el.dataset.id = slot.id;
    el.style.top = ((slot.startMinute - rangeStartMin()) * scale) + 'px';
    el.style.height = ((slot.endMinute - slot.startMinute) * scale) + 'px';
    el.title = slot.label || (slot.startMinute / 60).toFixed(1) + 'h';

    const label = document.createElement('span');
    label.className = 'slot-label';
    label.textContent = slot.label || '';
    el.appendChild(label);

    const topHandle = document.createElement('div');
    topHandle.className = 'slot-resize-handle slot-resize-top';
    el.appendChild(topHandle);

    const bottomHandle = document.createElement('div');
    bottomHandle.className = 'slot-resize-handle slot-resize-bottom';
    el.appendChild(bottomHandle);

    return el;
  }

  function selectSlot(id) {
    selectedSlotId = id;
    slotLayer.querySelectorAll('.slot').forEach(function (el) {
      el.classList.toggle('selected', el.dataset.id === selectedSlotId);
    });
  }

  function timelineYAt(clientY) {
    const rect = timelineEl.getBoundingClientRect();
    const scale = timelineScale();
    return scale > 0 ? rangeStartMin() + (clientY - rect.top) / zoom / scale : rangeStartMin();
  }

  function timelineY(e) {
    return timelineYAt(e.clientY);
  }

  timelineEl.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (e.target.closest('.slot-name-input')) return;
    const handle = e.target.closest('.slot-resize-handle');
    if (handle) {
      startSlotResize(e, handle);
      return;
    }
    const slotEl = e.target.closest('.slot');
    if (slotEl) {
      selectSlot(slotEl.dataset.id);
      startSlotMove(e, slotEl);
      return;
    }
    const y = Math.max(rangeStartMin(), Math.min(rangeEndMin(), snapMinute(timelineY(e))));
    const scale = timelineScale();
    const preview = document.createElement('div');
    preview.className = 'slot-preview';
    preview.style.top = ((y - rangeStartMin()) * scale) + 'px';
    preview.style.height = (SLOT_CLICK_DURATION * scale) + 'px';
    slotLayer.appendChild(preview);
    slotDraw = { start: y, preview: preview };
  });

  window.addEventListener('pointermove', function (e) {
    if (slotDraw) updateSlotDraw(e);
    else if (slotMove) updateSlotMove(e);
    else if (slotResize) updateSlotResize(e);
  });

  window.addEventListener('pointerup', function () {
    if (slotDraw) commitSlotDraw();
    else if (slotMove) commitSlotMove();
    else if (slotResize) commitSlotResize();
  });

  window.addEventListener('pointercancel', function () {
    if (slotDraw) {
      if (slotDraw.preview && slotDraw.preview.parentNode) slotDraw.preview.parentNode.removeChild(slotDraw.preview);
      slotDraw = null;
    }
    slotMove = null;
    slotResize = null;
  });

  function updateSlotDraw(e) {
    const y = Math.max(rangeStartMin(), Math.min(rangeEndMin(), snapMinute(timelineY(e))));
    const a = Math.min(slotDraw.start, y);
    const b = Math.max(slotDraw.start, y);
    slotDraw.a = a;
    slotDraw.b = b;
    const scale = timelineScale();
    slotDraw.preview.style.top = ((a - rangeStartMin()) * scale) + 'px';
    slotDraw.preview.style.height = Math.max(1, (b - a) * scale) + 'px';
  }

  function commitSlotDraw() {
    const p = slotDraw;
    slotDraw = null;
    if (p.preview.parentNode) p.preview.parentNode.removeChild(p.preview);

    let start;
    let end;
    if (p.b === undefined || p.b - p.a < SLOT_MIN_DURATION) {
      start = p.start;
      end = p.start + SLOT_CLICK_DURATION;
    } else {
      start = p.a;
      end = p.b;
    }
    start = Math.max(rangeStartMin(), Math.min(rangeEndMin() - SLOT_MIN_DURATION, start));
    end = Math.min(rangeEndMin(), end);
    if (end - start >= SLOT_MIN_DURATION) {
      const slot = { id: crypto.randomUUID(), date: todayStr(), startMinute: start, endMinute: end, label: '' };
      selectedSlotId = slot.id;
      slots.push(slot);
      saveSlots();
      renderTimeline();
      const el = slotLayer.querySelector('.slot[data-id="' + slot.id + '"]');
      if (el) beginSlotRename(slot, el);
    }
  }

  function startSlotMove(e, slotEl) {
    const slot = slots.find(function (s) { return s.id === slotEl.dataset.id; });
    if (!slot) return;
    slotMove = {
      id: slot.id,
      startY: e.clientY,
      origStart: slot.startMinute,
      origEnd: slot.endMinute,
      deltaMin: 0,
      moved: false
    };
  }

  function updateSlotMove(e) {
    const deltaMin = Math.round((e.clientY - slotMove.startY) / zoom / timelineScale() / SNAP_MIN) * SNAP_MIN;
    slotMove.deltaMin = deltaMin;
    const dur = slotMove.origEnd - slotMove.origStart;
    const ns = Math.max(0, Math.min(DAY_MINUTES - dur, slotMove.origStart + deltaMin));
    if (ns === slotMove.origStart && !slotMove.moved) return;
    if (ns !== slotMove.origStart) slotMove.moved = true;
    const el = slotLayer.querySelector('.slot[data-id="' + slotMove.id + '"]');
    if (el) {
      el.style.top = ((ns - rangeStartMin()) * timelineScale()) + 'px';
      el.classList.add('dragging');
    }
  }

  function commitSlotMove() {
    if (slotMove && slotMove.moved) {
      const slot = slots.find(function (s) { return s.id === slotMove.id; });
      if (slot) {
        const dur = slotMove.origEnd - slotMove.origStart;
        const ns = Math.max(0, Math.min(DAY_MINUTES - dur, slotMove.origStart + slotMove.deltaMin));
        slot.startMinute = ns;
        slot.endMinute = ns + dur;
        saveSlots();
        renderTimeline();
      }
    }
    slotMove = null;
  }

  function startSlotResize(e, handle) {
    const slotEl = handle.closest('.slot');
    const slot = slotEl ? slots.find(function (s) { return s.id === slotEl.dataset.id; }) : null;
    if (!slot) return;
    slotResize = {
      id: slot.id,
      edge: handle.classList.contains('slot-resize-top') ? 'top' : 'bottom',
      startY: e.clientY,
      origStart: slot.startMinute,
      origEnd: slot.endMinute,
      deltaMin: 0,
      moved: false
    };
  }

  function updateSlotResize(e) {
    const deltaMin = Math.round((e.clientY - slotResize.startY) / zoom / timelineScale() / SNAP_MIN) * SNAP_MIN;
    slotResize.deltaMin = deltaMin;
    const slot = slots.find(function (s) { return s.id === slotResize.id; });
    const el = slotLayer.querySelector('.slot[data-id="' + slotResize.id + '"]');
    if (!slot || !el) return;
    let ns = slotResize.origStart;
    let ne = slotResize.origEnd;
    if (slotResize.edge === 'top') {
      ns = Math.max(0, Math.min(slotResize.origEnd - SLOT_MIN_DURATION, slotResize.origStart + deltaMin));
    } else {
      ne = Math.min(DAY_MINUTES, Math.max(slotResize.origStart + SLOT_MIN_DURATION, slotResize.origEnd + deltaMin));
    }
    if (ns !== slotResize.origStart || ne !== slotResize.origEnd) slotResize.moved = true;
    const scale = timelineScale();
    el.style.top = ((ns - rangeStartMin()) * scale) + 'px';
    el.style.height = ((ne - ns) * scale) + 'px';
  }

  function commitSlotResize() {
    if (slotResize && slotResize.moved) {
      const slot = slots.find(function (s) { return s.id === slotResize.id; });
      if (slot) {
        if (slotResize.edge === 'top') {
          slot.startMinute = Math.max(0, Math.min(slot.endMinute - SLOT_MIN_DURATION, slotResize.origStart + slotResize.deltaMin));
        } else {
          slot.endMinute = Math.min(DAY_MINUTES, Math.max(slot.startMinute + SLOT_MIN_DURATION, slotResize.origEnd + slotResize.deltaMin));
        }
        saveSlots();
        renderTimeline();
      }
    }
    slotResize = null;
  }

  function beginSlotRename(slot, el) {
    const labelEl = el.querySelector('.slot-label');
    if (!labelEl) return;
    const input = document.createElement('input');
    input.className = 'slot-name-input';
    input.type = 'text';
    input.maxLength = 60;
    input.value = slot.label || '';
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function commit(save) {
      if (done) return;
      done = true;
      if (save) {
        slot.label = input.value.trim();
        saveSlots();
      }
      input.replaceWith(labelEl);
      labelEl.textContent = slot.label || '';
    }

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.stopPropagation();
        commit(true);
      } else if (ev.key === 'Escape') {
        ev.stopPropagation();
        commit(false);
      }
    });
    input.addEventListener('blur', function () { commit(true); });
  }

  slotLayer.addEventListener('dblclick', function (e) {
    if (e.target.closest('.slot-resize-handle')) return;
    if (e.target.closest('.slot-name-input')) return;
    const slotEl = e.target.closest('.slot');
    if (!slotEl) return;
    const slot = slots.find(function (s) { return s.id === slotEl.dataset.id; });
    if (slot) beginSlotRename(slot, slotEl);
  });

  document.addEventListener('keydown', function (e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const isDelete = e.key === 'Delete' || e.key === 'Backspace';
    if (e.key !== 'Escape' && !isDelete) return;
    if (isDelete) e.preventDefault();
    if (!selectedSlotId) return;
    slots = slots.filter(function (s) { return s.id !== selectedSlotId; });
    selectedSlotId = null;
    saveSlots();
    renderTimeline();
  });

  rangeFromInput.addEventListener('change', function () { applyRange(); });
  rangeToInput.addEventListener('change', function () { applyRange(); });

  function applyRange() {
    let s = parseInt(rangeFromInput.value, 10);
    let e = parseInt(rangeToInput.value, 10);
    if (isNaN(s)) s = rangeStartH;
    if (isNaN(e)) e = rangeEndH;
    s = Math.max(0, Math.min(23, s));
    e = Math.max(1, Math.min(24, e));
    if (s >= e) {
      rangeFromInput.value = rangeStartH;
      rangeToInput.value = rangeEndH;
      return;
    }
    rangeStartH = s;
    rangeEndH = e;
    chrome.storage.local.set({ [RANGE_KEY]: { startHour: s, endHour: e } });
    renderTimeline();
  }

  const rangeControl = document.querySelector('.range-control');
  rangeControl.addEventListener('click', function (e) {
    const btn = e.target.closest('.stepper-btn');
    if (!btn) return;
    const input = btn.closest('.stepper').querySelector('input');
    const dir = parseInt(btn.dataset.dir, 10);
    const min = parseInt(input.getAttribute('min'), 10) || 0;
    const max = parseInt(input.getAttribute('max'), 10) || 24;
    let v = parseInt(input.value, 10);
    if (isNaN(v)) v = min;
    v = Math.max(min, Math.min(max, v + dir));
    input.value = v;
    input.dispatchEvent(new Event('change'));
  });

  clearSlotsBtn.addEventListener('click', function () {
    const t = todayStr();
    const removedIds = slots.filter(function (s) { return s.date === t; }).map(function (s) { return s.id; });
    slots = slots.filter(function (s) { return s.date !== t; });
    if (removedIds.indexOf(selectedSlotId) !== -1) selectedSlotId = null;
    saveSlots();
    renderTimeline();
  });

  // ==================== Card reorder (drag & drop) ====================

  const DRAG_THRESHOLD = 5;
  let dragState = null;
  let ghostEl = null;
  let suppressClickUntil = 0;

  cardDeck.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    const header = e.target.closest('.card-header');
    if (!header) return;
    const cardEl = header.closest('.card');
    if (!cardEl) return;
    const card = cards.find(function (c) { return c.id === cardEl.dataset.id; });
    dragState = {
      source: 'card',
      id: cardEl.dataset.id,
      label: card ? card.name : '',
      startX: e.clientX,
      startY: e.clientY,
      grabY: e.clientY - cardEl.getBoundingClientRect().top,
      dragging: false
    };
  });

  cardDeck.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (e.target.closest('.task-check') || e.target.closest('.task-delete')) return;
    if (e.target.closest('.task-edit-input')) return;
    const taskRow = e.target.closest('.task');
    if (!taskRow) return;
    const cardEl = taskRow.closest('.card');
    if (!cardEl) return;
    const card = cards.find(function (c) { return c.id === cardEl.dataset.id; });
    if (!card) return;
    const task = (card.tasks || []).find(function (t) { return t.id === taskRow.dataset.id; });
    if (!task) return;
    dragState = {
      source: 'task',
      id: taskRow.dataset.id,
      cardId: card.id,
      taskId: task.id,
      label: task.text,
      startX: e.clientX,
      startY: e.clientY,
      grabY: e.clientY - taskRow.getBoundingClientRect().top,
      dragging: false
    };
  });

  window.addEventListener('pointermove', function (e) {
    if (!dragState) return;
    if (!dragState.dragging) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      beginDrag(e);
    } else {
      moveDrag(e);
    }
  });

  window.addEventListener('pointerup', function () {
    if (!dragState) return;
    if (dragState.dragging) endDrag();
    dragState = null;
  });

  window.addEventListener('pointercancel', function () {
    if (!dragState) return;
    if (dragState.dragging) cleanupDrag();
    dragState = null;
  });

  function beginDrag(e) {
    let originEl;
    if (dragState.source === 'task') {
      originEl = cardDeck.querySelector('.card[data-id="' + dragState.cardId + '"] .task[data-id="' + dragState.taskId + '"]');
    } else {
      originEl = cardDeck.querySelector('.card[data-id="' + dragState.id + '"]');
    }
    if (!originEl) { dragState = null; return; }
    dragState.dragging = true;
    dragState.originEl = originEl;
    e.preventDefault();

    ghostEl = originEl.cloneNode(true);
    ghostEl.classList.add('dragging-ghost');
    ghostEl.style.width = originEl.offsetWidth + 'px';
    document.body.appendChild(ghostEl);

    originEl.classList.add('dragging');
    document.body.classList.add('dragging');
    moveDrag(e);
  }

  function moveDrag(e) {
    if (!ghostEl) return;
    ghostEl.style.left = (e.clientX - 20) + 'px';
    ghostEl.style.top = (e.clientY - dragState.grabY) + 'px';
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;

    clearDropTarget();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.closest('#timeline')) {
      timelineEl.classList.add('drop-target');
      dragState.target = timelineEl;
      updateSlotPreview();
    } else {
      hideSlotPreview();
      dragState.target = null;
      const target = el ? el.closest('.card, .add-card') : null;
      if (target) {
        target.classList.add('drop-target');
        dragState.target = target;
      }
    }
  }

  function clearDropTarget() {
    if (dragState && dragState.target) dragState.target.classList.remove('drop-target');
  }

  function updateSlotPreview() {
    if (dragState.lastY === undefined) return;
    const start = Math.max(rangeStartMin(), Math.min(rangeEndMin() - SLOT_MIN_DURATION, snapMinute(timelineYAt(dragState.lastY))));
    const scale = timelineScale();
    if (!dragState.slotPreview) {
      const p = document.createElement('div');
      p.className = 'slot-preview';
      slotLayer.appendChild(p);
      dragState.slotPreview = p;
    }
    dragState.slotPreview.style.top = ((start - rangeStartMin()) * scale) + 'px';
    dragState.slotPreview.style.height = Math.max(1, SLOT_CLICK_DURATION * scale) + 'px';
  }

  function hideSlotPreview() {
    if (dragState.slotPreview && dragState.slotPreview.parentNode) {
      dragState.slotPreview.parentNode.removeChild(dragState.slotPreview);
    }
    dragState.slotPreview = null;
  }

  function commitTimelineDrop() {
    if (dragState.lastY === undefined) return;
    const start = Math.max(rangeStartMin(), Math.min(rangeEndMin() - SLOT_MIN_DURATION, snapMinute(timelineYAt(dragState.lastY))));
    const slot = {
      id: crypto.randomUUID(),
      date: todayStr(),
      startMinute: start,
      endMinute: start + SLOT_CLICK_DURATION,
      label: dragState.label || ''
    };
    selectedSlotId = slot.id;
    slots.push(slot);
    saveSlots();
    renderTimeline();
  }

  function endDrag() {
    if (dragState.target === timelineEl) {
      commitTimelineDrop();
    } else if (dragState.source === 'card') {
      const fromIndex = cards.findIndex(function (c) { return c.id === dragState.id; });
      if (fromIndex !== -1 && dragState.target) {
        const isAddCard = dragState.target.classList.contains('add-card');
        let toIndex = isAddCard ? cards.length : cards.findIndex(function (c) { return c.id === dragState.target.dataset.id; });
        if (toIndex !== -1) {
          const card = cards.splice(fromIndex, 1)[0];
          if (card) {
            if (toIndex > fromIndex) toIndex -= 1;
            cards.splice(toIndex, 0, card);
            saveCards();
            renderCards();
          }
        }
      }
    }
    cleanupDrag();
  }

  function cleanupDrag() {
    if (ghostEl && ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
    ghostEl = null;
    hideSlotPreview();
    clearDropTarget();
    if (dragState && dragState.originEl) dragState.originEl.classList.remove('dragging');
    document.body.classList.remove('dragging');
    suppressClickUntil = Date.now() + 300;
    dragState = null;
  }

  // ==================== Init ====================

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(function () { layoutDeck(); renderTimeline(); });
    ro.observe(cardDeck);
    ro.observe(timelineScroll);
  }
  loadState();
  scheduleNowLine();
})();
