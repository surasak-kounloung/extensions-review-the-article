/**
 * ดึงบล็อกเนื้อหา (หัวข้อ / ย่อหน้า / รายการ / blockquote / ตาราง) จาก root element
 * และเปรียบเทียบลำดับกับอีกชุดหนึ่ง — ใช้ร่วมกับ popup (HTML จาก Mammoth) และ content script (DOM หน้าเว็บ)
 */
(function (global) {
  'use strict';

  var BLOCK_TAGS = {
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    p: 'paragraph',
    blockquote: 'blockquote',
    figcaption: 'caption',
    ul: 'list',
    ol: 'list',
    table: 'table'
  };

  function normalizeText(s) {
    if (s == null) return '';
    return String(s)
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** รูปแบบเดียวกับ isDocxAltMetaBlock — meta จาก Word draft */
  var DOCX_ALT_META_PREFIX = /^alt\s*:\s*/i;
  var DOCX_PARAGRAPH_HTTPS_PREFIX = /^https:/i;

  function stripBadges(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll('.htr-tag-badge').forEach(function (b) {
      b.remove();
    });
    return clone;
  }

  /**
   * ข้อความสำหรับเทียบ: ตัดลิงก์ออก เหลือแต่ข้อความที่มองเห็น (ลดเพี้ยนเมื่อ href/โครงสร้าง <a> ต่างกัน)
   */
  function elementTextForCompare(el) {
    if (!el) return '';
    var clone = stripBadges(el);
    var doc = clone.ownerDocument || (typeof document !== 'undefined' ? document : null);
    var node;
    if (doc) {
      while ((node = clone.querySelector('a'))) {
        var tn = doc.createTextNode(node.textContent || '');
        if (node.parentNode) node.parentNode.replaceChild(tn, node);
      }
    }
    return normalizeText(clone.textContent);
  }

  /** ตัดแท็กสื่อภายใน <table> — ลด base64/รูปจาก Word ที่ไม่ควรเข้า key หรือ debug HTML */
  function stripTableSubtreeMedia(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('img, picture, source, svg, video, iframe, object, noscript').forEach(function (n) {
      n.remove();
    });
  }

  /** ลบ <p> ที่ขึ้นต้นด้วย "alt :" (draft คำอธิบายรูป) ภายใน <table> — ไม่ใช่เนื้อหาที่เทียบกับเว็บ */
  function stripDocxTableAltDirectiveParagraphs(tableRoot) {
    if (!tableRoot || !tableRoot.querySelectorAll) return;
    tableRoot.querySelectorAll('p').forEach(function (p) {
      var t = normalizeText(p.textContent || '');
      if (DOCX_ALT_META_PREFIX.test(t)) p.remove();
    });
  }

  var DOCX_NOTE_TO_WRITER_TABLE_PREFIX = /^note\s+to\s+writer\b/i;

  /**
   * ตารางคำแนะนำนักเขียนใน Word — ย่อหน้าแรกที่มีข้อความขึ้นต้นด้วย "Note to Writer"
   * ไม่นำไปเทียบและไม่ใส่ใน HTML หลังตัด/กรอง (ไม่เข้า blocks/elements)
   */
  function isDocxNoteToWriterTable(tableEl) {
    if (!tableEl || !tableEl.querySelectorAll) return false;
    if (tableEl.tagName && tableEl.tagName.toLowerCase() !== 'table') return false;
    var first = '';
    var ps = tableEl.querySelectorAll('p');
    var i;
    for (i = 0; i < ps.length; i++) {
      var t = normalizeText(ps[i].textContent || '');
      if (t) {
        first = t;
        break;
      }
    }
    if (!first) {
      var cells = tableEl.querySelectorAll('th, td');
      for (i = 0; i < cells.length; i++) {
        var ct = normalizeText(cells[i].textContent || '');
        if (ct) {
          first = ct;
          break;
        }
      }
    }
    return first ? DOCX_NOTE_TO_WRITER_TABLE_PREFIX.test(first) : false;
  }

  /**
   * ข้อความในตารางสำหรับเทียบ: เหมือน elementTextForCompare แต่ไม่นับรูป/สื่อในตาราง
   * (Mammoth มักฝัง data: URI ใน <img> ทำให้ debug หนักและไม่ควรเป็นส่วนเทียบ)
   */
  function elementTextForCompareTable(el) {
    if (!el) return '';
    var clone = stripBadges(el);
    stripTableSubtreeMedia(clone);
    stripDocxTableAltDirectiveParagraphs(clone);
    var doc = clone.ownerDocument || (typeof document !== 'undefined' ? document : null);
    var node;
    if (doc) {
      while ((node = clone.querySelector('a'))) {
        var tn = doc.createTextNode(node.textContent || '');
        if (node.parentNode) node.parentNode.replaceChild(tn, node);
      }
    }
    return normalizeText(clone.textContent);
  }

  /**
   * ข้อความที่ยังอ่านได้หลังตัดแท็กสื่อและ noscript — ไม่นับ alt ของรูป
   * (ใช้ตัดสินว่า figure/ลิงก์เป็นแบนเนอร์รูปล้วนหรือไม่; เว้นวรรคระหว่างแท็กอย่างเดียวไม่ถือว่ามีเนื้อหา)
   */
  function subtreeTextExcludingMedia(el) {
    if (!el || !el.cloneNode) return '';
    var c = el.cloneNode(true);
    c.querySelectorAll('img, picture, source, svg, video, iframe, object, noscript').forEach(function (n) {
      n.remove();
    });
    var pass;
    for (pass = 0; pass < 3; pass++) {
      c.querySelectorAll('a').forEach(function (a) {
        if (!normalizeText(a.textContent || '')) a.remove();
      });
    }
    return normalizeText(c.textContent || '');
  }

  /** ลิงก์ที่เหลือแต่รูป/สื่อ — ไม่สร้างบล็อกและไม่เดินลงไป (กันหลุดเป็น extra บล็อก) */
  function isStandaloneLinkMediaOnly(el) {
    if (!el || el.tagName.toLowerCase() !== 'a') return false;
    if (!el.getAttribute || !el.getAttribute('href')) return false;
    return !normalizeText(subtreeTextExcludingMedia(el));
  }

  /** ข้อความที่ดูเหมือนนำ HTML ดิบมาเป็นบล็อก (ไม่ควรเทียบ) */
  function looksLikeRawHtmlBlockText(s) {
    if (!s || typeof s !== 'string') return false;
    var t = s.trim();
    if (t.length < 8) return false;
    if (t.charCodeAt(0) !== 60) return false;
    return /<\s*(figure|picture|img|svg|iframe|video|source)\b/i.test(t);
  }

  function filterRawHtmlNoiseBlocks(blocks, elements) {
    var nb = [];
    var ne = [];
    var i;
    for (i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var t = b.type === 'list' ? (b.items || []).join('\n') : b.text || '';
      if (looksLikeRawHtmlBlockText(t)) continue;
      nb.push(b);
      ne.push(elements[i]);
    }
    return { blocks: nb, elements: ne };
  }

  /** ไม่ดึงบล็อกจากส่วนท้ายบทความ / แชร์ / แบนเนอร์ — ลดสัญญาณรบกวนเมื่อเทียบกับ Word */
  var SKIP_SUBTREE_SELECTOR = '.vsq-blogs-related-article, .blog-doctorbanner, #dpsp-content-bottom, .dpsp-content-wrapper, [id^="dpsp-"], .dpsp-networks-btns-wrapper';

  function shouldSkipSubtree(el) {
    if (!el || !el.closest) return false;
    if (el.closest(SKIP_SUBTREE_SELECTOR)) return true;
    /**
     * ข้าม figure ที่เป็นแค่รูป (ลิงก์ + picture/img) — ไม่นำ <img> มาเทียบกับ Word
     * - แถว Kadence หรือ figure.wp-block-image ทั่วไป
     * - ไม่มี figcaption ที่มีข้อความ / ไม่มี p หัวข้อ รายการ ใน figure
     * - หลังตัด img picture ฯลฯ แล้วไม่มีข้อความ (ถ้ามี span ข้อความจริงจะไม่ข้าม)
     */
    var tag = el.tagName && el.tagName.toLowerCase();
    if (tag === 'figure') {
      var fc = el.querySelector('figcaption');
      if (fc && normalizeText(fc.textContent || '')) return false;
      if (el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote')) return false;
      if (subtreeTextExcludingMedia(el)) return false;
      var inKadence = el.closest('.wp-block-kadence-rowlayout, .kb-row-layout-wrap');
      var isWpBlockImage = el.classList && el.classList.contains('wp-block-image');
      if (inKadence || isWpBlockImage) return true;
      return false;
    }
    return false;
  }

  function extractBlocksFromRoot(root) {
    var blocks = [];
    var elements = [];

    function walk(node) {
      if (!node || !node.children) return;
      var children = node.children;
      for (var i = 0; i < children.length; i++) {
        var el = children[i];
        if (shouldSkipSubtree(el)) continue;
        var tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;
        if (tag === 'a' && isStandaloneLinkMediaOnly(el)) continue;

        var kind = BLOCK_TAGS[tag];
        if (kind) {
          if (kind === 'list') {
            var items = [];
            el.querySelectorAll(':scope > li').forEach(function (li) {
              var t = elementTextForCompare(li);
              if (t) items.push(t);
            });
            if (items.length) {
              blocks.push({
                type: 'list',
                ordered: tag === 'ol',
                items: items
              });
              elements.push(el);
            }
          } else if (kind === 'heading') {
            var level = parseInt(tag.charAt(1), 10);
            var ht = elementTextForCompare(el);
            if (ht) {
              blocks.push({ type: 'heading', level: level, text: ht });
              elements.push(el);
            }
          } else if (kind === 'paragraph' || kind === 'blockquote') {
            var pt = elementTextForCompare(el);
            if (!pt) {
              /* skip */
            } else {
              /** ย่อหน้า/อ้างอิงที่เขียนกำกับเป็น H2: / H3: … ให้ถือเป็น heading ระดับเดียวกับเว็บ */
              var phMatch = /^h([1-6])\s*:\s*([\s\S]*)$/i.exec(pt);
              if (phMatch) {
                var phLevel = parseInt(phMatch[1], 10);
                var phRest = normalizeText(phMatch[2] || '');
                if (phRest) {
                  blocks.push({ type: 'heading', level: phLevel, text: phRest });
                  elements.push(el);
                }
              } else {
                blocks.push({
                  type: kind === 'blockquote' ? 'blockquote' : 'paragraph',
                  text: pt
                });
                elements.push(el);
              }
            }
          } else if (kind === 'caption') {
            var cap = elementTextForCompare(el);
            if (!cap) {
              /* skip */
            } else {
              var fcMatch = /^h([1-6])\s*:\s*([\s\S]*)$/i.exec(cap);
              if (fcMatch) {
                var fcLevel = parseInt(fcMatch[1], 10);
                var fcRest = normalizeText(fcMatch[2] || '');
                if (fcRest) {
                  blocks.push({ type: 'heading', level: fcLevel, text: fcRest });
                  elements.push(el);
                }
              } else {
                blocks.push({ type: 'paragraph', text: cap, fromCaption: true });
                elements.push(el);
              }
            }
          } else if (kind === 'table') {
            if (isDocxNoteToWriterTable(el)) {
              continue;
            }
            var tt = elementTextForCompareTable(el);
            if (tt) {
              blocks.push({ type: 'table', text: tt });
              elements.push(el);
            }
          }
        } else if (tag === 'a') {
          /** ลิงก์ยืนตัว (เช่น ปุ่ม Gutenberg: div.wp-block-button > a) — ไม่มีแท็ก p ห่อ จึงไม่ถูกดึงเป็นย่อหน้า (ลิงก์รูปล้วนข้ามด้านบนแล้ว) */
          var href = el.getAttribute && el.getAttribute('href');
          var linkText = elementTextForCompare(el);
          if (href && normalizeText(linkText)) {
            blocks.push({
              type: 'paragraph',
              text: linkText,
              fromStandaloneLink: true
            });
            elements.push(el);
          }
        } else {
          walk(el);
        }
      }
    }

    walk(root);
    return filterRawHtmlNoiseBlocks(blocks, elements);
  }

  function blockTextForCompare(b) {
    if (!b) return '';
    if (b.type === 'list') return (b.items || []).join('\n');
    return b.text || '';
  }

  /**
   * ตัดคำนำหน้าแบบเขียนกำกับใน Word ออกก่อนเทียบกับหน้าเว็บ
   * - "Header Tag 2 :" / "header tag 3:" / ช่องหลัง : ไม่บังคับ — หมายเลขระดับ 2–6
   * - H1/h1: รองรับทั้ง "H1:", "H1 :", "H1 " (ไม่บังคับ :) ตามแบบฟอร์มบทความ
   * - H2–H6: ยังใช้รูปแบบ "H2:" … "H6:" มี colon
   */
  function stripLeadingEditorHeadingTag(t) {
    if (t == null || t === '') return '';
    var s = normalizeText(String(t));
    s = s.replace(/^header\s+tag\s+([2-6])\s*[:：]\s*/i, '');
    s = s.replace(/^h1\s*[:：]?\s*/i, '');
    s = s.replace(/^h([2-6])\s*:\s*/i, '');
    return normalizeText(s);
  }

  /**
   * จุดเริ่มเนื้อหาบทความจริงใน docx: หัวข้อระดับ 1 ของ Word หรือข้อความที่ขึ้นต้นด้วย H1/h1 (มาร์กเกอร์แบบฟอร์ม)
   */
  function isDocxMainH1AnchorBlock(b) {
    if (!b) return false;
    if (b.type === 'heading' && b.level === 1) return true;
    if (b.type !== 'heading' && b.type !== 'paragraph') return false;
    var t = normalizeText(b.text || '');
    if (/^h1\s*[:：]/i.test(t)) return true;
    if (/^h1\s+./i.test(t)) return true;
    if (/^h1\s*$/i.test(t)) return true;
    return false;
  }

  /**
   * ตัดทุกบล็อกก่อนจุด H1 หลัก และตัดบล็อก H1 นั้นทิ้ง — เหลือเฉพาะเนื้อหาที่จะเทียบกับหน้าเว็บ (เช่น เริ่มจาก H2 แรก)
   * ถ้าไม่พบมาร์กเกอร์ H1 จะคืนลำดับเดิมทั้งหมด
   */
  function trimDocxBeforeMainArticle(blocks) {
    if (!blocks || !blocks.length) return blocks || [];
    var i;
    for (i = 0; i < blocks.length; i++) {
      if (isDocxMainH1AnchorBlock(blocks[i])) {
        return blocks.slice(i + 1);
      }
    }
    return blocks;
  }

  /** NBSP / ช่องบาง / เครื่องหมายเต็มความกว้าง — ใช้ร่วมกับ key รายการและย่อหน้า/หัวข้อ */
  function applyCompareKeyWhitespaceAndPunctuation(t) {
    if (!t) return '';
    t = t.replace(/\u00a0/g, ' ');
    t = t.replace(/\u2007|\u202f/g, ' ');
    t = t.replace(/[？]/g, '?');
    t = t.replace(/[：]/g, ':');
    /* en/em dash, minus sign → hyphen — เว็บ (Gutenberg) มักได้ U+2013 ที่ "Radio Frequency – RF"; Word/Mammoth มักเป็น ASCII "-" ถ้า blockKey ต่าง LCS จะไม่จับคู่บล็อกเดียวกันทั้งที่เนื้อหาเหมือน */
    t = t.replace(/\u2013|\u2014|\u2212/g, '-');
    /* อัญประกาศโค้ง — Word กับ blockquote เว็บมักใช้ “ ” ไม่ตรงกับที่อีกฝั่งไม่มีหรือใช้ " ธรรมดา */
    t = t.replace(/[\u201c\u201d\u201e\u201f\u00ab\u00bb]/g, '"');
    t = t.replace(/[\u2018\u2019]/g, "'");
    return normalizeText(t);
  }

  /**
   * จัดรูปคำนำหน้า + เครื่องหมาย : ตัวแรกของบล็อกให้เป็นรูปแบบเดียวกัน
   * ครอบคลุมทั้ง "อ่านบทความเพิ่มเติม", "ความรู้เพิ่มเติม", "ตรวจสอบราคา", "บทความใกล้เคียง" และข้อความนำหน้าแบบเดียวกัน
   * (Word มักมีช่องหลัง : ส่วนเว็บมักติด <a> จึงไม่มีช่องหลัง :)
   * ไม่แตะ URL ที่ขึ้นต้นด้วย http(s)://
   */
  function normalizeLeadColonLabelForCompareKey(t) {
    if (!t) return t;
    var m = /^([^:]+)\s*:\s*/.exec(t);
    if (!m) return t;
    var label = m[1];
    var rest = t.slice(m[0].length);
    var labelTrim = label.trim().replace(/\s+/g, ' ');
    if (!labelTrim) return t;
    if (/^https?$/i.test(labelTrim) && /^https?:\/\//i.test(t)) {
      return t;
    }
    return labelTrim + ' : ' + rest;
  }

  /**
   * ถ้าข้อความถูกห่อด้วยอัญประกาศที่ต้น–ท้าย (Word .docx มักใส่ “ … ” ครอบย่อหน้า; เว็บใน blockquote มักไม่มี)
   * ตัดคู่เปิด–ปิดทิ้งก่อนทำ blockKey — ใช้เฉพาะ key ไม่แก้ข้อความดิบใน block
   */
  function stripOuterWrappingDoubleQuotesForCompareKey(t) {
    if (!t || typeof t !== 'string') return t;
    var s = t.trim();
    if (s.length < 2) return t;
    var c0 = s.charAt(0);
    var c1 = s.charAt(s.length - 1);
    var open = c0 === '"' || c0 === '\u201c';
    var close = c1 === '"' || c1 === '\u201d';
    if (open && close) {
      return normalizeText(s.slice(1, -1));
    }
    return t;
  }

  /**
   * ข้อความย่อหน้า/หัวข้อสำหรับ blockKey — ช่องว่างรอบ : หลังคำนำหน้า (เทียบ Word กับเว็บที่ติดลิงก์)
   */
  function normalizeBodyTextForCompareKey(s) {
    var t = stripLeadingEditorHeadingTag(normalizeText(s || ''));
    t = applyCompareKeyWhitespaceAndPunctuation(t);
    if (!t) return '';
    t = normalizeLeadColonLabelForCompareKey(t);
    t = normalizeText(t);
    t = stripOuterWrappingDoubleQuotesForCompareKey(t);
    return t;
  }

  /**
   * ข้อความรวมของบล็อกตารางสำหรับ blockKey — ไม่ใช้ normalizeLeadColonLabel กับทั้งก้อน (เสี่ยงเพี้ยนถ้ามี : ในเซลล์)
   * Word มักใส่ทุกแถวใน thead + ห่อเซลล์ด้วย <p>; เว็บมัก thead แถวหัว + tbody เป็น <td>
   */
  function normalizeTableTextForCompareKey(s) {
    var t = normalizeText(s || '');
    t = applyCompareKeyWhitespaceAndPunctuation(t);
    if (!t) return '';
    t = normalizeText(t);
    t = stripOuterWrappingDoubleQuotesForCompareKey(t);
    return t;
  }

  /**
   * ปรับข้อความแต่ละข้อในรายการให้เทียบกันได้ยืดหยุ่น (ช่องว่างพิเศษ, เครื่องหมายคล้ายกัน)
   * ใช้เฉพาะใน key / ความคล้าย — ไม่แก้ block.items ดิบ
   */
  function normalizeListItemForCompareKey(s) {
    var t = stripLeadingEditorHeadingTag(normalizeText(s || ''));
    return applyCompareKeyWhitespaceAndPunctuation(t);
  }

  /** เกณฑ์ความคล้ายของบล็อก list ทั้งก้อนให้ถือว่า “ตรงกัน” ใน LCS (0–1) */
  var LIST_LCS_SIMILARITY = 0.88;

  /** ตาราง Word (thead + th + p ในเซลล์) กับ Gutenberg (thead/tbody + td) — ข้อความรวมใกล้เคียงแต่ blockKey อาจคลาดเคลื่อน */
  var TABLE_LCS_SIMILARITY = 0.98;

  function joinNormalizedListItems(blk) {
    return (blk.items || [])
      .map(function (item) {
        return normalizeListItemForCompareKey(item);
      })
      .filter(function (x) {
        return x.length > 0;
      })
      .join('\n');
  }

  function listBlockSimilarityForLcs(d, w) {
    return stringSimilarity(joinNormalizedListItems(d), joinNormalizedListItems(w));
  }

  function isStandaloneLinkParagraph(b) {
    return b && b.type === 'paragraph' && b.fromStandaloneLink;
  }

  /** ตารางใน Word (มักเป็นกล่องปุ่ม/ลิงก์เซลล์เดียว) กับลิงก์ยืนตัวบนเว็บ — ข้อความเทียบได้เหมือนกัน */
  function tableAndStandaloneLinkMatch(a, b) {
    if (!a || !b) return false;
    if (a.type === 'table' && isStandaloneLinkParagraph(b)) {
      return textForCompareKey(a) === textForCompareKey(b);
    }
    if (b.type === 'table' && isStandaloneLinkParagraph(a)) {
      return textForCompareKey(a) === textForCompareKey(b);
    }
    return false;
  }

  /**
   * Word มักใช้แท็ก h3/h4 ผิดแต่พิมพ์นำหน้า "H2 :" ในเนื้อหา — ระดับใน blockKey จึงไม่ตรงกับเว็บ (h2 vs h3)
   * ถ้าข้อความหลัง normalize/strip ตรงกัน ให้จับคู่ใน LCS ได้
   */
  function headingsMatchByTextIgnoringLevel(a, b) {
    if (!a || !b) return false;
    if (a.type !== 'heading' || b.type !== 'heading') return false;
    return textForCompareKey(a) === textForCompareKey(b);
  }

  /**
   * Word/Mammoth มักได้ย่อหน้า <p>; Gutenberg มักใส่คำเตือนใน <blockquote> — blockKey เป็น p:… กับ blockquote:…
   * ถ้าข้อความหลัง normalize เท่ากัน ให้จับคู่ใน LCS เป็นบล็อกเดียวกัน
   */
  function paragraphBlockquoteMatch(a, b) {
    if (!a || !b) return false;
    if (a.type === 'paragraph' && b.type === 'blockquote') {
      return textForCompareKey(a) === textForCompareKey(b);
    }
    if (a.type === 'blockquote' && b.type === 'paragraph') {
      return textForCompareKey(a) === textForCompareKey(b);
    }
    return false;
  }

  /** จับคู่บล็อกสำหรับ LCS: บล็อกทั่วไปใช้ blockKey เท่ากัน; list ใช้ key หรือความคล้ายรายการ */
  function blocksMatchForLcs(docBlocks, webBlocks, di, wj) {
    var d = docBlocks[di];
    var w = webBlocks[wj];
    if (d.type === 'list' && w.type === 'list') {
      if (blockKey(d) === blockKey(w)) return true;
      return listBlockSimilarityForLcs(d, w) >= LIST_LCS_SIMILARITY;
    }
    if (d.type === 'table' && w.type === 'table') {
      if (blockKey(d) === blockKey(w)) return true;
      return tableBlockSimilarityForLcs(d, w) >= TABLE_LCS_SIMILARITY;
    }
    if (blockKey(d) === blockKey(w)) return true;
    if (headingsMatchByTextIgnoringLevel(d, w)) return true;
    if (paragraphBlockquoteMatch(d, w)) return true;
    return tableAndStandaloneLinkMatch(d, w);
  }

  /**
   * LCS บนบล็อกโดยตรง — รายการ (ul/ol) จับคู่แบบยืดหยุ่นด้วยความคล้ายของข้อความรวม
   */
  function lcsDiffBlocks(docBlocks, webBlocks) {
    var n = docBlocks.length;
    var m = webBlocks.length;
    var dp = [];
    var i;
    var j;
    for (i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1);
      for (j = 0; j <= m; j++) dp[i][j] = 0;
    }
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        if (blocksMatchForLcs(docBlocks, webBlocks, i - 1, j - 1)) {
          dp[i][j] = Math.max(dp[i - 1][j - 1] + 1, dp[i - 1][j], dp[i][j - 1]);
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    var ops = [];
    i = n;
    j = m;
    while (i > 0 || j > 0) {
      if (
        i > 0 &&
        j > 0 &&
        blocksMatchForLcs(docBlocks, webBlocks, i - 1, j - 1) &&
        dp[i][j] === dp[i - 1][j - 1] + 1
      ) {
        ops.unshift({ op: 'match', di: i - 1, wj: j - 1 });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] > dp[i - 1][j])) {
        ops.unshift({ op: 'insert', wj: j - 1 });
        j--;
      } else if (i > 0) {
        ops.unshift({ op: 'delete', di: i - 1 });
        i--;
      } else {
        ops.unshift({ op: 'insert', wj: j - 1 });
        j--;
      }
    }
    return ops;
  }

  /** ข้อความที่ใช้ทำ blockKey และ fuzzy — ไม่เปลี่ยนข้อมูลดิบใน block (ยังแสดงใน UI แบบเต็ม) */
  function textForCompareKey(b) {
    if (!b) return '';
    if (b.type === 'list') {
      return (b.items || [])
        .map(function (item) {
          return normalizeListItemForCompareKey(item);
        })
        .filter(function (x) {
          return x.length > 0;
        })
        .join('\n');
    }
    if (b.type === 'table') {
      return normalizeTableTextForCompareKey(blockTextForCompare(b));
    }
    return normalizeBodyTextForCompareKey(blockTextForCompare(b));
  }

  function tableBlockSimilarityForLcs(d, w) {
    var t1 = normalizeTableTextForCompareKey(blockTextForCompare(d));
    var t2 = normalizeTableTextForCompareKey(blockTextForCompare(w));
    return stringSimilarity(t1, t2);
  }

  function blockKey(b) {
    var t = textForCompareKey(b);
    if (b.type === 'list') {
      return 'list:' + (b.ordered ? 'ol' : 'ul') + ':' + t;
    }
    if (b.type === 'heading') {
      return 'h' + (b.level || 1) + ':' + t;
    }
    if (b.type === 'blockquote') {
      return 'blockquote:' + t;
    }
    if (b.type === 'table') {
      return 'table:' + t;
    }
    return 'p:' + t;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var la = a.length;
    var lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;
    if (Math.abs(la - lb) > Math.max(la, lb) * 0.5) {
      return Math.max(la, lb);
    }
    var i;
    var j;
    var prev = new Array(lb + 1);
    var cur = new Array(lb + 1);
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var ca = a.charCodeAt(i - 1);
      for (j = 1; j <= lb; j++) {
        var cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + cost
        );
      }
      var tmp = prev;
      prev = cur;
      cur = tmp;
    }
    return prev[lb];
  }

  function stringSimilarity(s1, s2) {
    var a = normalizeText(s1);
    var b = normalizeText(s2);
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    if (a === b) return 1;
    var dist = levenshtein(a, b);
    var mx = Math.max(a.length, b.length);
    return mx === 0 ? 1 : 1 - dist / mx;
  }

  function blockSimilarity(a, b) {
    return stringSimilarity(textForCompareKey(a), textForCompareKey(b));
  }

  function compareBlockSequences(docBlocks, webBlocks) {
    var ops = lcsDiffBlocks(docBlocks, webBlocks);
    var matchedDoc = {};
    var matchedWeb = {};
    var k;
    for (k = 0; k < ops.length; k++) {
      if (ops[k].op === 'match') {
        matchedDoc[ops[k].di] = true;
        matchedWeb[ops[k].wj] = true;
      }
    }
    var docUnmatched = [];
    var webUnmatched = [];
    for (k = 0; k < docBlocks.length; k++) {
      if (!matchedDoc[k]) docUnmatched.push(k);
    }
    for (k = 0; k < webBlocks.length; k++) {
      if (!matchedWeb[k]) webUnmatched.push(k);
    }

    var FUZZY = 0.85;
    var SOFT = 0.55;
    var webLeft = {};
    for (k = 0; k < webUnmatched.length; k++) {
      webLeft[webUnmatched[k]] = true;
    }

    var rows = [];
    var reordered = [];

    for (k = 0; k < docUnmatched.length; k++) {
      var di = docUnmatched[k];
      var bestJ = -1;
      var bestScore = 0;
      var jkey;
      for (jkey in webLeft) {
        if (!webLeft.hasOwnProperty(jkey)) continue;
        var j = parseInt(jkey, 10);
        var sc = blockSimilarity(docBlocks[di], webBlocks[j]);
        if (sc > bestScore) {
          bestScore = sc;
          bestJ = j;
        }
      }
      if (bestJ >= 0 && bestScore >= FUZZY) {
        delete webLeft[bestJ];
        reordered.push({ docIndex: di, webIndex: bestJ, score: bestScore });
        rows.push({
          kind: 'reordered',
          docIndex: di,
          webIndex: bestJ,
          docBlock: docBlocks[di],
          webBlock: webBlocks[bestJ],
          score: bestScore
        });
      } else if (bestJ >= 0 && bestScore >= SOFT) {
        delete webLeft[bestJ];
        rows.push({
          kind: 'mismatch',
          docIndex: di,
          webIndex: bestJ,
          docBlock: docBlocks[di],
          webBlock: webBlocks[bestJ],
          score: bestScore
        });
      } else {
        rows.push({
          kind: 'missing_on_web',
          docIndex: di,
          docBlock: docBlocks[di]
        });
      }
    }

    for (jkey in webLeft) {
      if (!webLeft.hasOwnProperty(jkey)) continue;
      var wj = parseInt(jkey, 10);
      rows.push({
        kind: 'extra_on_web',
        webIndex: wj,
        webBlock: webBlocks[wj]
      });
    }

    var matchCount = 0;
    for (k = 0; k < ops.length; k++) {
      if (ops[k].op === 'match') matchCount++;
    }

    return {
      docCount: docBlocks.length,
      webCount: webBlocks.length,
      matchCount: matchCount,
      rows: rows,
      reorderedCount: reordered.length
    };
  }

  /** ลำดับเทียบแบบเต็ม: แต่ละแถว = ตรงกัน | มีแค่ฝั่งเอกสาร | มีแค่ฝั่งเว็บ */
  function computeAlignment(docBlocks, webBlocks) {
    var ops = lcsDiffBlocks(docBlocks, webBlocks);
    var out = [];
    var i;
    for (i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.op === 'match') {
        out.push({
          type: 'match',
          docIndex: op.di,
          webIndex: op.wj,
          docBlock: docBlocks[op.di],
          webBlock: webBlocks[op.wj]
        });
      } else if (op.op === 'delete') {
        out.push({
          type: 'doc_only',
          docIndex: op.di,
          docBlock: docBlocks[op.di]
        });
      } else if (op.op === 'insert') {
        out.push({
          type: 'web_only',
          webIndex: op.wj,
          webBlock: webBlocks[op.wj]
        });
      }
    }
    return out;
  }

  function blockLabel(block) {
    if (!block) return '';
    if (block.type === 'heading') return 'H' + block.level;
    if (block.type === 'list') return block.ordered ? 'ลำดับ (OL)' : 'รายการ (UL)';
    if (block.type === 'blockquote') return 'อ้างอิง';
    if (block.type === 'table') return 'ตาราง';
    if (block.type === 'paragraph' && block.fromCaption) return 'คำอธิบายรูป';
    if (block.type === 'paragraph' && block.fromStandaloneLink) return 'ปุ่ม/ลิงก์';
    return 'ย่อหน้า';
  }

  function blockPreview(block, maxLen) {
    maxLen = maxLen || 120;
    var s;
    if (block.type === 'list') {
      s = (block.items || []).slice(0, 5).join(' · ');
      if ((block.items || []).length > 5) s += ' …';
    } else {
      s = block.text || '';
    }
    s = normalizeText(s);
    if (s.length > maxLen) return s.substring(0, maxLen) + '…';
    return s;
  }

  function blockFullText(block) {
    if (!block) return '';
    if (block.type === 'list') {
      return (block.items || [])
        .map(function (item, idx) {
          return (idx + 1) + '. ' + item;
        })
        .join('\n');
    }
    return block.text || '';
  }

  /**
   * บรรทัด meta จาก Word (ไม่ใช่เนื้อหาที่จะเทียบกับหน้าเว็บ)
   * - บรรทัดที่เหลือแค่ "H1"/"h1" (มีหรือไม่มี :) ไม่มีข้อความหลัง — ไม่ใช่หัวข้อจริงแบบ "H1 : รวมวิธี..."
   * - Alt: คำอธิบายรูปภาพใน draft
   * - ย่อหน้าที่ขึ้นต้นด้วย https: (ลิงก์ YouTube / วิดีโอ / URL ดิบใน draft)
   * - ย่อหน้า "alt :" ภายใน <table> ตัดใน elementTextForCompareTable / debug HTML (ไม่ใช่บล็อก paragraph แยก)
   * - ตารางที่ย่อหน้าแรก (หรือเซลล์แรกที่มีข้อความ) ขึ้นต้นด้วย "Note to Writer" — ข้ามทั้ง <table>
   */
  function isDocxH1MetaBlock(block) {
    if (!block) return false;
    if (block.type !== 'heading' && block.type !== 'paragraph') return false;
    var t = normalizeText(block.text || '');
    return /^h1\s*[:：]?\s*$/i.test(t);
  }

  function isDocxAltMetaBlock(block) {
    if (!block) return false;
    if (block.type !== 'heading' && block.type !== 'paragraph') return false;
    var t = normalizeText(block.text || '');
    return DOCX_ALT_META_PREFIX.test(t);
  }

  function isDocxHttpsUrlParagraph(block) {
    if (!block || block.type !== 'paragraph') return false;
    var t = normalizeText(block.text || '');
    return DOCX_PARAGRAPH_HTTPS_PREFIX.test(t);
  }

  /**
   * มาร์กเกอร์ท้ายไฟล์ Word (เช็กลิสต์ SEO สำหรับนักเขียน) — ไม่ใช่เนื้อหาบทความบนเว็บ
   * ตัดทุกบล็อกตั้งแต่ย่อหน้า/หัวข้อที่ขึ้นต้นด้วย "NOTE SEO Writer" จนถึงท้าย
   */
  function isDocxNoteSeoWriterAnchorBlock(block) {
    if (!block) return false;
    if (block.type !== 'heading' && block.type !== 'paragraph') return false;
    var t = normalizeText(block.text || '');
    return /^note\s+seo\s+writer\b/i.test(t);
  }

  /** คืนเฉพาะบล็อกก่อนจุด NOTE SEO Writer (ไม่รวมบล็อกนั้นและรายการถัดไป) */
  function trimDocxBeforeNoteSeoWriter(blocks, elements) {
    if (!blocks || !blocks.length) {
      return { blocks: blocks || [], elements: elements || [] };
    }
    var els = elements || [];
    var i;
    for (i = 0; i < blocks.length; i++) {
      if (isDocxNoteSeoWriterAnchorBlock(blocks[i])) {
        if (els.length === blocks.length) {
          return { blocks: blocks.slice(0, i), elements: els.slice(0, i) };
        }
        return { blocks: blocks.slice(0, i), elements: [] };
      }
    }
    return { blocks: blocks, elements: els };
  }

  function filterDocxSkipH1MetaBlocks(blocks) {
    if (!blocks || !blocks.length) return blocks || [];
    return blocks.filter(function (b) {
      return (
        !isDocxH1MetaBlock(b) &&
        !isDocxAltMetaBlock(b) &&
        !isDocxHttpsUrlParagraph(b)
      );
    });
  }

  /** trim คู่ blocks/elements — logic เดียวกับ trimDocxBeforeMainArticle */
  function trimDocxExtractedPair(blocks, elements) {
    if (!blocks || !blocks.length) {
      return { blocks: blocks || [], elements: elements || [] };
    }
    var els = elements || [];
    if (els.length !== blocks.length) {
      return { blocks: trimDocxBeforeMainArticle(blocks), elements: [] };
    }
    var i;
    for (i = 0; i < blocks.length; i++) {
      if (isDocxMainH1AnchorBlock(blocks[i])) {
        return { blocks: blocks.slice(i + 1), elements: els.slice(i + 1) };
      }
    }
    return { blocks: blocks, elements: els };
  }

  /** กรองคู่ blocks/elements — logic เดียวกับ filterDocxSkipH1MetaBlocks */
  function filterDocxExtractedPair(blocks, elements) {
    if (!blocks || !blocks.length) {
      return { blocks: [], elements: [] };
    }
    var els = elements || [];
    if (els.length !== blocks.length) {
      return { blocks: filterDocxSkipH1MetaBlocks(blocks), elements: [] };
    }
    var nb = [];
    var ne = [];
    var i;
    for (i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!isDocxH1MetaBlock(b) && !isDocxAltMetaBlock(b) && !isDocxHttpsUrlParagraph(b)) {
        nb.push(b);
        ne.push(els[i]);
      }
    }
    return { blocks: nb, elements: ne };
  }

  /**
   * ใช้หลัง extractBlocksFromRoot — คืน { blocks, elements } ที่ซิงค์กัน
   * (ชุดบล็อกเดียวกับที่นำไป compareBlockSequences)
   */
  function applyDocxComparePipeline(extracted) {
    var blocks = extracted.blocks || [];
    var elements = extracted.elements || [];
    var t = trimDocxExtractedPair(blocks, elements);
    var u = trimDocxBeforeNoteSeoWriter(t.blocks, t.elements);
    return filterDocxExtractedPair(u.blocks, u.elements);
  }

  /** รวม outerHTML ของแต่ละ element ที่ยังเหลือหลัง pipeline (โครงสร้างจาก Mammoth) — ตัด <img> ในตารางออกจากสตริง debug */
  function htmlFromDocxCompareElements(elements) {
    if (!elements || !elements.length) return '';
    var parts = [];
    var j;
    for (j = 0; j < elements.length; j++) {
      var el = elements[j];
      if (!el || !el.outerHTML) continue;
      var tag = el.tagName && el.tagName.toLowerCase();
      if (tag === 'table') {
        var dbg = el.cloneNode(true);
        stripTableSubtreeMedia(dbg);
        stripDocxTableAltDirectiveParagraphs(dbg);
        parts.push(dbg.outerHTML);
      } else {
        parts.push(el.outerHTML);
      }
    }
    return parts.join('\n');
  }

  global.DocCompare = {
    normalizeText: normalizeText,
    extractBlocksFromRoot: extractBlocksFromRoot,
    blockKey: blockKey,
    compareBlockSequences: compareBlockSequences,
    computeAlignment: computeAlignment,
    blockLabel: blockLabel,
    blockPreview: blockPreview,
    blockFullText: blockFullText,
    isDocxH1MetaBlock: isDocxH1MetaBlock,
    isDocxAltMetaBlock: isDocxAltMetaBlock,
    isDocxHttpsUrlParagraph: isDocxHttpsUrlParagraph,
    filterDocxSkipH1MetaBlocks: filterDocxSkipH1MetaBlocks,
    trimDocxBeforeMainArticle: trimDocxBeforeMainArticle,
    isDocxMainH1AnchorBlock: isDocxMainH1AnchorBlock,
    isDocxNoteSeoWriterAnchorBlock: isDocxNoteSeoWriterAnchorBlock,
    isDocxNoteToWriterTable: isDocxNoteToWriterTable,
    applyDocxComparePipeline: applyDocxComparePipeline,
    htmlFromDocxCompareElements: htmlFromDocxCompareElements
  };
})(typeof self !== 'undefined' ? self : this);
