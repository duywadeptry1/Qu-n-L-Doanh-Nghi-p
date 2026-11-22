function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an Excel-compatible UTF-8 BOM CSV string for Vietnamese text.
 */
function buildCsv(headers, rows) {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map(row => row.map(escapeCsvCell).join(','));
  return `\uFEFF${[headerLine, ...bodyLines].join('\r\n')}\r\n`;
}

module.exports = { buildCsv };
