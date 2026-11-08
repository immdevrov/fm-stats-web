import type { SortDirection } from "../components/ui/table";
import type { HorizonPreset } from "./planner";

export type Side = "both" | "left" | "right";

export type ContractHorizon = Exclude<HorizonPreset, "now">;

export type ColumnFilters = Record<string, { min?: string; max?: string }>;

export interface ScoutingFilters {
  roleKey: string;
  side: Side;
  columnFilters: ColumnFilters;
  contractHorizon: ContractHorizon | null;
  excludeInjuries: boolean;
  excludedLeagues: string[];
  sortKey: string;
  sortDirection: SortDirection;
}

export interface Archetype {
  id: string;
  name: string;
  filters: ScoutingFilters;
  listId?: string;
}
