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

  const suggestionsUi = document.getElementById('suggestions-ui');
  const suggestionsList = document.getElementById('suggestions-list');
  const suggestedTagEl = document.getElementById('suggested-tag');
  const continueBtn = document.getElementById('continue-btn');
  const articleUi = document.getElementById('article-ui');
  const openArticleBtn = document.getElementById('open-article-btn');
  const articleContinueBtn = document.getElementById('article-continue-btn');
  const toggleEmbedBtn = null;
  const articleIframe = null;

  var selectedTag = null;
  var suggestionsMap = null;
  var articlesList = [];
  var savedArticlesList = [];
  var currentArticleUrl = null;
  var reasonContentMode = 'suggestions';
  var showSuggestions = true;
  var articlesReady = null;


  var siteDisplay = 'a site';
  if (targetUrl) {
    try {
      siteDisplay = new URL(targetUrl).hostname;
    } catch (_) {}
  }
  siteNameEl.textContent = siteDisplay;
  blockedSiteName.textContent = siteDisplay;

  articlesReady = (async () => {
    var rcResult = await chrome.storage.local.get({ reasonContentMode: 'suggestions', showSuggestions: true, suggestionsContent: '' });
    if (rcResult.reasonContentMode) {
      reasonContentMode = rcResult.reasonContentMode;
    } else {
      reasonContentMode = rcResult.showSuggestions !== false ? 'suggestions' : 'none';
    }
    showSuggestions = (reasonContentMode === 'suggestions');
    if (reasonContentMode === 'suggestions') {
      var scResult = rcResult.suggestionsContent;
      var md = scResult;
      if (!md) {
        try {
          var resp = await fetch(chrome.runtime.getURL('suggestions.md'));
          md = await resp.text();
        } catch (_) {}
      }
      if (md) suggestionsMap = parseSuggestions(md);
    } else if (reasonContentMode === 'articles') {
      var savedRes = await chrome.storage.local.get({ savedArticles: [] });
      var saved = Array.isArray(savedRes.savedArticles) ? savedRes.savedArticles : [];
      savedArticlesList = saved.filter(function (a) {
        return a && a.url && /^https?:\/\//i.test(a.url) && a.status !== 'archived';
      });
      var bundled = '';
      try {
        var respb = await fetch(chrome.runtime.getURL('articles.md'));
        bundled = await respb.text();
      } catch (_) {}
      var merged = '';
      if (saved.length > 0) {
        merged += '# Saved\n';
        saved.forEach(function (a) {
          var t = (a.title || a.url || 'Saved article').replace(/[\r\n\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Saved article';
          var u = (a.url || '').trim();
          if (/^https?:\/\//i.test(u)) merged += '- [' + t + '](' + u + ')\n';
        });
        merged += '\n';
      }
      if (bundled) merged += bundled;
      if (merged) articlesList = parseArticles(merged);
    }
  })();

  // ===== Block mode =====
  if (mode === 'block') {
    reasonUi.style.display = 'none';
    blockedUi.style.display = 'block';

    closeBtn.addEventListener('click', () => {
      if (tabId) chrome.tabs.remove(tabId);
    });
    return;
  }

  // ===== Shuffle reasons =====
  (async () => {
    var { shuffleReasons } = await chrome.storage.local.get('shuffleReasons');
    if (shuffleReasons) {
      var btns = Array.from(tagGrid.querySelectorAll('.tag-btn'));
      for (let i = btns.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        [btns[i], btns[j]] = [btns[j], btns[i]];
      }
      btns.forEach(b => tagGrid.appendChild(b));
    }
  })();

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
  const COUNTDOWN_SECONDS = 6;
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

    if (reasonContentMode === 'suggestions' && suggestionsMap && suggestionsMap[tag.toLowerCase()]) {
      showSuggestionsForTag(tag);
      return;
    }
    if (reasonContentMode === 'articles') {
      try { await articlesReady; } catch (_) {}
      showArticleForTag(tag);
      return;
    }
    goToSite();
  }

  async function goToSite() {
    if (!targetUrl || !tabId) return;
    await chrome.runtime.sendMessage({
      type: 'APPROVE_TAB',
      tabId: tabId,
      url: targetUrl
    });
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

  // ===== Suggestions =====

  function parseSuggestions(md) {
    var map = {};
    var lines = md.split('\n');
    var currentTag = null;
    var currentLines = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^#\s+(.+)/);
      if (m) {
        if (currentTag) map[currentTag] = currentLines.join('\n').trim();
        currentTag = m[1].toLowerCase();
        currentLines = [];
      } else if (currentTag) {
        currentLines.push(lines[i]);
      }
    }
    if (currentTag) map[currentTag] = currentLines.join('\n').trim();
    return map;
  }

  function parseArticles(md) {
    var list = [];
    var lines = md.split('\n');
    var currentTag = 'general';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (!trimmed) continue;
      var m = trimmed.match(/^#\s+(.+)/);
      if (m) {
        currentTag = m[1].trim();
        continue;
      }
      var l = trimmed.match(/^[-*]\s+\[(.+?)\]\((.+?)\)(.*)/);
      if (l) {
        list.push({
          title: l[1],
          url: l[2],
          tag: currentTag,
          excerpt: (l[3] || '').replace(/^[^\w]*/, '').trim()
        });
      }
    }
    return list;
  }

  function renderMarkdown(raw) {
    if (!raw) return '';
    var lines = raw.split('\n');
    var html = '';
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (!trimmed) {
        if (inList) { html += '</ul>'; inList = false; }
        continue;
      }
      if (/^###\s/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<h3>' + inlineMd(trimmed.replace(/^###\s+/, '')) + '</h3>';
      } else if (/^##\s/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<h2>' + inlineMd(trimmed.replace(/^##\s+/, '')) + '</h2>';
      } else if (/^#\s/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<h2>' + inlineMd(trimmed.replace(/^#\s+/, '')) + '</h2>';
      } else if (/^>\s/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<blockquote>' + inlineMd(trimmed.replace(/^>\s+/, '')) + '</blockquote>';
      } else if (/^-\s/.test(trimmed)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inlineMd(trimmed.replace(/^-\s+/, '')) + '</li>';
      } else if (/^```/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        var codeLines = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        html += '<pre><code>' + escHtml(codeLines.join('\n')) + '</code></pre>';
      } else if (/^!\[.*\]\(.*\)/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        var imgMatch = trimmed.match(/^!\[(.*)\]\((.*)\)/);
        if (imgMatch) html += '<img src="' + escAttr(imgMatch[2]) + '" alt="' + escAttr(imgMatch[1]) + '">';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p>' + inlineMd(trimmed) + '</p>';
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function showArticleForTag(tag) {
    reasonUi.style.display = 'none';
    var savedCandidates = savedArticlesList.filter(function (a) {
      return a && a.url && /^https?:\/\//i.test(a.url) && a.status !== 'archived';
    });
    var candidates;
    if (savedCandidates.length > 0) {
      candidates = savedCandidates.map(function (a) {
        return { title: a.title || a.url, url: a.url, tag: 'Saved', excerpt: '' };
      });
    } else {
      candidates = articlesList.filter(function (a) {
        return a.tag && a.tag.toLowerCase() === String(tag || '').toLowerCase();
      });
      if (candidates.length === 0) {
        candidates = articlesList.slice();
      }
    }
    candidates = candidates.filter(function (a) {
      return a && a.url && /^https?:\/\//i.test(a.url);
    });
    if (candidates.length === 0) {
      goToSite();
      return;
    }
    var article = candidates[Math.floor(Math.random() * candidates.length)];
    currentArticleUrl = article.url;
    try {
      chrome.tabs.create({ url: currentArticleUrl });
    } catch (_) {}
    if (openArticleBtn) {
      openArticleBtn.onclick = function () {
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL('reading-list.html') });
        } catch (_) {}
      };
    }
    suggestionsUi.style.display = 'none';
    articleUi.style.display = 'block';
    startArticleContinueCountdown(5);
  }

  function startArticleContinueCountdown(seconds) {
    if (!articleContinueBtn) { goToSite(); return; }
    articleContinueBtn.disabled = true;
    var remaining = seconds;
    articleContinueBtn.textContent = 'Continue in ' + remaining + 's';
    var interval = setInterval(function () {
      remaining--;
      if (remaining > 0) {
        articleContinueBtn.textContent = 'Continue in ' + remaining + 's';
      } else {
        clearInterval(interval);
        articleContinueBtn.disabled = false;
        articleContinueBtn.textContent = 'Continue to site';
      }
    }, 1000);
    articleContinueBtn.onclick = function () {
      clearInterval(interval);
      goToSite();
    };
  }


  function inlineMd(text) {
    text = escHtml(text);
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return text;
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
  }

  function showSuggestionsForTag(tag) {
    reasonUi.style.display = 'none';
    suggestedTagEl.textContent = tag;
    var raw = suggestionsMap[tag.toLowerCase()];
    suggestionsList.innerHTML = raw ? renderMarkdown(raw) : '';
    suggestionsUi.style.display = 'block';
    startContinueCountdown(6);
  }

  function startContinueCountdown(seconds) {
    continueBtn.disabled = true;
    var remaining = seconds;
    continueBtn.textContent = 'Continue in ' + remaining + 's';
    var interval = setInterval(function () {
      remaining--;
      if (remaining > 0) {
        continueBtn.textContent = 'Continue in ' + remaining + 's';
      } else {
        clearInterval(interval);
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue to site';
      }
    }, 1000);
  }

  continueBtn.addEventListener('click', function () {
    goToSite();
  });

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
