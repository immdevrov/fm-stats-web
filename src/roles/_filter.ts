import { Role } from "./_role";

export type filterFn<T extends Role> = (_p: T) => boolean;
export type filterMap<T extends Role> = Record<string, filterFn<T>>;

/**
 * gets list of filter functions and piping them onto one
 * returns true if all are true
 * if one of them returned false - result is false
 */
export function everyFilter<T extends Role>(
  fnList: Array<filterFn<T>>
): filterFn<T> {
  return (d: T) => fnList.every((fn) => fn(d));
}

/**
 * its easier to create filters while giving them names as keys of an object
 */
export function applyFilters<T extends Role>(
  players: T[],
  filters: filterMap<T>
) {
  const filterList = Object.values(filters);
  return players.filter(everyFilter(filterList));
}
