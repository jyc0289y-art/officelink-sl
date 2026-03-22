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
 * Sort sheet rows by a column
 */
export function sortByColumn(sheet, colIdx, ascending = true) {
  // Gather all occupied rows
  const rowData = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(',').map(Number);
    if (!rowData[r]) rowData[r] = {};
    rowData[r][c] = cell;
  }

  const rowIndices = Object.keys(rowData).map(Number).sort((a, b) => a - b);
  if (rowIndices.length === 0) return;

  // Sort rows by the target column value
  rowIndices.sort((a, b) => {
    const va = rowData[a]?.[colIdx]?.value ?? '';
    const vb = rowData[b]?.[colIdx]?.value ?? '';
    const na = Number(va), nb = Number(vb);
    const isNumA = !isNaN(na) && va !== '', isNumB = !isNaN(nb) && vb !== '';
    let cmp;
    if (isNumA && isNumB) cmp = na - nb;
    else cmp = String(va).localeCompare(String(vb));
    return ascending ? cmp : -cmp;
  });

  // Rewrite cells with new row order
  const newCells = {};
  rowIndices.forEach((origRow, newRow) => {
    const row = rowData[origRow];
    if (!row) return;
    for (const [c, cell] of Object.entries(row)) {
      newCells[cellKey(newRow, Number(c))] = { ...cell };
    }
  });
  sheet.cells = newCells;
}

/**
 * Formula evaluator
 * Supports: SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, IF, SUMIF, COUNTIF,
 *   VLOOKUP, CONCATENATE/CONCAT, LEFT, RIGHT, MID, LEN, TRIM,
 *   UPPER, LOWER, ROUND, ABS, TODAY, NOW, and basic arithmetic
 */
function evalFormula(sheet, expr) {
  // Match function pattern: FUNCNAME(args)
  const fnMatch = expr.match(/^([A-Z]+)\((.+)\)$/);
  if (fnMatch) {
    const fn = fnMatch[1];
    const argsStr = fnMatch[2];

    switch (fn) {
      case 'SUM': {
        const vals = resolveRange(sheet, argsStr);
        return vals.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      }
      case 'AVERAGE': {
        const vals = resolveRange(sheet, argsStr).filter(v => typeof v === 'number');
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }
      case 'COUNT': {
        return resolveRange(sheet, argsStr).filter(v => typeof v === 'number').length;
      }
      case 'COUNTA': {
        return resolveRange(sheet, argsStr).filter(v => v !== '' && v != null).length;
      }
      case 'MIN': {
        const vals = resolveRange(sheet, argsStr).filter(v => typeof v === 'number');
        return vals.length ? Math.min(...vals) : 0;
      }
      case 'MAX': {
        const vals = resolveRange(sheet, argsStr).filter(v => typeof v === 'number');
        return vals.length ? Math.max(...vals) : 0;
      }
      case 'IF': {
        const args = splitArgs(argsStr);
        if (args.length < 3) return '#ERROR';
        const cond = evalSimpleExpr(sheet, args[0]);
        return cond ? evalSimpleExpr(sheet, args[1]) : evalSimpleExpr(sheet, args[2]);
      }
      case 'SUMIF': {
        const args = splitArgs(argsStr);
        if (args.length < 2) return '#ERROR';
        const range = resolveRange(sheet, args[0]);
        const criteria = evalSimpleExpr(sheet, args[1]);
        const sumRange = args[2] ? resolveRange(sheet, args[2]) : range;
        let sum = 0;
        for (let i = 0; i < range.length; i++) {
          if (matchCriteria(range[i], criteria)) {
            const v = sumRange[i];
            if (typeof v === 'number') sum += v;
          }
        }
        return sum;
      }
      case 'COUNTIF': {
        const args = splitArgs(argsStr);
        if (args.length < 2) return '#ERROR';
        const range = resolveRange(sheet, args[0]);
        const criteria = evalSimpleExpr(sheet, args[1]);
        return range.filter(v => matchCriteria(v, criteria)).length;
      }
      case 'VLOOKUP': {
        const args = splitArgs(argsStr);
        if (args.length < 3) return '#ERROR';
        const lookupVal = evalSimpleExpr(sheet, args[0]);
        const tableRange = resolveRangeAsTable(sheet, args[1]);
        const colIndex = Number(evalSimpleExpr(sheet, args[2])) - 1;
        for (const row of tableRange) {
          if (row[0] == lookupVal || String(row[0]) === String(lookupVal)) {
            return colIndex < row.length ? row[colIndex] : '#REF';
          }
        }
        return '#N/A';
      }
      case 'CONCATENATE':
      case 'CONCAT': {
        const args = splitArgs(argsStr);
        return args.map(a => {
          const v = evalSimpleExpr(sheet, a);
          return v != null ? String(v).replace(/^"|"$/g, '') : '';
        }).join('');
      }
      case 'LEFT': {
        const args = splitArgs(argsStr);
        const text = String(evalSimpleExpr(sheet, args[0])).replace(/^"|"$/g, '');
        const n = args[1] ? Number(evalSimpleExpr(sheet, args[1])) : 1;
        return text.substring(0, n);
      }
      case 'RIGHT': {
        const args = splitArgs(argsStr);
        const text = String(evalSimpleExpr(sheet, args[0])).replace(/^"|"$/g, '');
        const n = args[1] ? Number(evalSimpleExpr(sheet, args[1])) : 1;
        return text.slice(-n);
      }
      case 'MID': {
        const args = splitArgs(argsStr);
        const text = String(evalSimpleExpr(sheet, args[0])).replace(/^"|"$/g, '');
        const start = Number(evalSimpleExpr(sheet, args[1])) - 1;
        const len = Number(evalSimpleExpr(sheet, args[2]));
        return text.substring(start, start + len);
      }
      case 'LEN': {
        const text = String(evalSimpleExpr(sheet, argsStr)).replace(/^"|"$/g, '');
        return text.length;
      }
      case 'TRIM': {
        return String(evalSimpleExpr(sheet, argsStr)).replace(/^"|"$/g, '').trim();
      }
      case 'UPPER': {
        return String(evalSimpleExpr(sheet, argsStr)).replace(/^"|"$/g, '').toUpperCase();
      }
      case 'LOWER': {
        return String(evalSimpleExpr(sheet, argsStr)).replace(/^"|"$/g, '').toLowerCase();
      }
      case 'ROUND': {
        const args = splitArgs(argsStr);
        const num = Number(evalSimpleExpr(sheet, args[0]));
        const digits = args[1] ? Number(evalSimpleExpr(sheet, args[1])) : 0;
        return Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits);
      }
      case 'ABS': {
        return Math.abs(Number(evalSimpleExpr(sheet, argsStr)));
      }
      case 'TODAY': {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
      case 'NOW': {
        return new Date().toLocaleString();
      }
    }
  }

  // Basic arithmetic with cell references
  return evalSimpleExpr(sheet, expr);
}

/** Split function arguments respecting nested parentheses */
function splitArgs(str) {
  const args = [];
  let depth = 0, current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/** Match SUMIF/COUNTIF criteria (number comparison or string match) */
function matchCriteria(value, criteria) {
  const cs = String(criteria).replace(/^"|"$/g, '');
  const cMatch = cs.match(/^([<>=!]+)(.+)$/);
  if (cMatch) {
    const op = cMatch[1];
    const cval = Number(cMatch[2]);
    const nval = Number(value);
    if (!isNaN(cval) && !isNaN(nval)) {
      if (op === '>') return nval > cval;
      if (op === '<') return nval < cval;
      if (op === '>=') return nval >= cval;
      if (op === '<=') return nval <= cval;
      if (op === '<>' || op === '!=') return nval !== cval;
      if (op === '=') return nval === cval;
    }
  }
  return String(value).toLowerCase() === cs.toLowerCase();
}

/** Resolve range as 2D table (for VLOOKUP) */
function resolveRangeAsTable(sheet, rangeStr) {
  const part = rangeStr.trim();
  if (!part.includes(':')) return [];
  const [startRef, endRef] = part.split(':');
  const start = refToRC(startRef.trim());
  const end = refToRC(endRef.trim());
  if (!start || !end) return [];
  const r1 = Math.min(start[0], end[0]);
  const r2 = Math.max(start[0], end[0]);
  const c1 = Math.min(start[1], end[1]);
  const c2 = Math.max(start[1], end[1]);
  const table = [];
  for (let r = r1; r <= r2; r++) {
    const row = [];
    for (let c = c1; c <= c2; c++) {
      const v = getDisplayValue(sheet, r, c);
      const num = Number(v);
      row.push(isNaN(num) || v === '' ? v : num);
    }
    table.push(row);
  }
  return table;
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
