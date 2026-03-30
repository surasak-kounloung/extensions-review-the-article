const checkState = {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startLinkCheck') {
    runPreChecksAndStart(request.tabId, request.branchNumber).then(sendResponse);
    return true;
  } else if (request.action === 'cancelLinkCheck') {
    if (checkState[request.tabId]) {
      checkState[request.tabId].cancelled = true;
    }
    sendResponse({ cancelled: true });
  } else if (request.action === 'getLinkCheckStatus') {
    sendResponse({ running: !!checkState[request.tabId]?.running });
  }
  return true;
});

function getUrlScheme(url) {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(String(url).trim());
  return m ? m[1].toLowerCase() : '';
}

/** tel:/sms: ไม่มี HTTP endpoint — ตรวจเฉพาะรูปแบบ (ความยาวตัวเลข) */
function checkTelScheme(url) {
  const rest = String(url).replace(/^tel:/i, '').split(/[?#]/)[0];
  const decoded = decodeURIComponent(rest.trim());
  const digits = decoded.replace(/\D/g, '');
  if (digits.length < 5) {
    return { status: 0, ok: false, statusText: 'รูปแบบเบอร์โทรไม่ถูกต้อง', checkType: 'scheme' };
  }
  return { status: 0, ok: true, statusText: 'OK', checkType: 'scheme' };
}

function checkMailtoScheme(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'mailto:') {
      return { status: 0, ok: false, statusText: 'ไม่ใช่ mailto:', checkType: 'scheme' };
    }
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    const first = path.split(',')[0].trim();
    if (!first) {
      return { status: 0, ok: false, statusText: 'mailto: ไม่มีที่อยู่อีเมล', checkType: 'scheme' };
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(first)) {
      return { status: 0, ok: false, statusText: 'รูปแบบอีเมลไม่ถูกต้อง', checkType: 'scheme' };
    }
    return { status: 0, ok: true, statusText: 'OK', checkType: 'scheme' };
  } catch {
    return { status: 0, ok: false, statusText: 'ไม่สามารถ parse mailto:', checkType: 'scheme' };
  }
}

function checkSmsScheme(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'sms:') {
      return { status: 0, ok: false, statusText: 'ไม่ใช่ sms:', checkType: 'scheme' };
    }
    let raw = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    if (!raw) raw = u.hostname || '';
    if (!raw) {
      return { status: 0, ok: false, statusText: 'sms: ไม่มีเบอร์ผู้รับ', checkType: 'scheme' };
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 5) {
      return { status: 0, ok: false, statusText: 'รูปแบบเบอร์ SMS ไม่ถูกต้อง', checkType: 'scheme' };
    }
    return { status: 0, ok: true, statusText: 'OK', checkType: 'scheme' };
  } catch {
    const m = /^sms:(.+)$/i.exec(String(url).trim());
    if (!m) {
      return { status: 0, ok: false, statusText: 'ไม่สามารถ parse sms:', checkType: 'scheme' };
    }
    const part = decodeURIComponent(m[1].split(/[?#]/)[0]);
    const digits = part.replace(/\D/g, '');
    if (digits.length < 5) {
      return { status: 0, ok: false, statusText: 'รูปแบบเบอร์ SMS ไม่ถูกต้อง', checkType: 'scheme' };
    }
    return { status: 0, ok: true, statusText: 'OK', checkType: 'scheme' };
  }
}

async function checkLink(url) {
  const scheme = getUrlScheme(url);
  if (scheme === 'tel') {
    return { url, ...checkTelScheme(url) };
  }
  if (scheme === 'mailto') {
    return { url, ...checkMailtoScheme(url) };
  }
  if (scheme === 'sms') {
    return { url, ...checkSmsScheme(url) };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit'
    });

    clearTimeout(timeout);

    return {
      url,
      status: res.status,
      ok: res.ok,
      statusText: res.statusText || '',
      checkType: 'http'
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { url, status: 0, ok: false, statusText: 'Timeout', checkType: 'http' };
    }
    return { url, status: 0, ok: false, statusText: err.message, checkType: 'http' };
  }
}

async function runPreChecksAndStart(tabId, branchNumber) {
  checkState[tabId] = { running: true, cancelled: false };

  try {
    const h2Res = await chrome.tabs.sendMessage(tabId, { action: 'checkH2Structure' });
    if (h2Res && h2Res.success && h2Res.results.length > 0) {
      const hr = h2Res.results;
      let hOk = 0, hBroken = 0;
      hr.forEach(r => { if (r.ok) hOk++; else hBroken++; });
      await chrome.storage.local.set({
        [`h2Results_${tabId}`]: {
          results: hr, okCount: hOk, brokenCount: hBroken, total: hr.length
        }
      });
    }

    const anchorRes = await chrome.tabs.sendMessage(tabId, { action: 'checkAnchorLinks' });
    if (anchorRes && anchorRes.success && anchorRes.results.length > 0) {
      const ar = anchorRes.results;
      let aOk = 0, aBroken = 0;
      ar.forEach(r => { if (r.ok) aOk++; else aBroken++; });
      await chrome.storage.local.set({
        [`anchorResults_${tabId}`]: {
          results: ar, okCount: aOk, brokenCount: aBroken, total: ar.length
        }
      });
    }

    try {
      const yearRes = await chrome.tabs.sendMessage(tabId, { action: 'checkYearInContent' });
      if (yearRes && yearRes.success) {
        await chrome.storage.local.set({
          [`yearResults_${tabId}`]: {
            results: yearRes.results || [],
            currentYearResults: yearRes.currentYearResults || [],
            currentYear: yearRes.currentYear || String(new Date().getFullYear()),
            total: (yearRes.results || []).length,
            currentYearCount: yearRes.currentYearCount ?? 0
          }
        });
      }
    } catch {
      // ปีอาจตรวจสอบไม่ได้ (ไม่มี container หรือ content script error)
    }

    try {
      const branchRes = await chrome.tabs.sendMessage(tabId, { action: 'checkBranchInContent', expectedBranch: branchNumber });
      if (branchRes && branchRes.success && branchRes.results) {
        const br = branchRes.results;
        let bOk = 0, bBroken = 0;
        br.forEach(r => { if (r.ok) bOk++; else bBroken++; });
        await chrome.storage.local.set({
          [`branchResults_${tabId}`]: {
            results: br,
            okCount: bOk,
            brokenCount: bBroken,
            total: br.length
          }
        });
      }
    } catch {
      // สาขาอาจตรวจสอบไม่ได้
    }

    const linksRes = await chrome.tabs.sendMessage(tabId, { action: 'collectLinks' });

    startLinkFetch(tabId, linksRes);

    return { ready: true };
  } catch (err) {
    checkState[tabId].running = false;
    delete checkState[tabId];
    return { ready: false, error: err.message };
  }
}

async function startLinkFetch(tabId, linksRes) {
  try {
    if (!linksRes || !linksRes.success || linksRes.links.length === 0) {
      checkState[tabId].running = false;
      await chrome.storage.local.set({
        [`linkProgress_${tabId}`]: { status: 'done', current: 0, total: 0 }
      });
      return;
    }

    const links = linksRes.links;
    const total = links.length;
    let okCount = 0;
    let brokenCount = 0;
    const results = [];

    await chrome.storage.local.set({
      [`linkProgress_${tabId}`]: { status: 'checking', current: 0, total }
    });

    for (let i = 0; i < total; i++) {
      if (checkState[tabId]?.cancelled) {
        await chrome.storage.local.set({
          [`linkProgress_${tabId}`]: { status: 'cancelled', current: i, total }
        });
        checkState[tabId].running = false;
        delete checkState[tabId];
        return;
      }

      const link = links[i];
      const result = await checkLink(link.url);

      if (checkState[tabId]?.cancelled) {
        await chrome.storage.local.set({
          [`linkProgress_${tabId}`]: { status: 'cancelled', current: i + 1, total }
        });
        checkState[tabId].running = false;
        delete checkState[tabId];
        return;
      }

      const entry = { ...link, ...result };
      results.push(entry);

      if (result.ok) {
        okCount++;
      } else {
        brokenCount++;
      }

      await chrome.storage.local.set({
        [`linkProgress_${tabId}`]: { status: 'checking', current: i + 1, total },
        [`linkResults_${tabId}`]: { results, okCount, brokenCount, total }
      });
    }

    await chrome.storage.local.set({
      [`linkProgress_${tabId}`]: { status: 'done', current: total, total },
      [`linkResults_${tabId}`]: { results, okCount, brokenCount, total }
    });
  } catch (err) {
    await chrome.storage.local.set({
      [`linkProgress_${tabId}`]: { status: 'error', error: err.message }
    });
  }

  if (checkState[tabId]) checkState[tabId].running = false;
  delete checkState[tabId];
}
