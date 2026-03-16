const checkState = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startLinkCheck') {
    runPreChecksAndStart(request.tabId).then(sendResponse);
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

async function checkLink(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (res.type === 'opaque') {
      return { url, status: 0, ok: true, statusText: 'OK (no-cors)' };
    }

    return { url, status: res.status, ok: res.ok, statusText: res.statusText };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { url, status: 0, ok: false, statusText: 'Timeout' };
    }
    return { url, status: 0, ok: false, statusText: err.message };
  }
}

async function runPreChecksAndStart(tabId) {
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
