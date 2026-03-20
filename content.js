const TAG_CATEGORIES = {
  structure: ['html', 'head', 'body', 'div', 'span', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav', 'template', 'slot'],
  heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  text: ['p', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'br', 'hr', 'blockquote', 'q', 'cite', 'code', 'pre', 'abbr', 'mark', 'del', 'ins', 'wbr', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'dfn', 'kbd', 'samp', 'var', 'time', 'data'],
  link: ['a'],
  media: ['img', 'video', 'audio', 'source', 'picture', 'figure', 'figcaption', 'canvas', 'svg', 'iframe', 'embed', 'object', 'map', 'area', 'track'],
  form: ['form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'label', 'fieldset', 'legend', 'datalist', 'output', 'progress', 'meter'],
  table: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
  semantic: ['details', 'summary', 'dialog', 'menu', 'menuitem', 'address', 'hgroup', 'search']
};

const CATEGORY_COLORS = {
  structure: { badge: 'rgba(14, 116, 144, 0.7)' },
  heading:    { badge: 'rgba(48, 160, 213, 0.7)' },
  text:      { badge: 'rgba(22, 101, 52, 0.7)' },
  link:      { badge: 'rgba(41, 83, 233, 0.7)' },
  media:     { badge: 'rgba(134, 25, 143, 0.7)' },
  form:      { badge: 'rgba(146, 64, 14, 0.7)' },
  table:     { badge: 'rgba(17, 94, 89, 0.7)' },
  semantic:  { badge: 'rgba(159, 18, 57, 0.7)' },
  other:     { badge: 'rgba(51, 65, 85, 0.7)' }
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

const SKIP_TAGS = ['script', 'style', 'link', 'meta', 'noscript', 'div', 'span', 'i', 'picture', 'source', 'thead', 'tbody', 'tr', 'th', 'td'];
const CONTENT_SELECTOR = '.entry-content, .blog-wrapper, .cs-site-content';
const CONTENT_CLASSES = ['entry-content', 'blog-wrapper', 'cs-site-content'];

function getContentContainer() {
  return document.querySelector(CONTENT_SELECTOR);
}
function isContentContainer(el) {
  return el && CONTENT_CLASSES.some(c => el.classList.contains(c));
}

function injectStyles() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.id = 'html-reviewer-styles';
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@100;200;300;400;500;600;700&family=Kanit:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Sarabun:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap');

    .htr-tag-badge {
      position: absolute !important;
      top: calc(-15px + var(--htr-depth-offset, 0px)) !important;
      left: -2px !important;
      width: auto !important;
      max-width: unset;
      min-height: 20px;
      padding: 1px 6px 2px !important;
      margin: 0;
      font-family: "Sarabun", sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1.4 !important;
      color: #fff !important;
      border: 0 !important;
      background: var(--htr-badge-color, #7c6ff7) !important;
      z-index: 995 !important;
      white-space: nowrap !important;
    }
    .wp-block-separator + .htr-tag-badge.hr, 
    hr + .htr-tag-badge.hr {
      position: relative !important;
      display: block;
      max-width: 38px;
      top: calc(9px + var(--htr-depth-offset, 0px)) !important;
      margin-top: -60px;
    }
    .htr-tag-badge.br {
      position: relative !important;
      display: block;
      max-width: 35px;
      top: calc(-9px + var(--htr-depth-offset, 0px)) !important;
      margin-top: -20px;
    }
    strong > .htr-tag-badge.br, 
    b > .htr-tag-badge.br, 
    em > .htr-tag-badge.br, 
    u > .htr-tag-badge.br {
      top: calc(-28px + var(--htr-depth-offset, 0px)) !important;
    }
    p > mark > .htr-tag-badge.br {
      top: calc(-30px + var(--htr-depth-offset, 0px)) !important;
    }
    figure > figcaption > .htr-tag-badge.figcaption:not(.br) {
      top: calc(-28px + var(--htr-depth-offset, 0px)) !important;
    }
    figcaption > .htr-tag-badge.br {
      top: calc(-31px + var(--htr-depth-offset, 0px)) !important;
    }
    figcaption > em > .htr-tag-badge {
      top: calc(-36px + var(--htr-depth-offset, 0px)) !important;
    }
    figcaption > em > .htr-tag-badge.em.br {
      top: calc(-48px + var(--htr-depth-offset, 0px)) !important;
    }
    li > .htr-tag-badge {
      top: calc(-34px + var(--htr-depth-offset, 0px)) !important;
      left: -11px !important;
    }
    li > a > .htr-tag-badge {
      top: calc(-55px + var(--htr-depth-offset, 0px)) !important;
    }
    li > ul > .htr-tag-badge, 
    li > ol > .htr-tag-badge {
      top: calc(-52px + var(--htr-depth-offset, 0px)) !important;
      left: -11px !important;
    }
    li > ul > li > .htr-tag-badge, 
    li > ol > li > .htr-tag-badge {
      top: calc(-71px + var(--htr-depth-offset, 0px)) !important;
      left: -5px !important;
    }
    li > ul > li > a > .htr-tag-badge, 
    li > ol > li > a > .htr-tag-badge {
      top: calc(-92px + var(--htr-depth-offset, 0px)) !important;
    }
    li > ul > li > ul > .htr-tag-badge, 
    li > ol > li > ol > .htr-tag-badge, 
    li > ul > li > ol > .htr-tag-badge, 
    li > ol > li > ul > .htr-tag-badge {
      top: calc(-90px + var(--htr-depth-offset, 0px)) !important;
      left: -5px !important;
    }
    li > ul > li > ul > li > .htr-tag-badge, 
    li > ol > li > ol > li > .htr-tag-badge, 
    li > ul > li > ol > li > .htr-tag-badge, 
    li > ol > li > ul > li > .htr-tag-badge {
      top: calc(-109px + var(--htr-depth-offset, 0px)) !important;
      left: 1px !important;
    }
    li > ul > li > ul > li > a > .htr-tag-badge, 
    li > ol > li > ol > li > a > .htr-tag-badge, 
    li > ul > li > ol > li > a > .htr-tag-badge, 
    li > ol > li > ul > li > a > .htr-tag-badge {
      top: calc(-130px + var(--htr-depth-offset, 0px)) !important;
    }
    .listmenu > li > a > .htr-tag-badge {
      top: calc(-53px + var(--htr-depth-offset, 0px)) !important;
      left: 22px !important;
    }
    .listmenu > li > ul > li > a > .htr-tag-badge, 
    .listmenu > li > ol > li > a > .htr-tag-badge {
      top: calc(-90px + var(--htr-depth-offset, 0px)) !important;
      left: 28px !important;
    }
    .listmenu > li > ul > li > ul > li > a > .htr-tag-badge, 
    .listmenu > li > ol > li > ol > li > a > .htr-tag-badge, 
    .listmenu > li > ul > li > ol > li > a > .htr-tag-badge, 
    .listmenu > li > ol > li > ul > li > a > .htr-tag-badge {
      top: calc(-128px + var(--htr-depth-offset, 0px)) !important;
      left: 34px !important;
    }
    li > strong > .htr-tag-badge, 
    li > b > .htr-tag-badge, 
    li > em > .htr-tag-badge, 
    li > u > .htr-tag-badge {
      top: calc(-35px + var(--htr-depth-offset, 0px)) !important;
    }
    table th > strong > .htr-tag-badge, 
    table td > strong > .htr-tag-badge {
      top: calc(-55px + var(--htr-depth-offset, 0px)) !important;
    }
    table th > ul > .htr-tag-badge, 
    table td > ul > .htr-tag-badge, 
    table th > ol > .htr-tag-badge, 
    table td > ol > .htr-tag-badge {
      top: calc(-55px + var(--htr-depth-offset, 0px)) !important;
      left: -27px !important;
    }
    table th > ul > li > .htr-tag-badge, 
    table td > ul > li > .htr-tag-badge, 
    table th > ol > li > .htr-tag-badge, 
    table td > ol > li > .htr-tag-badge {
      top: calc(-74px + var(--htr-depth-offset, 0px)) !important;
    }
    p > a > .htr-tag-badge {
      top: calc(-36px + var(--htr-depth-offset, 0px)) !important;
    }
    p > mark > .htr-tag-badge {
      top: calc(-32px + var(--htr-depth-offset, 0px)) !important;
    }
    p > mark > strong > .htr-tag-badge, 
    p > mark > b > .htr-tag-badge,  
    p > mark > em > .htr-tag-badge, 
    p > mark > u > .htr-tag-badge {
      top: calc(-35px + var(--htr-depth-offset, 0px)) !important;
    }
    blockquote > p > .htr-tag-badge {
      top: calc(-35px + var(--htr-depth-offset, 0px)) !important;
    }
    blockquote > p > a > .htr-tag-badge {
      top: calc(-56px + var(--htr-depth-offset, 0px)) !important;
    }
    /****************************************************/
    /****** Fixed website when program is running ******/
    /**************************************************/
    .wp-block-embed.wp-block-embed-youtube .rll-youtube-player > div, 
    .wp-block-embed iframe {
      position: absolute !important;
      height: 100% !important;
      width: 100% !important;
    }
    .vsq-video-frame .video-play-button {
      position: absolute !important;
    }
    .kb-splide .splide__arrow, 
    .kb-splide .splide__pagination, 
    .kb-splide ul.splide__pagination.splide__pagination {
      position: absolute !important;
    }
    .kb-splide .splide__pagination li button .htr-tag-badge {
      display: none !important;
    }
  `;
  document.head.appendChild(styleEl);
}

function removeStyles() {
  if (styleEl) { styleEl.remove(); styleEl = null; }
}

function activate() {
  if (isActive) return { success: true, alreadyActive: true };

  const container = getContentContainer();
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="entry-content" หรือ "blog-wrapper" หรือ "cs-site-content" ในหน้าเว็บนี้' };
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
    while (node && !isContentContainer(node)) {
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
      'icon-play', 
      'video-play-button', 
      'vsq-sp-list', 
      'list-indent', 
      'vsq-font-family', 
      'vsq-size-font',
      'multisubtext',
      'listmenu',
      'two-column',
      '__mPS2id',
      '_mPS2id-h',
      'has-inline-color',
      'splide__pagination',
      'slick-dots', 
      'splide__pagination--ltr', 
      'splide__arrow', 
      'splide__arrow--prev', 
      'slick-prev', 
      'splide__arrow--next', 
      'slick-next'
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
    const depth = parentPath.length;
    badge.style.setProperty('--htr-depth-offset', depth ? `${depth * 19}px` : '0px');

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
  document.querySelectorAll('.htr-year-matched').forEach(el => {
    delete el.dataset.htrYearMatch;
    el.classList.remove('htr-year-matched');
  });

  document.querySelectorAll('[data-htr-orig-pos]').forEach(el => {
    el.style.position = el.dataset.htrOrigPos || '';
    delete el.dataset.htrOrigPos;
    el.style.removeProperty('--htr-badge-color');
  });

  removeStyles();

  return { success: true };
}

function collectLinks() {
  const container = getContentContainer();
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="entry-content" หรือ "blog-wrapper" หรือ "cs-site-content"', links: [] };
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
  const container = getContentContainer();
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="entry-content" หรือ "blog-wrapper" หรือ "cs-site-content"', results: [] };
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
  const container = getContentContainer();
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="entry-content" หรือ "blog-wrapper" หรือ "cs-site-content"', results: [] };
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

function checkYearInContent() {
  const container = getContentContainer();
  if (!container) {
    return { success: false, error: 'ไม่พบ element ที่มี class="entry-content" หรือ "blog-wrapper" หรือ "cs-site-content"', results: [] };
  }

  const currentYear = new Date().getFullYear();
  const currentYearStr = String(currentYear);
  const results = [];
  let matchIndex = 0;
  let currentYearCount = 0;

  container.querySelectorAll('[data-htr-year-ids]').forEach(el => delete el.dataset.htrYearIds);
  container.querySelectorAll('[data-htr-current-year-ids]').forEach(el => delete el.dataset.htrCurrentYearIds);

  const yearRegex = /\b(19\d{2}|20\d{2})\b/g;
  const currentYearResults = [];
  let currentYearIndex = 0;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  let textNode;
  while ((textNode = walker.nextNode())) {
    const parent = textNode.parentElement;
    if (!parent || SKIP_TAGS.includes(parent.tagName.toLowerCase())) continue;

    const text = textNode.textContent;
    let match;
    yearRegex.lastIndex = 0;
    while ((match = yearRegex.exec(text)) !== null) {
      const yearStr = match[0];
      const yearNum = parseInt(yearStr, 10);
      if (yearNum === currentYear) {
        currentYearIndex++;
        currentYearCount++;
        const pos = match.index;
        const start = Math.max(0, pos - 30);
        const end = Math.min(text.length, pos + yearStr.length + 30);
        const context = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
        const clone = parent.cloneNode(true);
        clone.querySelectorAll('.htr-tag-badge').forEach(b => b.remove());
        const parentText = clone.textContent.trim().substring(0, 100);

        if (parent.dataset.htrCurrentYearIds) {
          parent.dataset.htrCurrentYearIds += ',' + currentYearIndex;
        } else {
          parent.dataset.htrCurrentYearIds = String(currentYearIndex);
        }

        currentYearResults.push({
          index: currentYearIndex,
          year: yearStr,
          context: (context || parentText).trim(),
          tagName: parent.tagName.toLowerCase(),
          isCurrentYear: true,
          status: 'ปีปัจจุบัน'
        });
        continue;
      }

      matchIndex++;
      const pos = match.index;
      const start = Math.max(0, pos - 30);
      const end = Math.min(text.length, pos + yearStr.length + 30);
      const context = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
      const clone = parent.cloneNode(true);
      clone.querySelectorAll('.htr-tag-badge').forEach(b => b.remove());
      const parentText = clone.textContent.trim().substring(0, 100);

      if (parent.dataset.htrYearIds) {
        parent.dataset.htrYearIds += ',' + matchIndex;
      } else {
        parent.dataset.htrYearIds = String(matchIndex);
      }

      results.push({
        index: matchIndex,
        year: yearStr,
        context: (context || parentText).trim(),
        tagName: parent.tagName.toLowerCase(),
        ok: true,
        status: 'พบ'
      });
    }
  }

  return { success: true, results, currentYearResults, currentYear: currentYearStr, currentYearCount };
}

function scrollToYear(index) {
  const container = getContentContainer();
  if (!container) return { success: false };

  const all = Array.from(container.querySelectorAll('[data-htr-year-ids]'));
  const target = all.find(el => {
    const ids = (el.dataset.htrYearIds || '').split(',').map(Number);
    return ids.includes(Number(index));
  });
  if (!target) return { success: false };

  document.querySelectorAll('.htr-highlight-broken').forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
    el.classList.remove('htr-highlight-broken');
  });

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.style.outline = '3px solid #fbbf24';
  target.style.outlineOffset = '3px';
  target.style.backgroundColor = 'rgba(251, 191, 36, 0.15)';
  target.classList.add('htr-highlight-broken');

  setTimeout(() => {
    target.style.removeProperty('outline');
    target.style.removeProperty('outline-offset');
    target.style.removeProperty('background-color');
    target.classList.remove('htr-highlight-broken');
  }, 5000);

  return { success: true };
}

function scrollToCurrentYear(index) {
  const container = getContentContainer();
  if (!container) return { success: false };

  const all = Array.from(container.querySelectorAll('[data-htr-current-year-ids]'));
  const target = all.find(el => {
    const ids = (el.dataset.htrCurrentYearIds || '').split(',').map(Number);
    return ids.includes(Number(index));
  });
  if (!target) return { success: false };

  document.querySelectorAll('.htr-highlight-broken').forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
    el.classList.remove('htr-highlight-broken');
  });

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.style.outline = '3px solid #22c55e';
  target.style.outlineOffset = '3px';
  target.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
  target.classList.add('htr-highlight-broken');

  setTimeout(() => {
    target.style.removeProperty('outline');
    target.style.removeProperty('outline-offset');
    target.style.removeProperty('background-color');
    target.classList.remove('htr-highlight-broken');
  }, 5000);

  return { success: true };
}

function scrollToH2(index) {
  const container = getContentContainer();
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

function normalizeUrlForMatch(u) {
  try {
    const parsed = new URL(u);
    let path = parsed.pathname.replace(/\/$/, '') || '/';
    return parsed.origin + path + (parsed.search || '');
  } catch {
    return u;
  }
}

function scrollToLink(url, textHint) {
  const container = getContentContainer();
  if (!container) return { success: false };

  document.querySelectorAll('.htr-highlight-broken').forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
    el.classList.remove('htr-highlight-broken');
  });

  const anchors = Array.from(container.querySelectorAll('a[href]'));
  let anchor = null;

  const isAnchorLink = (u) => typeof u === 'string' && (u === '#' || u.startsWith('#'));
  const rawHref = String(url || '').trim();
  const normHref = rawHref.startsWith('#') ? rawHref : '#' + rawHref;

  if (isAnchorLink(rawHref) || isAnchorLink(normHref)) {
    anchor = anchors.find(a => {
      const aRaw = a.getAttribute('href') || '';
      const aNorm = aRaw.startsWith('#') ? aRaw : (aRaw ? '#' + aRaw : '');
      return aNorm === normHref || aRaw === rawHref;
    });
  }

  if (!anchor) {
    const normTarget = normalizeUrlForMatch(url);
    anchor = anchors.find(a => {
      try {
        if (a.href === url) return true;
        if (new URL(a.href).href === new URL(url).href) return true;
        if (normalizeUrlForMatch(a.href) === normTarget) return true;
        return false;
      } catch {
        return a.href === url;
      }
    });
  }

  if (!anchor && textHint) {
    const hint = String(textHint).trim().toLowerCase().substring(0, 60);
    anchor = anchors.find(a => {
      const t = (a.textContent || '').trim().toLowerCase().substring(0, 60);
      return t && (t === hint || t.includes(hint) || hint.includes(t));
    });
  }

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
    sendResponse(scrollToLink(request.url, request.text));
  } else if (request.action === 'checkH2Structure') {
    sendResponse(checkH2Structure());
  } else if (request.action === 'scrollToH2') {
    sendResponse(scrollToH2(request.index));
  } else if (request.action === 'checkYearInContent') {
    sendResponse(checkYearInContent());
  } else if (request.action === 'scrollToYear') {
    sendResponse(scrollToYear(request.index));
  } else if (request.action === 'scrollToCurrentYear') {
    sendResponse(scrollToCurrentYear(request.index));
  }
  return true;
});
