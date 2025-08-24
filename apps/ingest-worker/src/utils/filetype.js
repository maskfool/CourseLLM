// src/utils/filetype.js
export function getTypeFromPath(p = "") {
  const m = /\.([a-zA-Z0-9]+)$/.exec(p);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  if (["pdf", "csv", "json", "txt", "srt", "vtt"].includes(ext)) return ext;
  return null;
}