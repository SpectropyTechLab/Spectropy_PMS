export type CsvCell = string | number | boolean | null | undefined | Date;

export interface CsvSection {
  title?: string;
  headers?: string[];
  rows: CsvCell[][];
}

const sanitizeFilename = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return cleaned.length > 0 ? cleaned : "report";
};

const normalizeValue = (value: CsvCell) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const escapeCsv = (value: string) => {
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  return /[",\n]/.test(value) ? `"${value}"` : value;
};

export const downloadCsvSections = (filename: string, sections: CsvSection[]) => {
  const safeName = sanitizeFilename(filename);
  const lines: string[] = [];

  sections.forEach((section, index) => {
    if (section.title) {
      lines.push(escapeCsv(section.title));
    }

    if (section.headers && section.headers.length > 0) {
      lines.push(section.headers.map((header) => escapeCsv(header)).join(","));
    }

    const rows = section.rows.length > 0 ? section.rows : [["No data"]];
    rows.forEach((row) => {
      const line = row.map((cell) => escapeCsv(normalizeValue(cell))).join(",");
      lines.push(line);
    });

    if (index < sections.length - 1) {
      lines.push("");
    }
  });

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName.endsWith(".csv") ? safeName : `${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
