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

const branchInput = document.getElementById('branch-input');
const stepperMinus = document.querySelector('.stepper-minus');
const stepperPlus = document.querySelector('.stepper-plus');
const branchSummary = document.getElementById('branch-summary');
const branchOk = document.getElementById('branch-ok');
const branchBroken = document.getElementById('branch-broken');
const branchTotal = document.getElementById('branch-total');
const branchResults = document.getElementById('branch-results');

const docxInput = document.getElementById('docx-input');
const docxFilename = document.getElementById('docx-filename');
const docCompareSummary = document.getElementById('doc-compare-summary');
const docMatchCount = document.getElementById('doc-match-count');
const docIssueCount = document.getElementById('doc-issue-count');
const docBlockCount = document.getElementById('doc-block-count');
const webBlockCount = document.getElementById('web-block-count');
const docCompareResults = document.getElementById('doc-compare-results');
const docCompareAlignmentWrap = document.getElementById('doc-compare-alignment-wrap');
const docCompareAlignment = document.getElementById('doc-compare-alignment');
const docCompareIssuesDetails = document.getElementById('doc-compare-issues-details');
const docIssueSummaryCount = document.getElementById('doc-issue-summary-count');
const docCompareQuickMsg = document.getElementById('doc-compare-quick-msg');
const docMammothDebug = document.getElementById('doc-mammoth-debug');
const docMammothHtml = document.getElementById('doc-mammoth-html');
const docMammothMeta = document.getElementById('doc-mammoth-meta');
const docMammothMessages = document.getElementById('doc-mammoth-messages');
const docMammothCopy = document.getElementById('doc-mammoth-copy');
const docxUploadProgress = document.getElementById('docx-upload-progress');
const docxProgressFill = document.getElementById('docx-progress-fill');
const docxProgressText = document.getElementById('docx-progress-text');

/** HTML แท็กที่แสดงในกล่อง debug (หลังตัด/กรอง — คัดลอกได้) */
let lastMammothHtml = '';

/** บล็อกจาก .docx ล่าสุดหลัง applyDocxComparePipeline — ใช้เทียบกับหน้าเว็บเมื่อกดเปิดสแกนเท่านั้น (null = ยังไม่ได้อัปโหลดสำเร็จในรอบนี้) */
let lastDocxCompareBlocks = null;

function docxCompareStorageKey(tabId) {
  return `docxCompareCache_${tabId}`;
}

async function saveDocxCompareCache(tabId, filename, blocks) {
  if (tabId == null || !blocks || !blocks.length) return;
  try {
    await chrome.storage.local.set({
      [docxCompareStorageKey(tabId)]: {
        filename: filename || '',
        blocks
      }
    });
  } catch (e) {
    console.warn('saveDocxCompareCache', e);
  }
}

async function loadDocxCompareCache(tabId) {
  if (tabId == null) return null;
  try {
    const key = docxCompareStorageKey(tabId);
    const data = await chrome.storage.local.get(key);
    const entry = data[key];
    if (!entry || !Array.isArray(entry.blocks) || !entry.blocks.length) return null;
    return { filename: entry.filename || '', blocks: entry.blocks };
  } catch {
    return null;
  }
}

async function removeDocxCompareCache(tabId) {
  if (tabId == null) return;
  try {
    await chrome.storage.local.remove(docxCompareStorageKey(tabId));
  } catch (e) {
    console.warn('removeDocxCompareCache', e);
  }
}

btnToggle.addEventListener('click', toggleScan);

/** ระหว่างอ่าน/แปลงไฟล์ .docx — ปิดปุ่มสแกนจนกว่าจะแสดงข้อความ "ไฟล์พร้อมแล้ว" (หรือจบด้วย error) */
function setScanToggleDisabled(disabled) {
  if (!btnToggle) return;
  btnToggle.disabled = !!disabled;
  if (disabled) {
    btnToggle.setAttribute('aria-disabled', 'true');
  } else {
    btnToggle.removeAttribute('aria-disabled');
  }
}

function setDocxUploadProgressVisible(visible) {
  if (!docxUploadProgress) return;
  docxUploadProgress.classList.toggle('hidden', !visible);
  docxUploadProgress.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (visible && docxProgressFill) {
    docxProgressFill.style.width = '0%';
  }
}

function setDocxProgressPercent(pct) {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  if (docxProgressFill) docxProgressFill.style.width = p + '%';
  if (!docxProgressText) return;
  let label = 'กำลังอ่านไฟล์…';
  if (p >= 30) label = 'กำลังแปลงเป็น HTML…';
  if (p >= 70) label = 'กำลังแยกบล็อก…';
  if (p >= 100) label = 'เสร็จแล้ว';
  docxProgressText.textContent = `${label} ${p}%`;
}

if (docMammothCopy) {
  docMammothCopy.addEventListener('click', async () => {
    if (!lastMammothHtml) return;
    try {
      await navigator.clipboard.writeText(lastMammothHtml);
      showMessage('คัดลอก HTML หลังตัด/กรองแล้ว', 'success');
    } catch {
      showMessage('คัดลอกไม่สำเร็จ', 'error');
    }
  });
}

if (docxInput) {
  docxInput.addEventListener('change', onDocxSelected);
}

if (stepperMinus) {
  stepperMinus.addEventListener('click', () => {
    const val = parseInt(branchInput.value, 10) || 0;
    branchInput.value = Math.max(0, val - 1);
  });
}
if (stepperPlus) {
  stepperPlus.addEventListener('click', () => {
    const val = parseInt(branchInput.value, 10) || 0;
    branchInput.value = val + 1;
  });
}

yearValue.textContent = new Date().getFullYear();

init();

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const cached = await loadDocxCompareCache(tab.id);
    if (cached?.blocks?.length) {
      lastDocxCompareBlocks = cached.blocks;
      if (docxFilename && cached.filename) docxFilename.textContent = cached.filename;
    }
  }

  await checkCurrentStatus();

  if (isScanning && tab?.id) {
    await renderAnchorResults(tab.id);
    await renderH2Results(tab.id);
    await renderYearResults(tab.id);
    await renderBranchResults(tab.id);
    await renderLinkResults(tab.id);
    await checkIfStillRunning(tab.id);
    if (lastDocxCompareBlocks !== null) {
      await runDocCompareWithWeb(tab.id, { quiet: true });
    }
  } else if (!isScanning && tab?.id && lastDocxCompareBlocks !== null && docCompareQuickMsg) {
    docCompareQuickMsg.classList.remove('hidden');
    docCompareQuickMsg.innerHTML = `
        <div class="link-item link-alert" style="border:none;background:transparent;padding:0;">
          <span class="link-status-badge alert">รอสแกน</span>
          <div class="link-info">
            <div class="link-text">ไฟล์ยังอยู่ในแท็บนี้ — กดปุ่ม <strong>เปิดสแกนหน้าเว็บ</strong> เพื่อเทียบเนื้อหากับหน้าเว็บอีกครั้ง</div>
          </div>
        </div>`;
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

async function renderBranchResults(tabId) {
  const data = await chrome.storage.local.get(`branchResults_${tabId}`);
  const saved = data[`branchResults_${tabId}`];
  let branchInputValue = branchInput.value;
  if (!saved) return;

  branchOk.textContent = saved.okCount ?? 0;
  branchBroken.textContent = saved.brokenCount ?? 0;
  branchTotal.textContent = saved.total ?? 0;

  branchResults.innerHTML = '';
  const results = saved.results || [];

  if (results.length === 0) {
    branchOk.textContent = '0';
    branchBroken.textContent = '0';
    branchTotal.textContent = '0';
    branchSummary.classList.remove('hidden');
    const div = document.createElement('div');
    div.className = 'link-item link-alert';
    div.innerHTML = `
      <span class="link-status-badge alert">ไม่มี</span>
      <div class="link-info">
        <div class="link-text">ไม่พบจำนวนสาขาในเนื้อหา</div>
        <div class="link-url">ไม่มีข้อความเช่น "${branchInputValue} สาขา" ในเนื้อหา</div>
      </div>
    `;
    branchResults.appendChild(div);
    return;
  }

  results.filter(r => !r.ok).forEach(r => appendBranchResult(r));
  results.filter(r => r.ok).forEach(r => appendBranchResult(r));
  branchSummary.classList.remove('hidden');
}

function appendBranchResult(entry) {
  const div = document.createElement('div');
  div.className = `link-item ${entry.ok ? 'link-ok' : 'link-broken'}`;

  const statusLabel = entry.expectedNum == null
    ? `<span class="link-status-badge ok">${entry.foundNum} สาขา - พบ</span>`
    : entry.ok
      ? `<span class="link-status-badge ok">${entry.foundNum} สาขา - ถูกต้อง</span>`
      : `<span class="link-status-badge broken">${entry.foundNum} สาขา - ควรเป็น ${entry.expectedNum}</span>`;

  div.innerHTML = `
    ${statusLabel}
    <div class="link-info">
      <div class="link-text">${escapeHTML(entry.context)}</div>
      <div class="link-url">ใน &lt;${entry.tagName}&gt;</div>
    </div>
  `;

  div.style.cursor = 'pointer';
  div.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'scrollToBranch', index: entry.index });
    if (res?.success) await chrome.tabs.update(tab.id, { active: true });
  });

  branchResults.appendChild(div);
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
    `yearResults_${tabId}`,
    `branchResults_${tabId}`
  ]);
}

async function toggleScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['docCompare.js', 'content.js']
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
      await clearDocCompareWordSection(tab.id);
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

    const parsed = parseInt(branchInput.value, 10);
    const branchNum = (branchInput.value.trim() === '' || isNaN(parsed)) ? null : parsed;
    const preRes = await chrome.runtime.sendMessage({ action: 'startLinkCheck', tabId: tab.id, branchNumber: branchNum });

    if (preRes && preRes.ready) {
      await renderH2Results(tab.id);
      await renderAnchorResults(tab.id);
      await renderYearResults(tab.id);
      await renderBranchResults(tab.id);
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
    if (lastDocxCompareBlocks !== null) {
      await runDocCompareWithWeb(tab.id);
    }
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
  branchResults.innerHTML = '';
  branchSummary.classList.add('hidden');
}

function appendLinkResult(entry, container) {
  const div = document.createElement('div');
  div.className = `link-item ${entry.ok ? 'link-ok' : 'link-broken'}`;

  /** tel:/mailto:/sms: ตรวจแค่รูปแบบ — แสดงข้อความจาก statusText แทนรหัส HTTP */
  let badgeInner;
  if (entry.ok) {
    badgeInner = entry.checkType === 'scheme'
      ? escapeHTML(entry.statusText)
      : (entry.status != null ? String(entry.status) : 'OK');
  } else {
    badgeInner = entry.checkType === 'scheme'
      ? escapeHTML(entry.statusText)
      : `${entry.status || 'ERR'} ${entry.statusText || ''}`;
  }

  const statusLabel = entry.ok
    ? `<span class="link-status-badge ok">${badgeInner}</span>`
    : `<span class="link-status-badge broken">${badgeInner}</span>`;

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

/** แยกคำ/ช่องว่างสำหรับ diff เมื่อข้อความยาว (ลดขนาดตาราง DP) */
function tokenizeForDocDiff(s) {
  if (!s) return [];
  return s.match(/\S+|\s+/g) || [];
}

function mergeDocDiffOps(ops) {
  const out = [];
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    const last = out[out.length - 1];
    if (last && last.type === op.type) {
      last.text += op.text;
    } else {
      out.push({ type: op.type, text: op.text });
    }
  }
  return out;
}

/**
 * LCS บนชุดโทเค็น (ตัวอักษรหรือคำ/ช่องว่าง) — คืนลำดับ equal / delete / insert
 * @param {string[]} aa
 * @param {string[]} bb
 */
function lcsDiffOps(aa, bb) {
  const m = aa.length;
  const n = bb.length;
  if (m * n > 8_000_000) return null;
  const dp = new Uint32Array((m + 1) * (n + 1));
  let i;
  let j;
  for (i = 1; i <= m; i++) {
    for (j = 1; j <= n; j++) {
      const idx = i * (n + 1) + j;
      if (aa[i - 1] === bb[j - 1]) {
        dp[idx] = dp[(i - 1) * (n + 1) + (j - 1)] + 1;
      } else {
        dp[idx] = Math.max(dp[(i - 1) * (n + 1) + j], dp[i * (n + 1) + (j - 1)]);
      }
    }
  }
  const ops = [];
  i = m;
  j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aa[i - 1] === bb[j - 1]) {
      ops.push({ type: 'equal', text: String(aa[i - 1]) });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i * (n + 1) + (j - 1)] >= dp[(i - 1) * (n + 1) + j])) {
      ops.push({ type: 'insert', text: String(bb[j - 1]) });
      j--;
    } else if (i > 0) {
      ops.push({ type: 'delete', text: String(aa[i - 1]) });
      i--;
    } else {
      break;
    }
  }
  ops.reverse();
  return ops;
}

/**
 * สร้าง HTML สองฝั่ง: ฝั่ง Word = ลบ/ต่าง (doc-diff-del), ฝั่งเว็บ = เพิ่ม/ต่าง (doc-diff-ins)
 * ใช้ diff ระดับตัวอักษร (รวมช่องว่างและขึ้นบรรทัด) ถ้าไม่หนักเกินไป; ไม่งั้นใช้โทเค็นคำ+ช่องว่าง
 */
function diffTextsToHtmlPair(leftText, rightText) {
  const a = Array.from(leftText);
  const b = Array.from(rightText);
  const prod = a.length * b.length;
  let rawOps = null;
  if (prod <= 4_000_000) {
    rawOps = lcsDiffOps(a, b);
  }
  if (!rawOps) {
    const ta = tokenizeForDocDiff(leftText);
    const tb = tokenizeForDocDiff(rightText);
    if (ta.length * tb.length > 6_000_000) return null;
    rawOps = lcsDiffOps(ta, tb);
  }
  if (!rawOps) return null;
  const merged = mergeDocDiffOps(rawOps);
  let wordHtml = '';
  let webHtml = '';
  for (let k = 0; k < merged.length; k++) {
    const seg = merged[k];
    if (!seg.text) continue;
    const esc = escapeHTML(seg.text);
    if (seg.type === 'equal') {
      wordHtml += esc;
      webHtml += esc;
    } else if (seg.type === 'delete') {
      wordHtml += `<span class="doc-diff-del">${esc}</span>`;
    } else if (seg.type === 'insert') {
      webHtml += `<span class="doc-diff-ins">${esc}</span>`;
    }
  }
  return { wordHtml, webHtml };
}

/** HTML เนื้อหาใน pane สำหรับการ์ดจุดต่าง (มีไฮไลต์เมื่อเป็นคู่เทียบ) */
function buildDocIssuePaneBodies(row) {
  const docText = row.docBlock ? DocCompare.blockFullText(row.docBlock) : '';
  const webText = row.webBlock ? DocCompare.blockFullText(row.webBlock) : '';

  if (row.kind === 'missing_on_web' && docText) {
    return {
      wordHtml: `<span class="doc-diff-del">${escapeHTML(docText)}</span>`,
      webHtml: ''
    };
  }
  if (row.kind === 'extra_on_web' && webText) {
    return {
      wordHtml: '',
      webHtml: `<span class="doc-diff-ins">${escapeHTML(webText)}</span>`
    };
  }
  if (row.kind === 'mismatch' || row.kind === 'reordered') {
    const d = diffTextsToHtmlPair(docText, webText);
    if (d) return d;
  }
  return { wordHtml: escapeHTML(docText), webHtml: escapeHTML(webText) };
}

function clearMammothDebug() {
  lastMammothHtml = '';
  docMammothDebug?.classList.add('hidden');
  if (docMammothHtml) docMammothHtml.textContent = '';
  if (docMammothMeta) docMammothMeta.textContent = '';
  if (docMammothMessages) {
    docMammothMessages.classList.add('hidden');
    docMammothMessages.innerHTML = '';
  }
}

/** รีเซ็ตส่วนเทียบ Word ↔ เว็บ — เรียกเมื่อปิดสแกนหน้าเว็บ (ลบ cache ต่อแท็บเมื่อส่ง tabId) */
async function clearDocCompareWordSection(tabId) {
  lastDocxCompareBlocks = null;
  if (tabId != null) await removeDocxCompareCache(tabId);
  if (docxFilename) docxFilename.textContent = '';
  if (docxInput) docxInput.value = '';
  if (docCompareResults) docCompareResults.innerHTML = '';
  if (docCompareAlignment) docCompareAlignment.innerHTML = '';
  docCompareAlignmentWrap?.classList.add('hidden');
  if (docCompareIssuesDetails) {
    docCompareIssuesDetails.classList.add('hidden');
    docCompareIssuesDetails.open = false;
  }
  if (docCompareQuickMsg) {
    docCompareQuickMsg.classList.add('hidden');
    docCompareQuickMsg.innerHTML = '';
  }
  docCompareSummary?.classList.add('hidden');
  if (docMatchCount) docMatchCount.textContent = '0';
  if (docIssueCount) docIssueCount.textContent = '0';
  if (docBlockCount) docBlockCount.textContent = '0';
  if (webBlockCount) webBlockCount.textContent = '0';
  if (docIssueSummaryCount) docIssueSummaryCount.textContent = '0';
  clearMammothDebug();
  if (docMammothDebug) docMammothDebug.open = false;
  if (docxUploadProgress) {
    docxUploadProgress.classList.add('hidden');
    docxUploadProgress.setAttribute('aria-hidden', 'true');
  }
  if (docxProgressFill) docxProgressFill.style.width = '0%';
  if (docxProgressText) docxProgressText.textContent = 'กำลังอ่านไฟล์…';
}

/**
 * แสดง HTML จากแท็ก Mammoth หลัง trim + กรอง (ลำดับเดียวกับที่เทียบเว็บ) และข้อความจาก Mammoth (ถ้ามี)
 * @param {{ value: string, messages?: Array<{ type?: string, message?: string } | string> }} result
 * @param {string} processedHtml — รวม outerHTML ของแท็กที่เหลือหลัง applyDocxComparePipeline
 */
function showMammothDebug(result, processedHtml) {
  if (!docMammothDebug || !docMammothHtml) return;
  const raw = result.value || '';
  lastMammothHtml = processedHtml != null ? String(processedHtml) : '';
  docMammothHtml.textContent = lastMammothHtml;
  const parts = [
    `หลังตัด/กรอง ${lastMammothHtml.length.toLocaleString()} ตัวอักษร`,
    `Mammoth ดิบ ${raw.length.toLocaleString()} ตัวอักษร`
  ];
  const msgs = result.messages;
  if (msgs && msgs.length) parts.push(`ข้อความจาก Mammoth: ${msgs.length} รายการ`);
  if (docMammothMeta) docMammothMeta.textContent = parts.join(' · ');

  if (docMammothMessages && msgs && msgs.length) {
    docMammothMessages.classList.remove('hidden');
    docMammothMessages.innerHTML = msgs
      .map(m => {
        const text = typeof m === 'string' ? m : m.message || '';
        const rawType = typeof m === 'object' && m.type ? String(m.type) : 'info';
        const typeClass = rawType.replace(/[^a-z0-9_-]/gi, '-').slice(0, 40) || 'info';
        return `<div class="doc-mammoth-msg doc-mammoth-msg--${escapeHTML(typeClass)}">${escapeHTML(String(text))}</div>`;
      })
      .join('');
  } else if (docMammothMessages) {
    docMammothMessages.classList.add('hidden');
    docMammothMessages.innerHTML = '';
  }
  docMammothDebug.classList.remove('hidden');
}

/**
 * เทียบ lastDocxCompareBlocks กับบล็อกจากแท็บ — เรียกหลังเปิดสแกนหน้าเว็บเมื่อมีไฟล์ .docx แล้ว
 * @param {{ quiet?: boolean }} [options] — quiet: ไม่แสดง toast (เช่น ตอนเปิด panel คืนจาก storage)
 */
async function runDocCompareWithWeb(tabId, options = {}) {
  if (lastDocxCompareBlocks === null || typeof DocCompare === 'undefined') return;

  let webRes;
  try {
    webRes = await chrome.tabs.sendMessage(tabId, { action: 'getArticleBlocks' });
  } catch (err) {
    showMessage('ไม่สามารถอ่านเนื้อหาหน้าเว็บได้ — รีเฟรชหน้าแล้วลองใหม่', 'error');
    return;
  }

  if (!webRes || !webRes.success) {
    showMessage(webRes?.error || 'ไม่พบ container เนื้อหา (entry-content / blog-wrapper / cs-site-content)', 'error');
    return;
  }

  const docBlocks = lastDocxCompareBlocks;
  const cmp = DocCompare.compareBlockSequences(docBlocks, webRes.blocks);
  const alignment = DocCompare.computeAlignment(docBlocks, webRes.blocks);

  docMatchCount.textContent = String(cmp.matchCount);
  docIssueCount.textContent = String(cmp.rows.length);
  docBlockCount.textContent = String(cmp.docCount);
  webBlockCount.textContent = String(cmp.webCount);
  docCompareSummary.classList.remove('hidden');

  if (docIssueSummaryCount) docIssueSummaryCount.textContent = String(cmp.rows.length);
  if (alignment.length && docCompareAlignment) {
    renderDocAlignment(alignment, tabId);
    docCompareAlignmentWrap?.classList.remove('hidden');
  } else {
    docCompareAlignmentWrap?.classList.add('hidden');
  }

  if (docCompareIssuesDetails) {
    docCompareIssuesDetails.classList.toggle('hidden', cmp.rows.length === 0);
    docCompareIssuesDetails.open = cmp.rows.length > 0;
  }

  docCompareResults.innerHTML = '';

  if (cmp.rows.length === 0) {
    if (docCompareQuickMsg) {
      docCompareQuickMsg.classList.remove('hidden');
      if (cmp.docCount === 0 && cmp.webCount === 0) {
        docCompareQuickMsg.innerHTML = `
            <div class="link-item link-alert" style="border:none;background:transparent;padding:0;">
              <span class="link-status-badge alert">ว่าง</span>
              <div class="link-info">
                <div class="link-text">ไม่พบบล็อกทั้งในไฟล์และบนหน้าเว็บ</div>
                <div class="link-url">ตรวจว่าไฟล์มีเนื้อหา และเปิดหน้าบทความที่ถูกต้อง</div>
              </div>
            </div>`;
      } else {
        docCompareQuickMsg.innerHTML = `
            <div class="link-item link-ok" style="border:none;background:transparent;padding:0;">
              <span class="link-status-badge ok">ครบ</span>
              <div class="link-info">
                <div class="link-text">ลำดับและข้อความตรงกันตามการจับคู่ (ดูตารางด้านบน)</div>
                <div class="link-url">บล็อกในเอกสาร ${cmp.docCount} รายการ — บนเว็บ ${cmp.webCount} รายการ</div>
              </div>
            </div>`;
      }
    }
  } else {
    docCompareQuickMsg?.classList.add('hidden');
    cmp.rows.forEach(row => appendDocCompareRow(row, tabId));
  }

  if (!options.quiet) {
    if (cmp.rows.length > 0) {
      showMessage(`พบ ${cmp.rows.length} จุดที่ควรตรวจเทียบกับไฟล์`, 'warning');
    } else if (docBlocks.length) {
      showMessage('เทียบเอกสารกับหน้าเว็บแล้ว — ไม่พบความต่างที่ชัดเจน', 'success');
    }
  }
}

async function onDocxSelected(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;

  if (typeof mammoth === 'undefined') {
    showMessage('ไม่พบไลบรารี Mammoth — โหลดส่วนขยายใหม่', 'error');
    return;
  }
  if (typeof DocCompare === 'undefined') {
    showMessage('ไม่พบ DocCompare', 'error');
    return;
  }

  docxFilename.textContent = file.name;
  docCompareResults.innerHTML = '';
  if (docCompareAlignment) docCompareAlignment.innerHTML = '';
  docCompareAlignmentWrap?.classList.add('hidden');
  docCompareIssuesDetails?.classList.add('hidden');
  docCompareQuickMsg?.classList.add('hidden');
  if (docCompareQuickMsg) docCompareQuickMsg.innerHTML = '';
  docCompareSummary.classList.add('hidden');
  clearMammothDebug();

  try {
    setScanToggleDisabled(true);
    setDocxUploadProgressVisible(true);
    setDocxProgressPercent(5);

    const arrayBuffer = await file.arrayBuffer();
    setDocxProgressPercent(28);

    const result = await mammoth.convertToHtml({ arrayBuffer });
    setDocxProgressPercent(48);

    const parser = new DOMParser();
    const parsed = parser.parseFromString(result.value, 'text/html');
    setDocxProgressPercent(58);

    const docExtracted = DocCompare.extractBlocksFromRoot(parsed.body);
    const piped = DocCompare.applyDocxComparePipeline(docExtracted);
    docExtracted.blocks = piped.blocks;
    docExtracted.elements = piped.elements;
    setDocxProgressPercent(78);

    const processedHtml = DocCompare.htmlFromDocxCompareElements(piped.elements);
    showMammothDebug(result, processedHtml);
    setDocxProgressPercent(92);

    lastDocxCompareBlocks = piped.blocks;

    const [tabForCache] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabForCache?.id) {
      if (docExtracted.blocks.length) {
        await saveDocxCompareCache(tabForCache.id, file.name, piped.blocks);
      } else {
        await removeDocxCompareCache(tabForCache.id);
      }
    }

    if (!docExtracted.blocks.length) {
      showMessage('ไม่พบหัวข้อ/ย่อหน้า/รายการในไฟล์ — ลองบันทึกจาก Word เป็น .docx ใหม่', 'warning');
    } else if (isScanning && tabForCache?.id) {
      await runDocCompareWithWeb(tabForCache.id);
    } else if (docCompareQuickMsg) {
      docCompareQuickMsg.classList.remove('hidden');
      docCompareQuickMsg.innerHTML = `
        <div class="link-item link-alert" style="border:none;background:transparent;padding:0;">
          <span class="link-status-badge alert">รอสแกน</span>
          <div class="link-info">
            <div class="link-text">ไฟล์พร้อมแล้ว — กดปุ่ม <strong>เปิดสแกนหน้าเว็บ</strong> ด้านบนเพื่อเทียบเนื้อหากับหน้าเว็บ</div>
          </div>
        </div>`;
      showMessage('อัปโหลดไฟล์แล้ว — กดปุ่ม เปิดสแกนหน้าเว็บ เพื่อเทียบกับไฟล์นี้', 'success');
    }
  } catch (err) {
    showMessage(err.message || String(err), 'error');
  } finally {
    setDocxProgressPercent(100);
    await new Promise(r => setTimeout(r, 220));
    setDocxUploadProgressVisible(false);
    setScanToggleDisabled(false);
  }

  ev.target.value = '';
}

function renderDocAlignment(alignment, tabId) {
  if (!docCompareAlignment) return;
  docCompareAlignment.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'doc-align-head';
  head.innerHTML = `
    <span class="doc-align-col doc-align-col--idx">#</span>
    <span>ไฟล์ Word (.docx)</span>
    <span>หน้าเว็บ</span>
  `;
  docCompareAlignment.appendChild(head);

  alignment.forEach((row, idx) => {
    const n = idx + 1;
    const r = document.createElement('div');
    const isMatch = row.type === 'match';
    const isDocOnly = row.type === 'doc_only';
    r.className =
      'doc-align-row' +
      (isMatch ? ' doc-align-row--match' : isDocOnly ? ' doc-align-row--doc' : ' doc-align-row--web');

    const docMeta = row.docBlock
      ? `[${DocCompare.blockLabel(row.docBlock)}] ลำดับที่ ${row.docIndex + 1} ในเอกสาร`
      : '';
    const webMeta = row.webBlock
      ? `[${DocCompare.blockLabel(row.webBlock)}] ลำดับที่ ${row.webIndex + 1} บนเว็บ`
      : '';

    const docText = row.docBlock ? DocCompare.blockFullText(row.docBlock) : '';
    const webText = row.webBlock ? DocCompare.blockFullText(row.webBlock) : '';

    const idxEl = document.createElement('span');
    idxEl.className = 'doc-align-col doc-align-col--idx';
    idxEl.textContent = String(n);

    const wordCol = document.createElement('div');
    wordCol.className = 'doc-align-col doc-align-col--word';
    if (row.docBlock) {
      const meta = document.createElement('span');
      meta.className = 'doc-align-meta';
      meta.textContent = docMeta;
      const body = document.createElement('div');
      body.className = 'doc-align-body';
      body.textContent = docText;
      wordCol.appendChild(meta);
      wordCol.appendChild(body);
    } else {
      const empty = document.createElement('div');
      empty.className = 'doc-align-empty';
      empty.textContent = '— (ไม่มีบล็อกฝั่ง Word ในจุดนี้)';
      wordCol.appendChild(empty);
    }

    const webCol = document.createElement('div');
    webCol.className = 'doc-align-col doc-align-col--web';
    if (row.webBlock) {
      webCol.classList.add('doc-align-col--web-click');
      const meta = document.createElement('span');
      meta.className = 'doc-align-meta';
      meta.textContent = webMeta;
      const body = document.createElement('div');
      body.className = 'doc-align-body';
      body.textContent = webText;
      webCol.appendChild(meta);
      webCol.appendChild(body);
      webCol.addEventListener('click', async () => {
        try {
          const res = await chrome.tabs.sendMessage(tabId, {
            action: 'scrollToArticleBlock',
            index: row.webIndex
          });
          if (res?.success) await chrome.tabs.update(tabId, { active: true });
        } catch (e) {
          console.error(e);
        }
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'doc-align-empty';
      empty.textContent = '— (ไม่มีบล็อกฝั่งเว็บในจุดนี้)';
      webCol.appendChild(empty);
    }

    r.appendChild(idxEl);
    r.appendChild(wordCol);
    r.appendChild(webCol);
    docCompareAlignment.appendChild(r);
  });
}

function appendDocCompareRow(row, tabId) {
  let badgeClass = 'broken';
  let itemClass = 'link-broken';
  let label = '';

  if (row.kind === 'reordered') {
    badgeClass = 'warn';
    itemClass = 'link-warn';
    label = 'ลำดับ/ตำแหน่งต่าง';
  } else if (row.kind === 'mismatch') {
    badgeClass = 'warn';
    itemClass = 'link-warn';
    label = 'ข้อความไม่ตรง';
  } else if (row.kind === 'missing_on_web') {
    label = 'ไม่มีบนเว็บ';
  } else if (row.kind === 'extra_on_web') {
    label = 'มีบนเว็บมากกว่าเอกสาร';
    badgeClass = 'alert';
    itemClass = 'link-alert';
  }

  const scoreNote =
    row.score != null ? `ความคล้ายโดยประมาณ ${Math.round(row.score * 100)}%` : '';

  const div = document.createElement('div');
  div.className = `doc-issue-card ${itemClass}`;

  const badgeRow = document.createElement('div');
  badgeRow.className = 'doc-issue-badge-row';
  badgeRow.innerHTML = `<span class="link-status-badge ${badgeClass}">${escapeHTML(label)}</span>`;
  if (scoreNote && (row.kind === 'reordered' || row.kind === 'mismatch')) {
    const sn = document.createElement('span');
    sn.className = 'doc-pane-meta';
    sn.style.marginBottom = '0';
    sn.textContent = scoreNote;
    badgeRow.appendChild(sn);
  }
  div.appendChild(badgeRow);

  const cols = document.createElement('div');
  cols.className = 'doc-issue-cols';

  const bodies = buildDocIssuePaneBodies(row);

  const paneWord = document.createElement('div');
  paneWord.className = 'doc-issue-pane doc-issue-pane--word';
  if (row.docBlock) {
    paneWord.innerHTML = `
      <span class="doc-pane-label">ไฟล์ Word</span>
      <span class="doc-pane-meta">[${escapeHTML(DocCompare.blockLabel(row.docBlock))}] ลำดับ ${row.docIndex + 1}</span>
      <div class="doc-pane-text doc-pane-text--diff">${bodies.wordHtml}</div>
    `;
  } else {
    paneWord.innerHTML = `
      <span class="doc-pane-label">ไฟล์ Word</span>
      <div class="doc-pane-text doc-pane-text--muted">—</div>
    `;
  }

  const paneWeb = document.createElement('div');
  paneWeb.className = 'doc-issue-pane doc-issue-pane--web';
  if (row.webBlock) {
    paneWeb.innerHTML = `
      <span class="doc-pane-label">หน้าเว็บ</span>
      <span class="doc-pane-meta">[${escapeHTML(DocCompare.blockLabel(row.webBlock))}] ลำดับ ${row.webIndex + 1}</span>
      <div class="doc-pane-text doc-pane-text--diff">${bodies.webHtml}</div>
    `;
    if (row.kind !== 'missing_on_web') {
      paneWeb.style.cursor = 'pointer';
      paneWeb.title = 'คลิกเพื่อเลื่อนไปตำแหน่งนี้';
      paneWeb.addEventListener('click', async () => {
        try {
          const res = await chrome.tabs.sendMessage(tabId, {
            action: 'scrollToArticleBlock',
            index: row.webIndex
          });
          if (res?.success) await chrome.tabs.update(tabId, { active: true });
        } catch (e) {
          console.error(e);
        }
      });
    }
  } else {
    paneWeb.innerHTML = `
      <span class="doc-pane-label">หน้าเว็บ</span>
      <div class="doc-pane-text doc-pane-text--muted">—</div>
    `;
  }

  cols.appendChild(paneWord);
  cols.appendChild(paneWeb);
  div.appendChild(cols);

  docCompareResults.appendChild(div);
}
