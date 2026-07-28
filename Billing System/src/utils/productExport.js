import * as XLSX from 'xlsx';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
      if (ch === '\r') i += 1;
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export function csvRowsToObjects(matrix) {
  if (!matrix.length) return [];
  const headers = matrix[0].map((h) => h.trim());
  return matrix.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? '';
    });
    return row;
  });
}

export async function readImportFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  const text = await file.text();
  const matrix = parseCsvText(text);
  return csvRowsToObjects(matrix);
}

export function productsToWorkbookRows(products) {
  return products.map((p) => ({
    'Product Code': p.code || p.productCode,
    Barcode: p.barcode || '',
    'Product Name': p.name || p.productName,
    Category: p.category?.name || '',
    Supplier: p.supplier?.name || '',
    'Purchase Price': Number(p.purchasePrice ?? 0),
    'Selling Price': Number(p.sellingPrice ?? p.defaultSellingPrice ?? 0),
    'VAT %': Number(p.vatPercentage ?? 0),
    'Current Stock': p.currentStock ?? 0,
    'Reorder Level': p.reorderLevel ?? 0,
    Status: p.isActive === false ? 'Inactive' : 'Active',
    Description: p.description || '',
  }));
}

export async function exportProductsExcel(products, filename = 'products.xlsx') {
  const rows = productsToWorkbookRows(products);
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Products');
  XLSX.writeFile(book, filename);
}

export function exportProductsCsv(products, filename = 'products.csv') {
  const headers = [
    'Product Code', 'Barcode', 'Product Name', 'Category', 'Supplier',
    'Purchase Price', 'Selling Price', 'VAT %', 'Current Stock', 'Reorder Level', 'Status', 'Description',
  ];
  const lines = [headers.join(',')];
  for (const p of products) {
    const row = productsToWorkbookRows([p])[0];
    lines.push(headers.map((h) => {
      const val = row[h] ?? '';
      const s = String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  }
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}
