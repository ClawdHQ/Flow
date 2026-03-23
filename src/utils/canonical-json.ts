function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const nextValue = (value as Record<string, unknown>)[key];
        if (nextValue !== undefined) {
          acc[key] = sortValue(nextValue);
        }
        return acc;
      }, {});
  }

  return value;
}

export function canonicalize(value: unknown): unknown {
  return sortValue(value);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
