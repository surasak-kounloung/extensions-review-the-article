const TAG_CATEGORIES = {
  structure: ['html', 'head', 'body', 'div', 'span', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav', 'template', 'slot'],
  header: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  text: ['p', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'br', 'hr', 'blockquote', 'q', 'cite', 'code', 'pre', 'abbr', 'mark', 'del', 'ins', 'wbr', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'dfn', 'kbd', 'samp', 'var', 'time', 'data'],
  link: ['a'],
  media: ['img', 'video', 'audio', 'source', 'picture', 'figure', 'figcaption', 'canvas', 'svg', 'iframe', 'embed', 'object', 'map', 'area', 'track'],
  form: ['form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'label', 'fieldset', 'legend', 'datalist', 'output', 'progress', 'meter'],
  table: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
  semantic: ['details', 'summary', 'dialog', 'menu', 'menuitem', 'address', 'hgroup', 'search']
};

const CATEGORY_COLORS = {
  structure: { badge: '#0e7490' },
  header:    { badge: '#6fc3eb' },
  text:      { badge: '#166534' },
  link:      { badge: '#2953e9' },
  media:     { badge: '#86198f' },
  form:      { badge: '#92400e' },
  table:     { badge: '#115e59' },
  semantic:  { badge: '#9f1239' },
  other:     { badge: '#334155' }
};

function getCategory(tagName) {
  const tag = tagName.toLowerCase();
  for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
    if (tags.includes(tag)) return category;
  }
  return 'other';
}

let isActive = false;
let styleEl = null;

const SKIP_TAGS = ['script', 'style', 'link', 'meta', 'noscript', 'div', 'span', 'picture', 'source', 'thead', 'tbody', 'tr', 'th', 'td'];

function injectStyles() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.id = 'html-reviewer-styles';
  styleEl.textContent = `
    .htr-tag-badge {
      position: absolute !important;
      top: -20px !important;
      left: -2px !important;
      width: auto !important;
      min-height: 20px;
      padding: 1px 6px !important;
      margin: 0;
      font-family: Consolas, 'Courier New', monospace !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      line-height: 1.5 !important;
      color: #fff !important;
      border: 0;
      background: var(--htr-badge-color, #7c6ff7) !important;
      pointer-events: none !important;
      z-index: 9999 !important;
      white-space: nowrap !important;
    }
    .htr-tag-badge.figure.img {
      left: 60px !important;
    }
    .htr-tag-badge.figure.a {
      top: -39px !important;
    }
    .htr-tag-badge.figure.a.img {
      top: -20px !important;
    }
    .htr-tag-badge.p.a {
      top: -22px !important;
    }
    .htr-tag-badge.li.a {
      top: -22px !important;
    }
    .listmenu .htr-tag-badge.li.a {
      top: -20px !important;
      left: 36px !important;
    }
    .htr-tag-badge.li.strong {
      top: -22px !important;
    }
    .htr-tag-badge.p.strong {
      top: -22px !important;
    }
    .vsq-readmore .htr-tag-badge.p.strong {
      top: -35px !important;
    }
    .wp-block-kadence-accordion .htr-tag-badge.h2.button, 
    .wp-block-kadence-accordion .htr-tag-badge.h3.button {
      top: -21px !important;
      left: 32px !important;
    }
    .wp-block-separator + .htr-tag-badge.hr, 
    hr + .htr-tag-badge.hr {
      position: relative !important;
      display: inline-block;
      top: 0 !important;
      margin-top: -50px;
    }
    .wp-block-embed.wp-block-embed-youtube .rll-youtube-player > div {
      position: absolute !important;
      height: 100% !important;
      width: 100% !important;
    }
    .htr-tag-badge.figure.table {
      top: -21px !important;
      left: 61px !important;
    }
    .htr-tag-badge.table.strong {
      left: 0 !important;
    }
  `;
  document.head.appendChild(styleEl);
}

function removeStyles() {
  if (styleEl) { styleEl.remove(); styleEl = null; }
}

function activate() {
  if (isActive) return { success: true, alreadyActive: true };

  const container = document.querySelector('.site-content');
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="site-content" ในหน้าเว็บนี้' };
  }

  isActive = true;
  injectStyles();

  const elements = container.querySelectorAll('*');
  elements.forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.includes(tag)) return;

    const cat = getCategory(tag);
    const colors = CATEGORY_COLORS[cat];

    const VOID_TAGS = ['img', 'br', 'hr', 'input', 'source', 'embed', 'track', 'col', 'area', 'wbr'];
    const isVoid = VOID_TAGS.includes(tag);

    const parent = isVoid ? el.parentElement : el;
    if (parent && (parent.style.position === '' || parent.style.position === 'static')) {
      parent.dataset.htrOrigPos = parent.style.position || '';
      parent.style.position = 'relative';
    }

    const parentPath = [];
    let node = el.parentElement;
    while (node && !node.classList.contains('site-content')) {
      const pTag = node.tagName.toLowerCase();
      if (!SKIP_TAGS.includes(pTag)) parentPath.unshift(pTag);
      node = node.parentElement;
    }

    const HIDE_CLASS_TAGS = ['figure', 'figcaption', 'img', 'hr', 'thead', 'tbody', 'tr', 'th', 'td'];
    const HIDE_CLASSES = [
      'wp-block-heading', 
      'wp-block-list', 
      'has-text-align-left', 
      'has-text-align-center', 
      'has-text-align-right', 
      'wp-block-button__link', 
      'wp-element-button', 
      'kt-accordion-header-wrap', 
      'kt-blocks-accordion-header', 
      'kt-acccordion-button-label-show', 
      'kt-accordion-panel-active', 
      'wp-block-quote', 
      'is-layout-flow', 
      'wp-block-quote-is-layout-flow',
      'wp-block-table',
      'has-fixed-layout',
      'play',
      'vsq-sp-list', 
      'list-indent'
    ];

    const elClasses = (!HIDE_CLASS_TAGS.includes(tag) && el.className)
      ? String(el.className).split(/\s+/).filter(c => c && !c.startsWith('htr-') && !HIDE_CLASSES.includes(c)).join('.')
      : '';
    const classStr = elClasses ? ` .${elClasses}` : '';

    const badge = document.createElement('span');
    badge.className = `htr-tag-badge ${parentPath.join(' ')} ${tag}`.trim();
    if (tag === 'a' && el.getAttribute('href')) {
      badge.textContent = `<a${classStr}> ${el.getAttribute('href')}`;
    } else if (tag === 'img' && el.getAttribute('alt')) {
      badge.textContent = `<img${classStr}> alt="${el.getAttribute('alt')}"`;
    } else {
      badge.textContent = `<${tag}${classStr}>`;
    }
    badge.style.setProperty('--htr-badge-color', colors.badge);

    if (isVoid) {
      el.after(badge);
    } else {
      el.appendChild(badge);
    }
  });

  return { success: true, count: elements.length };
}

function deactivate() {
  if (!isActive) return { success: true };

  isActive = false;

  document.querySelectorAll('.htr-tag-badge').forEach(b => b.remove());

  document.querySelectorAll('[data-htr-orig-pos]').forEach(el => {
    el.style.position = el.dataset.htrOrigPos || '';
    delete el.dataset.htrOrigPos;
    el.style.removeProperty('--htr-badge-color');
  });

  removeStyles();

  return { success: true };
}

function collectLinks() {
  const container = document.querySelector('.site-content');
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="site-content"', links: [] };
  }

  const anchors = container.querySelectorAll('a[href]');
  const seen = new Set();
  const links = [];

  const SKIP_DOMAINS = ['action=edit', 'm.me', 'facebook.com', 'x.com', 'lin.ee'];

  anchors.forEach(a => {
    const href = a.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('#') || href === '') return;
    if (SKIP_DOMAINS.some(d => href.includes(d))) return;
    if (seen.has(href)) return;
    seen.add(href);
    const clone = a.cloneNode(true);
    clone.querySelectorAll('.htr-tag-badge').forEach(b => b.remove());
    links.push({ url: href, text: clone.textContent.trim().substring(0, 80) });
  });

  return { success: true, links };
}

function checkAnchorLinks() {
  const container = document.querySelector('.site-content');
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="site-content"', results: [] };
  }

  const anchors = container.querySelectorAll('a[href^="#"]');
  const seen = new Set();
  const results = [];

  anchors.forEach(a => {
    const raw = a.getAttribute('href');
    if (!raw || raw === '#') return;
    if (seen.has(raw)) return;
    seen.add(raw);

    const targetId = raw.substring(1);
    const targetEl = document.getElementById(targetId)
      || document.querySelector(`[name="${CSS.escape(targetId)}"]`);

    const clone = a.cloneNode(true);
    clone.querySelectorAll('.htr-tag-badge').forEach(b => b.remove());
    const text = clone.textContent.trim().substring(0, 80);

    results.push({
      url: raw,
      text,
      ok: !!targetEl,
      status: targetEl ? 'OK' : 'NOT FOUND',
      statusText: targetEl ? 'พบ element เป้าหมาย' : 'ไม่พบ element id="' + targetId + '"'
    });
  });

  return { success: true, results };
}

function checkH2Structure() {
  const container = document.querySelector('.site-content');
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="site-content"', results: [] };
  }

  const h2List = container.querySelectorAll('h2');
  const results = [];

  h2List.forEach((h2, index) => {
    const clone = h2.cloneNode(true);
    clone.querySelectorAll('.htr-tag-badge').forEach(b => b.remove());
    const text = clone.textContent.trim().substring(0, 80);
    const num = index + 1;

    const prevEl = h2.previousElementSibling;
    const hasPs2id = prevEl && prevEl.matches('div.wp-block-ps2id-block-target');

    let hasHr = false;
    if (hasPs2id) {
      const prevPrev = prevEl.previousElementSibling;
      hasHr = prevPrev && prevPrev.matches('hr, .wp-block-separator');
    } else if (prevEl) {
      hasHr = prevEl.matches('hr, .wp-block-separator');
    }

    let status, statusText;
    if (hasHr) {
      status = 'OK';
      statusText = hasPs2id ? 'มี ps2id + hr ครบ' : 'มี <hr> ก่อนหน้า (ไม่มี ps2id)';
    } else if (hasPs2id && !hasHr) {
      status = 'NO HR';
      statusText = 'มี ps2id แต่ไม่มี <hr> ก่อนหน้า';
    } else {
      status = 'NO PS2ID';
      statusText = 'ไม่มี <hr> และไม่มี <div class="wp-block-ps2id-block-target"> ก่อนหน้า';
    }

    results.push({
      index: num,
      text,
      ok: hasHr,
      hasPs2id,
      hasHr,
      status,
      statusText
    });
  });

  return { success: true, results };
}

function scrollToH2(index) {
  const container = document.querySelector('.site-content');
  if (!container) return { success: false };

  const h2List = container.querySelectorAll('h2');
  const h2 = h2List[index - 1];
  if (!h2) return { success: false };

  document.querySelectorAll('.htr-highlight-broken').forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
    el.classList.remove('htr-highlight-broken');
  });

  h2.scrollIntoView({ behavior: 'smooth', block: 'center' });
  h2.style.outline = '3px solid #fbbf24';
  h2.style.outlineOffset = '3px';
  h2.style.backgroundColor = 'rgba(251, 191, 36, 0.15)';
  h2.classList.add('htr-highlight-broken');

  setTimeout(() => {
    h2.style.removeProperty('outline');
    h2.style.removeProperty('outline-offset');
    h2.style.removeProperty('background-color');
    h2.classList.remove('htr-highlight-broken');
  }, 5000);

  return { success: true };
}

function scrollToLink(url) {
  const container = document.querySelector('.site-content');
  if (!container) return { success: false };

  document.querySelectorAll('.htr-highlight-broken').forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
    el.classList.remove('htr-highlight-broken');
  });

  const anchor = container.querySelector(`a[href="${CSS.escape(url)}"]`)
    || container.querySelector(`a[href$="${CSS.escape(url)}"]`);

  if (!anchor) return { success: false };

  anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  anchor.style.outline = '3px solid #fb7185';
  anchor.style.outlineOffset = '3px';
  anchor.style.backgroundColor = 'rgba(251, 113, 133, 0.2)';
  anchor.classList.add('htr-highlight-broken');

  setTimeout(() => {
    anchor.style.removeProperty('outline');
    anchor.style.removeProperty('outline-offset');
    anchor.style.removeProperty('background-color');
    anchor.classList.remove('htr-highlight-broken');
  }, 5000);

  return { success: true };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'activate') {
    sendResponse(activate());
  } else if (request.action === 'deactivate') {
    sendResponse(deactivate());
  } else if (request.action === 'getStatus') {
    sendResponse({ active: isActive });
  } else if (request.action === 'collectLinks') {
    sendResponse(collectLinks());
  } else if (request.action === 'checkAnchorLinks') {
    sendResponse(checkAnchorLinks());
  } else if (request.action === 'scrollToLink') {
    sendResponse(scrollToLink(request.url));
  } else if (request.action === 'checkH2Structure') {
    sendResponse(checkH2Structure());
  } else if (request.action === 'scrollToH2') {
    sendResponse(scrollToH2(request.index));
  }
  return true;
});
