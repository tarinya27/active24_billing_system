/**
 * @typedef {Object} ExternalPoLine
 * @property {string} [productCode]
 * @property {string} [description]
 * @property {number} quantity
 * @property {number} costPrice
 *
 * @typedef {Object} ExternalPurchaseOrder
 * @property {string} externalRef
 * @property {string} poNumber
 * @property {'GENIUS'|'ACTIVE24'} company
 * @property {string} supplierName
 * @property {string} [supplierCode]
 * @property {string} orderDate ISO date string
 * @property {string|null} [expectedDelivery]
 * @property {'PENDING'|'APPROVED'|'RECEIVED'|'CANCELLED'} status
 * @property {string} [notes]
 * @property {ExternalPoLine[]} items
 */

export {};
