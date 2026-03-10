export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

export function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}
