# ERP Purchase & GRN Module — Active24

Production purchase-to-stock flow: **Purchase Invoice → GRN → Stock**.

---

## 1. Purchase Invoice

### Required behaviour
- Dynamic line-item table (add/remove rows)
- Product search-and-select per line
- **VAT YES / NO** toggle (18% when YES, ignored when NO)
- Real-time subtotal, VAT, and grand total
- Company fixed to **ACTIVE24**
- Optional link to **Purchase Order** (`poId` / PO number)

### VAT calculation (VAT on top)
When **VAT = YES**:
```
Line subtotal = Unit Price × Units
VAT           = (Unit Price × Units × 18%) / 100
Line total    = subtotal + VAT
```

When **VAT = NO**: VAT = 0 in calculations and reports.

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/purchase-invoices` | List |
| `GET` | `/api/purchase-invoices/:id` | Detail |
| `POST` | `/api/purchase-invoices` | Create |
| `PATCH` | `/api/purchase-invoices/:id` | Update |
| `POST` | `/api/purchase-invoices/calculate` | Server-side totals preview |
| `GET` | `/api/purchase-invoices/:id/tally` | GRN receive progress |

### Frontend
- `PurchaseInvoiceForm.jsx` — header, VAT toggle, save
- `PurchaseInvoiceLineTable.jsx` — lines + `ProductSearchSelect`
- `utils/pricing.js` — `calcPurchaseInvoiceLine`, `calcPurchaseInvoiceTotals`

### Schema (`PurchaseInvoice`, `PurchaseInvoiceItem`)
- `vatEnabled`, `vatRate`, `subtotal`, `vatAmount`, `total`
- Line: `productId`, `description`, `unitPrice`, `units`, `vatAmount`, `lineTotal`

---

## 2. GRN (Goods Received Note)

GRN is generated from **Purchase Invoice** data (or opening-stock mode).

### GRN line fields
| Field | Source | Editable |
|-------|--------|----------|
| Barcode | Scanned / generated per unit | Scan triggers auto-fill |
| Category | Product master | Auto (read-only) |
| Item Description | Product / invoice line | Yes |
| Purchase Price | Invoice unit price | Locked when linked to PI |
| Selling Price | `Purchase Price × 1.30` | Auto; optional manual override |
| PO Number | Linked PO from invoice | Read-only |
| Quantity | Count of unit barcodes | Via scan/generate |
| Supplier | From invoice | Read-only when linked |

### Barcode auto-fill (core)
`GET /api/products/lookup/barcode/:barcode`

On scan:
1. Resolve active product by master `barcode` or `code`
2. Reject if barcode already exists on a `ProductUnit`
3. Auto-fill **category**, **description**, **purchase price** (from PI line)
4. Compute **selling price** = purchase price × 1.30
5. Append unique **unit barcode** (generates one if SKU barcode scanned)

### Selling price
```
Selling Price = Purchase Price × 1.30
```
Mode `AUTO` (default) or `MANUAL` per line (`SellingPriceMode` enum).

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/grns` | List |
| `GET` | `/api/grns/:id` | Detail |
| `POST` | `/api/grns/complete` | Confirm GRN + stock update (transaction) |
| `POST` | `/api/grns/:id/cancel` | Void units (if not sold) |

### Frontend
- `GRNForm.jsx` — barcode scanner, auto-fill, confirm
- `GRNDetail.jsx` — posted GRN view
- Entry: `/grn/new?purchaseInvoiceId={id}` from invoice detail

### Schema (`Grn`, `GrnItem`)
- Links: `purchaseInvoiceId`, `poId`, `supplierId`
- `GrnItem`: `categoryId`, `description`, `purchasePrice`, `costExVat`, `sellingPrice`, `sellingPriceMode`, `units`

---

## 3. Stock update

Stock is **never manually edited**. On GRN confirm (`POST /grns/complete`):

1. Prisma **transaction** creates `Grn` + `GrnItem` rows
2. For each unit barcode → `ProductUnit` with `status: IN_STOCK`
3. `StockMovement` type `GRN_IN`, quantity +1 per unit
4. `currentStock` = count of `ProductUnit` where `status = IN_STOCK`

Validation:
- Received qty ≤ invoiced qty (when PI linked)
- Purchase price must match invoice unit price
- Barcodes globally unique

---

## 4. System relationships

```
Purchase Order ──► Purchase Invoice ──► GRN ──► ProductUnit (stock)
                         │                │
                    Supplier           Barcode lookup
```

---

## 5. Calculation utilities

**Backend:** `backend/src/utils/pricing.js`  
**Frontend:** `Billing System/src/utils/pricing.js` (keep in sync)

| Function | Purpose |
|----------|---------|
| `calcPurchaseInvoiceLine` | Line VAT + total |
| `calcPurchaseInvoiceTotals` | Invoice summary |
| `calcGrnAutoSellingPrice` | Purchase × 1.30 |
| `calcCostExVat` | Cost ex-VAT for unit cost storage |

---

## 6. Permissions

| Permission | Action |
|------------|--------|
| `purchase_invoices.create` | Create PI |
| `purchase_invoices.edit` | Edit PI |
| `purchase_invoices.view` | View PI |
| `grn.create` | Complete GRN |
| `grn.view` | View GRN |
| `grn.cancel` | Cancel GRN |
| `products.view` | Barcode lookup |

---

## 7. Migrations

- `3_pi_vat_description` — `vatEnabled` on PI, `description` on line items

Apply: `npm run db:deploy` in `backend/`.
