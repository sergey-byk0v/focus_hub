(async function () {
  chrome.storage.local.get("selectedTheme", function (result) {
    if (result.selectedTheme && typeof applyThemeById === 'function')
      applyThemeById(result.selectedTheme);
  });
  const params = new URLSearchParams(location.search);
  const targetUrl = params.get('target');
  const tabId = parseInt(params.get('tabId'), 10);
  const mode = params.get('mode');

  const siteNameEl = document.getElementById('site-name');
  const proceedBtn = document.getElementById('proceed-btn');
  const exportBtn = document.getElementById('export-btn');

  const tagGrid = document.getElementById('tagGrid');
  const otherInputWrapper = document.getElementById('otherInputWrapper');
  const otherInput = document.getElementById('reason-input');

  const reasonUi = document.getElementById('reason-ui');
  const blockedUi = document.getElementById('blocked-ui');
  const blockedSiteName = document.getElementById('blocked-site-name');
  const closeBtn = document.getElementById('close-btn');

  var selectedTag = null;

  var siteDisplay = 'a site';
  if (targetUrl) {
    try {
      siteDisplay = new URL(targetUrl).hostname;
    } catch (_) {}
  }
  siteNameEl.textContent = siteDisplay;
  blockedSiteName.textContent = siteDisplay;

  // ===== Block mode =====
  if (mode === 'block') {
    reasonUi.style.display = 'none';
    blockedUi.style.display = 'block';

    closeBtn.addEventListener('click', () => {
      if (tabId) chrome.tabs.remove(tabId);
    });
    return;
  }

  // ===== Tag selection =====
  tagGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;

    tagGrid.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTag = btn.dataset.tag;

    if (selectedTag === 'Other') {
      otherInputWrapper.style.display = 'block';
      otherInput.focus();
    } else {
      otherInputWrapper.style.display = 'none';
      otherInput.value = '';
    }

    updateProceedBtn();
  });

  otherInput.addEventListener('input', updateProceedBtn);

  function updateProceedBtn() {
    if (!selectedTag) {
      proceedBtn.disabled = true;
      return;
    }
    if (selectedTag === 'Other' && !otherInput.value.trim()) {
      proceedBtn.disabled = true;
      return;
    }
    if (countdownDone) {
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed';
    }
  }

  // ===== Reason mode (default) =====
  const COUNTDOWN_SECONDS = 10;
  var countdown = COUNTDOWN_SECONDS;
  var countdownDone = false;

  function tick() {
    if (countdown > 0) {
      proceedBtn.disabled = true;
      proceedBtn.textContent = 'Proceed in ' + countdown + 's';
      countdown--;
      setTimeout(tick, 1000);
    } else {
      countdownDone = true;
      proceedBtn.textContent = 'Proceed';
      updateProceedBtn();
    }
  }

  tick();

  async function proceed() {
    if (!selectedTag) {
      alert('Please select a reason.');
      return;
    }

    var reason;
    var tag = selectedTag;
    var customText = '';

    if (selectedTag === 'Other') {
      customText = otherInput.value.trim();
      if (!customText) {
        alert('Please enter what you are doing.');
        return;
      }
      reason = 'Other: ' + customText;
    } else {
      reason = selectedTag;
    }

    if (!targetUrl || !tabId) {
      alert('No target URL specified.');
      return;
    }

    var { entries } = await chrome.storage.local.get({ entries: [] });
    entries.push({
      url: targetUrl,
      reason: reason,
      tag: tag,
      customText: customText,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });

    if (entries.length > 10000) {
      entries.splice(0, entries.length - 10000);
    }

    await chrome.storage.local.set({ entries });

    var { approved } = await chrome.storage.session.get({ approved: {} });
    approved[String(tabId)] = targetUrl;
    await chrome.storage.session.set({ approved });

    chrome.tabs.update(tabId, { url: targetUrl });
  }

  async function exportCsv() {
    var { entries } = await chrome.storage.local.get({ entries: [] });
    if (entries.length === 0) {
      alert('No entries to export.');
      return;
    }

    var headers = 'url,reason,tag,customText,timestamp,date';
    var rows = entries.map(function (e) {
      return '"' + escCsv(e.url) + '","' + escCsv(e.reason) + '","' + escCsv(e.tag || '') + '","' + escCsv(e.customText || '') + '","' + e.timestamp + '","' + e.date + '"';
    });
    var csv = [headers].concat(rows).join('\n');

    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-reasons.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function escCsv(str) {
    return String(str).replace(/"/g, '""');
  }


  // ===== Statistics =====
  const statsToggle = document.getElementById('statsToggle');
  const statsContent = document.getElementById('statsContent');
  const chartEl = document.getElementById('statsChart');
  const statsTotalEl = document.getElementById('statsTotal');
  const clearStatsBtn = document.getElementById('clearStatsBtn');

  statsToggle.addEventListener('click', function () {
    var isHidden = statsContent.style.display === 'none';
    statsContent.style.display = isHidden ? 'block' : 'none';
    statsToggle.textContent = isHidden ? 'Hide Statistics ▾' : 'Show Statistics ▸';
    if (isHidden) renderStats();
  });

  clearStatsBtn.addEventListener('click', function () {
    if (!confirm('Clear all logged entries?')) return;
    chrome.storage.local.set({ entries: [] }, function () {
      renderStats();
    });
  });

  function renderStats() {
    chrome.storage.local.get({ entries: [] }, function (result) {
      var entries = result.entries;
      var counts = {};
      entries.forEach(function (e) {
        var tag = e.tag || 'Other';
        counts[tag] = (counts[tag] || 0) + 1;
      });

      var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      var maxCount = 0;
      tags.forEach(function (t) { if (counts[t] > maxCount) maxCount = counts[t]; });

      statsTotalEl.textContent = entries.length + ' total';

      chartEl.innerHTML = '';
      tags.forEach(function (tag) {
        var count = counts[tag];
        var pct = maxCount > 0 ? (count / maxCount * 100) : 0;

        var row = document.createElement('div');
        row.className = 'stats-bar-row';

        var label = document.createElement('div');
        label.className = 'stats-bar-label';
        label.textContent = tag;
        row.appendChild(label);

        var track = document.createElement('div');
        track.className = 'stats-bar-track';

        var fill = document.createElement('div');
        fill.className = 'stats-bar-fill';
        fill.style.width = pct + '%';
        track.appendChild(fill);
        row.appendChild(track);

        var countEl = document.createElement('div');
        countEl.className = 'stats-bar-count';
        countEl.textContent = count;
        row.appendChild(countEl);

        chartEl.appendChild(row);
      });

      if (tags.length === 0) {
        chartEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:16px 0;">No entries yet</div>';
      }
    });
  }

  proceedBtn.addEventListener('click', proceed);
  exportBtn.addEventListener('click', exportCsv);
})();
