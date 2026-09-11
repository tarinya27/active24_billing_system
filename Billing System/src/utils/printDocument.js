import invoicePrintCss from '../styles/invoice-print.css?raw';
import dnPrintCss from '../styles/dn-print.css?raw';
import sofPrintCss from '../styles/sof-form.css?raw';
import estPrintCss from '../styles/estimate-form.css?raw';

const PRINT_BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
    min-height: 297mm;
    height: auto;
    background: #fff;
    color: #0f172a;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  #invoice-print-content,
  .invoice-print {
    width: 186mm;
    min-height: 273mm;
    height: auto;
    max-height: none;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    background: #fff;
    overflow: visible;
  }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .text-xs { font-size: 0.75rem; line-height: 1rem; }
`;

/** SOF: A4 portrait, keep paper layout, contain Status/Technician cells */
const SOF_PRINT_BASE_CSS = `
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
    min-height: 0;
    height: auto;
    background: #fff;
    color: #111;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  #sof-print-content,
  .sof-doc {
    width: 186mm;
    min-height: 260mm;
    height: auto;
    margin: 0 auto;
    padding: 8mm 8mm 7mm;
    border: 0 !important;
    box-shadow: none !important;
    background: #fff;
    overflow: hidden;
  }
  .no-print { display: none !important; }
  .sof-split,
  .sof-right-col {
    min-width: 0;
    max-width: 100%;
  }
  .sof-status {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
  }
  .sof-status th,
  .sof-status td {
    overflow: hidden;
    max-width: 0;
  }
  .sof-status input,
  .sof-status span {
    display: block;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-sizing: border-box;
  }
`;

/** Estimate: no forced document height; allow natural page flow */
const EST_PRINT_BASE_CSS = `
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    background: #fff;
    color: #111;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    display: block;
  }
  #est-print-content,
  .est-doc {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
  }
  .no-print { display: none !important; }
  input[type="date"]::-webkit-calendar-picker-indicator {
    display: none !important;
  }
`;

/** DN-specific base: no forced page-height so content + @page margins stay on one A4 */
const DN_PRINT_BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    display: block;
  }
  #dn-print-content,
  .dn-print {
    width: 100%;
    max-width: 100%;
    min-height: 0 !important;
    height: auto !important;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
  }
  .no-print { display: none !important; }
`;

function formatDateInputForPrint(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
}

function prepareCloneForPrint(clone) {
  clone.querySelectorAll('.no-print').forEach((node) => node.remove());
  clone.querySelectorAll('input[type="date"]').forEach((input) => {
    const span = document.createElement('span');
    span.textContent = formatDateInputForPrint(input.value);
    input.replaceWith(span);
  });
  clone.querySelectorAll('.sof-status input').forEach((input) => {
    const span = document.createElement('span');
    span.textContent = input.value || '';
    span.style.display = 'block';
    span.style.width = '100%';
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    span.style.whiteSpace = 'nowrap';
    input.replaceWith(span);
  });
}

function waitForImages(doc) {
  const images = Array.from(doc.images || []);
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
}

function resolvePrintCss(elementId) {
  if (elementId === 'dn-print-content') return dnPrintCss;
  if (elementId === 'sof-print-content') return sofPrintCss;
  if (elementId === 'est-print-content') return `${sofPrintCss}\n${estPrintCss}`;
  return invoicePrintCss;
}

function resolvePrintBaseCss(elementId) {
  if (elementId === 'dn-print-content') return DN_PRINT_BASE_CSS;
  if (elementId === 'sof-print-content') return SOF_PRINT_BASE_CSS;
  if (elementId === 'est-print-content') return EST_PRINT_BASE_CSS;
  return PRINT_BASE_CSS;
}

function resolvePrintTitle(elementId) {
  if (elementId === 'dn-print-content') return 'Delivery Note';
  if (elementId === 'sof-print-content') return 'Service Order Form';
  if (elementId === 'est-print-content') return 'Estimate';
  return 'Invoice';
}

/**
 * Print a DOM element in an isolated iframe using document-specific CSS.
 * Avoids global @media print rules from other stylesheets (e.g. PO print).
 */
export function printElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`printElement: #${elementId} not found in DOM`);
    return Promise.reject(new Error(`Print target #${elementId} not found`));
  }

  if (!element.innerHTML.trim()) {
    console.error(`printElement: #${elementId} is empty`);
    return Promise.reject(new Error('Print target has no content'));
  }

  const printCss = resolvePrintCss(elementId);
  const baseCss = resolvePrintBaseCss(elementId);
  const title = resolvePrintTitle(elementId);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', `${title} print`);
    iframe.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden',
    );
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win.document;

    const clone = element.cloneNode(true);
    prepareCloneForPrint(clone);

    const cleanup = () => {
      win.removeEventListener('afterprint', cleanup);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const triggerPrint = async () => {
      try {
        await waitForImages(doc);
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        win.focus();
        win.print();
        resolve();
      } catch (err) {
        console.error('printElement failed:', err);
        cleanup();
        reject(err);
      }
    };

    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 120_000);

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${baseCss}</style>
  <style>${printCss}</style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
    doc.close();

    if (doc.readyState === 'complete') {
      triggerPrint();
    } else {
      win.addEventListener('load', triggerPrint, { once: true });
    }
  });
}
