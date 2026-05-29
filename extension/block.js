(async function () {
  const params = new URLSearchParams(location.search);
  const targetUrl = params.get('target');
  const tabId = parseInt(params.get('tabId'), 10);
  const siteNameEl = document.getElementById('site-name');
  const reasonInput = document.getElementById('reason-input');
  const proceedBtn = document.getElementById('proceed-btn');
  const exportBtn = document.getElementById('export-btn');
  const entryCountEl = document.getElementById('entry-count');

  const COUNTDOWN_SECONDS = 10;

  if (targetUrl) {
    try {
      siteNameEl.textContent = new URL(targetUrl).hostname;
    } catch (_) {
      siteNameEl.textContent = 'this site';
    }
  } else {
    siteNameEl.textContent = 'a site';
  }

  var countdown = COUNTDOWN_SECONDS;

  function tick() {
    if (countdown > 0) {
      proceedBtn.disabled = true;
      proceedBtn.textContent = 'Proceed in ' + countdown + 's';
      countdown--;
      setTimeout(tick, 1000);
    } else {
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed';
    }
  }

  if (COUNTDOWN_SECONDS > 0) {
    tick();
  } else {
    proceedBtn.disabled = false;
    proceedBtn.textContent = 'Proceed';
  }

  async function proceed() {
    var reason = reasonInput.value.trim();
    if (!reason) {
      alert('Please enter a reason.');
      return;
    }
    if (!targetUrl || !tabId) {
      alert('No target URL specified.');
      return;
    }

    var { entries } = await chrome.storage.local.get({ entries: [] });
    entries.push({
      url: targetUrl,
      reason: reason,
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

    var headers = 'url,reason,timestamp,date';
    var rows = entries.map(function (e) {
      return '"' + escCsv(e.url) + '","' + escCsv(e.reason) + '","' + e.timestamp + '","' + e.date + '"';
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

  async function updateEntryCount() {
    var { entries } = await chrome.storage.local.get({ entries: [] });
    entryCountEl.textContent = entries.length + ' entries logged';
  }

  proceedBtn.addEventListener('click', proceed);
  exportBtn.addEventListener('click', exportCsv);
  updateEntryCount();
})();
