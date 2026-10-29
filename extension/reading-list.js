(async function () {
  chrome.storage.local.get("selectedTheme", function (result) {
    if (result.selectedTheme && typeof applyThemeById === 'function')
      applyThemeById(result.selectedTheme);
  });

  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const searchEl = document.getElementById('search');
  const addUrlEl = document.getElementById('add-url');
  const addBtn = document.getElementById('add-btn');
  const backPlannerBtn = document.getElementById('back-planner');

  let articles = [];
  let folder = 'active';

  const folderActiveBtn = document.getElementById('folder-active');
  const folderArchiveBtn = document.getElementById('folder-archive');

  function isArchived(a) { return a && a.status === 'archived'; }

  function counts() {
    var active = 0, archived = 0;
    articles.forEach(function (a) { if (isArchived(a)) archived++; else active++; });
    return { active: active, archived: archived };
  }

  function updateFolderButtons() {
    var c = counts();
    if (folderActiveBtn) {
      folderActiveBtn.textContent = 'Active (' + c.active + ')';
      folderActiveBtn.classList.toggle('active', folder === 'active');
    }
    if (folderArchiveBtn) {
      folderArchiveBtn.textContent = 'Archive (' + c.archived + ')';
      folderArchiveBtn.classList.toggle('active', folder === 'archive');
    }
    emptyEl.textContent = folder === 'archive' ? 'Archive is empty' : 'No saved articles';
  }

  async function load() {
    const res = await chrome.storage.local.get({ savedArticles: [] });
    articles = Array.isArray(res.savedArticles) ? res.savedArticles : [];
    render();
  }

  async function save() {
    await chrome.storage.local.set({ savedArticles: articles });
  }

  function render() {
    updateFolderButtons();
    const q = (searchEl.value || '').toLowerCase().trim();
    const filtered = articles.filter(function (a) {
      var inFolder = folder === 'archive' ? isArchived(a) : !isArchived(a);
      if (!inFolder) return false;
      return (!q || (a.title && a.title.toLowerCase().includes(q)) || (a.url && a.url.toLowerCase().includes(q)));
    });
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    filtered.forEach(function (a, i) {
      const item = document.createElement('div');
      item.className = 'item aero-strip';
      const main = document.createElement('div');
      main.className = 'item-main';
      const titleText = (a.title || '').trim();
      const urlText = (a.url || '').trim();
      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = titleText || urlText || 'Untitled';
      main.appendChild(title);
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const openBtn = document.createElement('button');
      openBtn.className = 'btn aero-btn glass';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', function () {
        if (a.url) chrome.tabs.create({ url: a.url });
      });
      const moveBtn = document.createElement('button');
      moveBtn.className = 'btn aero-btn glass';
      moveBtn.textContent = folder === 'archive' ? 'Restore' : 'Archive';
      moveBtn.addEventListener('click', async function () {
        a.status = folder === 'archive' ? 'active' : 'archived';
        await save();
        await load();
      });
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-icon-danger';
      removeBtn.setAttribute('aria-label', 'Remove');
      removeBtn.title = 'Remove';
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      removeBtn.addEventListener('click', async function () {
        var idx = articles.indexOf(a);
        if (idx > -1) {
          articles.splice(idx, 1);
        } else {
          articles = articles.filter(function (x) { return x.url !== a.url; });
        }
        await save();
        await load();
      });
      actions.appendChild(openBtn);
      actions.appendChild(moveBtn);
      actions.appendChild(removeBtn);
      item.appendChild(main);
      item.appendChild(actions);
      listEl.appendChild(item);
    });
  }

  searchEl.addEventListener('input', render);

  addBtn.addEventListener('click', async function () {
    var u = (addUrlEl.value || '').trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    if (articles.find(function (a) { return a.url === u; })) {
      addUrlEl.value = '';
      return;
    }
    articles.unshift({ title: u, url: u, addedAt: Date.now(), status: 'active' });
    addUrlEl.value = '';
    await save();
    await load();
  });

  if (folderActiveBtn) folderActiveBtn.addEventListener('click', function () {
    folder = 'active';
    render();
  });
  if (folderArchiveBtn) folderArchiveBtn.addEventListener('click', function () {
    folder = 'archive';
    render();
  });

  const exportCsvBtn = document.getElementById('export-csv');
  const importCsvInput = document.getElementById('import-csv');

  function escCsv(str) {
    return String(str == null ? '' : str).replace(/"/g, '""');
  }

  function splitCsvLine(line) {
    var out = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQ = false; }
        } else { cur += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',' || c === ';') { out.push(cur); cur = ''; }
      else { cur += c; }
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }

  function parseActiveFlag(raw) {
    var v = String(raw == null ? '' : raw).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'active'].indexOf(v) > -1) return 'active';
    if (['false', '0', 'no', 'n', 'archived', 'archive'].indexOf(v) > -1) return 'archived';
    return 'active';
  }

  function looksLikeHeader(cells) {
    if (!cells || cells.length === 0) return false;
    var first = String(cells[0] || '').trim().toLowerCase();
    return first === 'url' || first === 'link' || first === 'href';
  }

  if (exportCsvBtn) exportCsvBtn.addEventListener('click', function () {
    var lines = ['url,active'];
    articles.forEach(function (a) {
      var active = !(a && a.status === 'archived');
      lines.push('"' + escCsv(a.url || '') + '",' + (active ? 'true' : 'false'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reading-list.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  if (importCsvInput) importCsvInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function (ev) {
      var text = String(ev.target.result || '').replace(/^\ufeff/, '');
      var rows = text.split(/\r?\n/);
      var start = 0;
      if (rows.length > 0 && looksLikeHeader(splitCsvLine(rows[0]))) start = 1;
      var added = 0;
      for (var i = start; i < rows.length; i++) {
        if (!rows[i] || !rows[i].trim()) continue;
        var cells = splitCsvLine(rows[i]);
        var u = (cells[0] || '').trim();
        if (!u) continue;
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        if (!/^https?:\/\/[^\/\s]+\.[^\/\s]+/i.test(u)) continue;
        if (articles.find(function (a) { return a && a.url === u; })) continue;
        var status = cells.length > 1 ? parseActiveFlag(cells[1]) : 'active';
        articles.unshift({ title: u, url: u, addedAt: Date.now(), status: status });
        added++;
      }
      importCsvInput.value = '';
      if (added > 0) { await save(); }
      await load();
    };
    reader.readAsText(file);
  });

  if (backPlannerBtn) backPlannerBtn.addEventListener('click', function () {
    location.href = chrome.runtime.getURL('planner.html');
  });

  const addManual = document.getElementById('add-url');
  if (addManual) {
    addManual.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addBtn.click();
    });
  }

  await load();
})();
