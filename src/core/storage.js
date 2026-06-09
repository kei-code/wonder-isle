export function readBest(key) {
  return Number(localStorage.getItem(key) || 0);
}

export function writeBest(key, value) {
  localStorage.setItem(key, String(value));
}
