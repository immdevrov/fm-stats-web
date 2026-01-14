import { Role } from "../roles/_role";

export function getFilters<T extends Role>() {
  return {
    noInjuriesFilter: (g: T) => !g.injuries,
    timePlayed: (g: T) => g.minutes >= 1000,
  };
}
