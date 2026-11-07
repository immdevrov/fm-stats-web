import { createContext, useContext } from "react";
import type { PositionedPlayer } from "../../utils/planner";

export type DragKind = "marker" | "card" | "candidate" | null;

export interface DragState {
  kind: DragKind;
  player: PositionedPlayer | null;
}

export const DragStateContext = createContext<DragState>({ kind: null, player: null });

export const useDragKind = () => useContext(DragStateContext).kind;

export const usePlayerDrag = () => {
  const kind = useDragKind();
  return kind === "card" || kind === "candidate";
};

export const useDraggedPlayer = () => useContext(DragStateContext).player;
