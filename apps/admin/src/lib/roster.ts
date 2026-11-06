/** "Name, email, grade, section" per line (a pasted spreadsheet works too: tabs or commas). */
export function parseRoster(text: string) {
  const rows: { name: string; email?: string; grade: number; section?: string }[] = []; const bad: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const cells = line.split(/\t|,|;/).map((x) => x.trim()).filter((x, j, a) => x || j < a.length - 1);
    if (!cells.length || !cells[0]) return;
    if (i === 0 && /^name$/i.test(cells[0])) return; // header row
    const email = cells.find((c) => /@/.test(c));
    const grade = Number(cells.find((c) => /^\d{1,2}$/.test(c)));
    const section = cells.find((c) => /^\d{1,2}[A-Za-z]{1,2}$/.test(c));
    if (!grade || grade > 13) { bad.push(i + 1); return; }
    rows.push({ name: cells[0], ...(email ? { email: email.toLowerCase() } : {}), grade, ...(section ? { section: section.toUpperCase() } : {}) });
  });
  return { rows, bad };
}
