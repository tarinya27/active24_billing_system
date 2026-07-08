import invoicePrintCss from '../styles/invoice-print.css?raw';

const PRINT_BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
    height: 297mm;
    background: #fff;
    color: #0f172a;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    background: #fff;
  }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .text-xs { font-size: 0.75rem; line-height: 1rem; }
`;

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

/**
 * Print a DOM element in an isolated iframe using invoice-only CSS.
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

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Invoice print');
    iframe.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden',
    );
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win.document;

    const clone = element.cloneNode(true);
    clone.querySelectorAll('.no-print').forEach((node) => node.remove());

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
  <title>Invoice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${PRINT_BASE_CSS}</style>
  <style>${invoicePrintCss}</style>
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
