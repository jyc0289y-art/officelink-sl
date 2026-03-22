// MarkLink SL — Sheet Engine (data model + formula evaluation)

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;

/**
 * Create a new empty sheet data model
 */
export function createSheetData(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return {
    rows,
    cols,
    cells: {}, // key: "R,C" → { raw, value, format }
  };
}

/** Get cell key */
export function cellKey(r, c) {
  return `${r},${c}`;
}

/** Get cell data */
export function getCell(sheet, r, c) {
  return sheet.cells[cellKey(r, c)] || null;
}

/** Set cell raw value and compute */
export function setCell(sheet, r, c, rawValue) {
  const key = cellKey(r, c);
  if (rawValue === '' || rawValue == null) {
    delete sheet.cells[key];
    return;
  }
  if (!sheet.cells[key]) {
    sheet.cells[key] = { raw: '', value: '', format: {} };
  }
  sheet.cells[key].raw = String(rawValue);
  sheet.cells[key].value = evaluate(sheet, String(rawValue));
}

/** Set cell format property */
export function setCellFormat(sheet, r, c, prop, val) {
  const key = cellKey(r, c);
  if (!sheet.cells[key]) {
    sheet.cells[key] = { raw: '', value: '', format: {} };
  }
  sheet.cells[key].format[prop] = val;
}

/** Get display value */
export function getDisplayValue(sheet, r, c) {
  const cell = getCell(sheet, r, c);
  if (!cell) return '';
  return cell.value != null ? String(cell.value) : '';
}

/** Get raw value */
export function getRawValue(sheet, r, c) {
  const cell = getCell(sheet, r, c);
  return cell ? cell.raw : '';
}

/** Column index → letter (0=A, 25=Z, 26=AA) */
export function colToLetter(c) {
  let s = '';
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Letter → column index (A=0, Z=25, AA=26) */
export function letterToCol(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Cell reference (e.g. "A1") → [row, col] (0-based) */
export function refToRC(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return [parseInt(match[2], 10) - 1, letterToCol(match[1])];
}

/** [row, col] → cell reference string */
export function rcToRef(r, c) {
  return colToLetter(c) + (r + 1);
}

/** Add rows */
export function addRows(sheet, count = 1) {
  sheet.rows += count;
}

/** Add columns */
export function addCols(sheet, count = 1) {
  sheet.cols += count;
}

/** Delete a row */
export function deleteRow(sheet, rowIdx) {
  if (sheet.rows <= 1) return;
  const newCells = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(',').map(Number);
    if (r === rowIdx) continue;
    const newR = r > rowIdx ? r - 1 : r;
    newCells[cellKey(newR, c)] = cell;
  }
  sheet.cells = newCells;
  sheet.rows--;
}

/** Delete a column */
export function deleteCol(sheet, colIdx) {
  if (sheet.cols <= 1) return;
  const newCells = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(',').map(Number);
    if (c === colIdx) continue;
    const newC = c > colIdx ? c - 1 : c;
    newCells[cellKey(r, newC)] = cell;
  }
  sheet.cells = newCells;
  sheet.cols--;
}

/** Recalculate all formula cells */
export function recalcAll(sheet) {
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.raw.startsWith('=')) {
      cell.value = evaluate(sheet, cell.raw);
    }
  }
}

/**
 * Evaluate a cell value — supports formulas starting with '='
 */
function evaluate(sheet, raw) {
  if (!raw.startsWith('=')) {
    // Try number
    const num = Number(raw);
    return isNaN(num) ? raw : num;
  }

  try {
    const expr = raw.substring(1).toUpperCase();
    return evalFormula(sheet, expr);
  } catch (e) {
    return '#ERROR';
  }
}

/**
 * Simple formula evaluator
 * Supports: SUM, AVERAGE, COUNT, MIN, MAX, IF, and basic arithmetic
 */
function evalFormula(sheet, expr) {
  // SUM(range)
  const sumMatch = expr.match(/^SUM\((.+)\)$/);
  if (sumMatch) {
    const vals = resolveRange(sheet, sumMatch[1]);
    return vals.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  }

  // AVERAGE(range)
  const avgMatch = expr.match(/^AVERAGE\((.+)\)$/);
  if (avgMatch) {
    const vals = resolveRange(sheet, avgMatch[1]).filter(v => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  // COUNT(range)
  const cntMatch = expr.match(/^COUNT\((.+)\)$/);
  if (cntMatch) {
    return resolveRange(sheet, cntMatch[1]).filter(v => typeof v === 'number').length;
  }

  // MIN(range)
  const minMatch = expr.match(/^MIN\((.+)\)$/);
  if (minMatch) {
    const vals = resolveRange(sheet, minMatch[1]).filter(v => typeof v === 'number');
    return vals.length ? Math.min(...vals) : 0;
  }

  // MAX(range)
  const maxMatch = expr.match(/^MAX\((.+)\)$/);
  if (maxMatch) {
    const vals = resolveRange(sheet, maxMatch[1]).filter(v => typeof v === 'number');
    return vals.length ? Math.max(...vals) : 0;
  }

  // IF(condition, trueVal, falseVal)
  const ifMatch = expr.match(/^IF\((.+),(.+),(.+)\)$/);
  if (ifMatch) {
    const cond = evalSimpleExpr(sheet, ifMatch[1].trim());
    return cond ? evalSimpleExpr(sheet, ifMatch[2].trim()) : evalSimpleExpr(sheet, ifMatch[3].trim());
  }

  // Basic arithmetic with cell references
  return evalSimpleExpr(sheet, expr);
}

/**
 * Evaluate simple arithmetic expression with cell references
 */
function evalSimpleExpr(sheet, expr) {
  // Replace cell references with values
  const resolved = expr.replace(/\b([A-Z]+\d+)\b/g, (match) => {
    const rc = refToRC(match);
    if (!rc) return match;
    const val = getDisplayValue(sheet, rc[0], rc[1]);
    const num = Number(val);
    return isNaN(num) ? `"${val}"` : num;
  });

  // Safe eval of arithmetic (only numbers and operators)
  if (/^[\d\s+\-*/().,"<>=!&|]+$/.test(resolved)) {
    try {
      return Function(`"use strict"; return (${resolved})`)();
    } catch {
      return '#ERROR';
    }
  }
  return resolved;
}

/**
 * Resolve a range like "A1:B3" or "A1,B2,C3" to array of values
 */
function resolveRange(sheet, rangeStr) {
  const values = [];

  // Handle comma-separated refs/ranges
  const parts = rangeStr.split(',').map(s => s.trim());
  for (const part of parts) {
    if (part.includes(':')) {
      // Range: A1:B3
      const [startRef, endRef] = part.split(':');
      const start = refToRC(startRef.trim());
      const end = refToRC(endRef.trim());
      if (!start || !end) continue;
      const r1 = Math.min(start[0], end[0]);
      const r2 = Math.max(start[0], end[0]);
      const c1 = Math.min(start[1], end[1]);
      const c2 = Math.max(start[1], end[1]);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const v = getDisplayValue(sheet, r, c);
          const num = Number(v);
          values.push(isNaN(num) ? v : num);
        }
      }
    } else {
      // Single cell
      const rc = refToRC(part);
      if (!rc) continue;
      const v = getDisplayValue(sheet, rc[0], rc[1]);
      const num = Number(v);
      values.push(isNaN(num) ? v : num);
    }
  }
  return values;
}
