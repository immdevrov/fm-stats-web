import { createContext, useContext } from "react";

export type DragKind = "marker" | "card" | null;

export const DragKindContext = createContext<DragKind>(null);

export const useDragKind = () => useContext(DragKindContext);
