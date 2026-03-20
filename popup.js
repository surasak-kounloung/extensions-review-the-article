let isScanning = false;
let pollTimer = null;

const btnToggle = document.getElementById('btn-toggle');
const btnLabel = document.getElementById('btn-label');
const iconScan = document.getElementById('icon-scan');
const iconStop = document.getElementById('icon-stop');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const messageEl = document.getElementById('message');

const linkProgress = document.getElementById('link-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const linkSummary = document.getElementById('link-summary');
const countOk = document.getElementById('count-ok');
const countBroken = document.getElementById('count-broken');
const countTotal = document.getElementById('count-total');
const linkResults = document.getElementById('link-results');

const anchorSummary = document.getElementById('anchor-summary');
const anchorOk = document.getElementById('anchor-ok');
const anchorBroken = document.getElementById('anchor-broken');
const anchorTotal = document.getElementById('anchor-total');
const anchorResults = document.getElementById('anchor-results');

const h2Summary = document.getElementById('h2-summary');
const h2Ok = document.getElementById('h2-ok');
const h2Broken = document.getElementById('h2-broken');
const h2Total = document.getElementById('h2-total');
const h2Results = document.getElementById('h2-results');

const yearSummary = document.getElementById('year-summary');
const yearCount = document.getElementById('year-count');
const yearCurrentCount = document.getElementById('year-current-count');
const yearValue = document.getElementById('year-value');
const yearResults = document.getElementById('year-results');

btnToggle.addEventListener('click', toggleScan);

yearValue.textContent = new Date().getFullYear();

init();

async function init() {
  await checkCurrentStatus();
  if (isScanning) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await renderAnchorResults(tab.id);
    await renderH2Results(tab.id);
    await renderYearResults(tab.id);
    await renderLinkResults(tab.id);
    await checkIfStillRunning(tab.id);
  }
}

async function checkCurrentStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
    if (response && response.active) {
      setActiveUI();
      isScanning = true;
    }
  } catch {
    // content script not yet injected
  }
}

async function checkIfStillRunning(tabId) {
  const data = await chrome.storage.local.get(`linkProgress_${tabId}`);
  const progress = data[`linkProgress_${tabId}`];
  if (progress && progress.status === 'checking') {
    startPolling(tabId);
  }
}

function startPolling(tabId) {
  stopPolling();
  updateProgress(tabId);
  pollTimer = setInterval(() => updateProgress(tabId), 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function updateProgress(tabId) {
  const keys = [`linkProgress_${tabId}`, `linkResults_${tabId}`];
  const data = await chrome.storage.local.get(keys);
  const progress = data[`linkProgress_${tabId}`];

  if (!progress) return;

  if (progress.status === 'checking') {
    linkProgress.classList.remove('hidden');
    linkSummary.classList.add('hidden');
    const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${progress.current} / ${progress.total}`;

    const saved = data[`linkResults_${tabId}`];
    if (saved && saved.results) {
      renderLinkList(saved);
    }
  } else if (progress.status === 'done' || progress.status === 'cancelled' || progress.status === 'error') {
    stopPolling();
    linkProgress.classList.add('hidden');
    await renderLinkResults(tabId);

    if (progress.status === 'done') {
      const saved = data[`linkResults_${tabId}`];
      if (saved && saved.brokenCount > 0) {
        showMessage(`พบ ${saved.brokenCount} ลิงก์ที่มีปัญหา`, 'error');
      } else {
        showMessage('ทุกลิงก์ใช้งานได้ปกติ', 'success');
      }
    }
  }
}

async function renderLinkResults(tabId) {
  const data = await chrome.storage.local.get(`linkResults_${tabId}`);
  const saved = data[`linkResults_${tabId}`];
  if (!saved || !saved.results || saved.results.length === 0) return;
  renderLinkList(saved);
}

function renderLinkList(saved) {
  linkResults.innerHTML = '';
  saved.results.filter(r => !r.ok).forEach(r => appendLinkResult(r, linkResults));
  saved.results.filter(r => r.ok).forEach(r => appendLinkResult(r, linkResults));
  countOk.textContent = saved.okCount;
  countBroken.textContent = saved.brokenCount;
  countTotal.textContent = saved.total;
  linkSummary.classList.remove('hidden');
}

async function renderAnchorResults(tabId) {
  const data = await chrome.storage.local.get(`anchorResults_${tabId}`);
  const saved = data[`anchorResults_${tabId}`];
  if (!saved || !saved.results || saved.results.length === 0) return;

  anchorResults.innerHTML = '';
  saved.results.filter(r => !r.ok).forEach(r => appendLinkResult(r, anchorResults));
  saved.results.filter(r => r.ok).forEach(r => appendLinkResult(r, anchorResults));
  anchorOk.textContent = saved.okCount;
  anchorBroken.textContent = saved.brokenCount;
  anchorTotal.textContent = saved.total;
  anchorSummary.classList.remove('hidden');
}

async function renderYearResults(tabId) {
  const data = await chrome.storage.local.get(`yearResults_${tabId}`);
  const saved = data[`yearResults_${tabId}`];
  if (!saved) return;

  yearValue.textContent = saved.currentYear || new Date().getFullYear();
  yearCount.textContent = saved.total;
  yearCurrentCount.textContent = saved.currentYearCount ?? 0;

  yearResults.innerHTML = '';
  const currentYearResults = saved.currentYearResults || [];
  const otherResults = saved.results || [];

  if (saved.total === 0 && currentYearResults.length === 0) {
    yearSummary.classList.remove('hidden');
    const div = document.createElement('div');
    div.className = 'link-item link-alert';
    div.innerHTML = `
      <span class="link-status-badge alert">ไม่มี</span>
      <div class="link-info">
        <div class="link-text">ไม่พบเลขปีในเนื้อหา</div>
        <div class="link-url">ไม่พบปี 19xx หรือ 20xx ในเนื้อหา</div>
      </div>
    `;
    yearResults.appendChild(div);
    yearSummary.classList.remove('hidden');
    return;
  }

  if (saved.total === 0 && currentYearResults.length > 0) {
    const div = document.createElement('div');
    div.className = 'link-item link-alert';
    div.innerHTML = `
      <span class="link-status-badge alert">ไม่มี</span>
      <div class="link-info">
        <div class="link-text">ไม่พบเลขปีอื่นนอกจากปี ${saved.currentYear} ในเนื้อหา</div>
        <div class="link-url">ทุกตำแหน่งที่พบปีเป็นปีปัจจุบันเรียบร้อยแล้ว</div>
      </div>
    `;
    yearResults.appendChild(div);
  }

  otherResults.forEach(r => appendYearResult(r));
  currentYearResults.forEach(r => appendCurrentYearResult(r));
  yearSummary.classList.remove('hidden');
}

function appendCurrentYearResult(entry) {
  const div = document.createElement('div');
  div.className = 'link-item link-ok';
  div.innerHTML = `
    <span class="link-status-badge ok">ปี ${escapeHTML(entry.year)}</span>
    <div class="link-info">
      <div class="link-text">${escapeHTML(entry.context)}</div>
      <div class="link-url">ใน &lt;${entry.tagName}&gt;</div>
    </div>
  `;
  div.style.cursor = 'pointer';
  div.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'scrollToCurrentYear', index: entry.index });
    if (res?.success) await chrome.tabs.update(tab.id, { active: true });
  });
  yearResults.appendChild(div);
}

function appendYearResult(entry) {
  const div = document.createElement('div');
  div.className = 'link-item link-broken';
  div.innerHTML = `
    <span class="link-status-badge broken">ปี ${escapeHTML(entry.year)}</span>
    <div class="link-info">
      <div class="link-text">${escapeHTML(entry.context)}</div>
      <div class="link-url">ใน &lt;${entry.tagName}&gt;</div>
    </div>
  `;
  div.style.cursor = 'pointer';
  div.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'scrollToYear', index: entry.index });
    if (res?.success) await chrome.tabs.update(tab.id, { active: true });
  });
  yearResults.appendChild(div);
}

async function renderH2Results(tabId) {
  const data = await chrome.storage.local.get(`h2Results_${tabId}`);
  const saved = data[`h2Results_${tabId}`];
  if (!saved || !saved.results || saved.results.length === 0) return;

  h2Results.innerHTML = '';
  saved.results.filter(r => !r.ok).forEach(r => appendH2Result(r));
  saved.results.filter(r => r.ok).forEach(r => appendH2Result(r));
  h2Ok.textContent = saved.okCount;
  h2Broken.textContent = saved.brokenCount;
  h2Total.textContent = saved.total;
  h2Summary.classList.remove('hidden');
}

function appendH2Result(entry) {
  const div = document.createElement('div');
  div.className = `link-item ${entry.ok ? 'link-ok' : 'link-broken'}`;

  const statusLabel = entry.ok
    ? `<span class="link-status-badge ok">${entry.status}</span>`
    : `<span class="link-status-badge broken">${entry.status}</span>`;

  div.innerHTML = `
    ${statusLabel}
    <div class="link-info">
      <div class="link-text">H2 #${entry.index}: ${escapeHTML(entry.text)}</div>
      <div class="link-url">${escapeHTML(entry.statusText)}</div>
    </div>
  `;

  if (!entry.ok) {
    div.style.cursor = 'pointer';
    div.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'scrollToH2', index: entry.index });
    });
  }

  h2Results.appendChild(div);
}

async function clearSavedResults(tabId) {
  await chrome.storage.local.remove([
    `linkResults_${tabId}`,
    `linkProgress_${tabId}`,
    `anchorResults_${tabId}`,
    `h2Results_${tabId}`,
    `yearResults_${tabId}`
  ]);
}

async function toggleScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch {
    showMessage('ไม่สามารถเข้าถึงหน้าเว็บนี้ได้', 'error');
    return;
  }

  if (isScanning) {
    stopPolling();
    await chrome.runtime.sendMessage({ action: 'cancelLinkCheck', tabId: tab.id });
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'deactivate' });
    if (res && res.success) {
      setInactiveUI();
      isScanning = false;
      clearAllResults();
      await clearSavedResults(tab.id);
      showMessage('ปิดสแกนเรียบร้อยแล้ว', 'success');
    }
  } else {
    let containerCheck;
    try {
      containerCheck = await chrome.tabs.sendMessage(tab.id, { action: 'hasContentContainer' });
    } catch {
      showMessage('ไม่สามารถตรวจสอบหน้าเว็บนี้ได้', 'error');
      return;
    }
    if (!containerCheck?.hasContainer) {
      showMessage(containerCheck?.error || 'ไม่พบ element ที่มี class "entry-content", "blog-wrapper" หรือ "cs-site-content" ในหน้าเว็บนี้', 'error');
      return;
    }

    setActiveUI();
    isScanning = true;
    showMessage('กำลังตรวจสอบโครงสร้าง...', 'success');

    const preRes = await chrome.runtime.sendMessage({ action: 'startLinkCheck', tabId: tab.id });

    if (preRes && preRes.ready) {
      await renderH2Results(tab.id);
      await renderAnchorResults(tab.id);
      await renderYearResults(tab.id);
    }

    const res = await chrome.tabs.sendMessage(tab.id, { action: 'activate' });
    if (res && res.error) {
      setInactiveUI();
      isScanning = false;
      clearAllResults();
      showMessage(res.error, 'error');
      return;
    }

    showMessage('เปิดสแกนเรียบร้อย — กำลังตรวจสอบลิงก์...', 'success');
    startPolling(tab.id);
  }
}

function clearAllResults() {
  linkResults.innerHTML = '';
  linkSummary.classList.add('hidden');
  linkProgress.classList.add('hidden');
  anchorResults.innerHTML = '';
  anchorSummary.classList.add('hidden');
  h2Results.innerHTML = '';
  h2Summary.classList.add('hidden');
  yearResults.innerHTML = '';
  yearSummary.classList.add('hidden');
}

function appendLinkResult(entry, container) {
  const div = document.createElement('div');
  div.className = `link-item ${entry.ok ? 'link-ok' : 'link-broken'}`;

  const statusLabel = entry.ok
    ? `<span class="link-status-badge ok">${entry.status || 'OK'}</span>`
    : `<span class="link-status-badge broken">${entry.status || 'ERR'} ${entry.statusText || ''}</span>`;

  const text = entry.text || '(ไม่มีข้อความ)';

  div.innerHTML = `
    ${statusLabel}
    <div class="link-info">
      <div class="link-text">${escapeHTML(text)}</div>
      <div class="link-url">${escapeHTML(entry.url)}</div>
    </div>
  `;

  if (!entry.ok) {
    div.style.cursor = 'pointer';
    div.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const res = await chrome.tabs.sendMessage(tab.id, { action: 'scrollToLink', url: entry.url, text: entry.text });
        if (res?.success) {
          await chrome.tabs.update(tab.id, { active: true });
        }
      } catch (err) {
        console.error('scrollToLink failed:', err);
      }
    });
  }

  container.appendChild(div);
}

function setActiveUI() {
  btnToggle.classList.add('active');
  btnLabel.textContent = 'ปิดสแกน';
  iconScan.classList.add('hidden');
  iconStop.classList.remove('hidden');
  statusDot.classList.add('on');
  statusText.textContent = 'กำลังสแกนอยู่';
}

function setInactiveUI() {
  btnToggle.classList.remove('active');
  btnLabel.textContent = 'เปิดสแกนหน้าเว็บ';
  iconScan.classList.remove('hidden');
  iconStop.classList.add('hidden');
  statusDot.classList.remove('on');
  statusText.textContent = 'พร้อมใช้งาน';
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');
  setTimeout(() => messageEl.classList.add('hidden'), 4000);
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
