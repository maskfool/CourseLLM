export function prettyBytes(n:number) {
  if (!n) return "0 B"
  const units = ["B","KB","MB","GB","TB"]; const k = 1024; const i = Math.floor(Math.log(n)/Math.log(k))
  return `${(n/Math.pow(k,i)).toFixed(1)} ${units[i]}`
}