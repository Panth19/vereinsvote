// German Excel expects ";" as separator and needs a BOM to read UTF-8,
// otherwise everything ends up in one column and umlauts break.
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    let s = String(v);
    // a cell starting with = + - @ would be run as a formula
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(cell).join(';'));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
