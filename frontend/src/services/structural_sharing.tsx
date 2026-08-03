function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Re-uses references from oldValue for deeply-equal subtrees of newValue, so React.memo can skip unchanged rows after a refetch.
export function structuralShare<T>(oldValue: T, newValue: T): T {
  if (oldValue === newValue) {
    return oldValue;
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length !== newValue.length) {
      return newValue.map((item, i) => structuralShare(oldValue[i], item)) as unknown as T;
    }
    let changed = false;
    const result = newValue.map((item, i) => {
      const shared = structuralShare(oldValue[i], item);
      if (shared !== oldValue[i]) changed = true;
      return shared;
    });
    return (changed ? result : oldValue) as T;
  }

  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const oldKeys = Object.keys(oldValue);
    const newKeys = Object.keys(newValue);
    if (oldKeys.length !== newKeys.length) {
      const result: Record<string, unknown> = {};
      for (const key of newKeys) {
        result[key] = structuralShare(oldValue[key], newValue[key]);
      }
      return result as T;
    }
    let changed = false;
    const result: Record<string, unknown> = {};
    for (const key of newKeys) {
      const shared = structuralShare(oldValue[key], newValue[key]);
      if (shared !== oldValue[key]) changed = true;
      result[key] = shared;
    }
    return (changed ? result : oldValue) as T;
  }

  return newValue;
}
