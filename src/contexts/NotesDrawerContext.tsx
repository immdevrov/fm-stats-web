import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseButton, Drawer, Portal } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import { PlayerNotesLog } from "../components/PlayerNotesLog";
import type { PlayerIdentity } from "./PlayerNotesContext";

export interface NotesTarget {
  uid: number;
  name: string;
  identity?: PlayerIdentity;
  briefId?: string;
}

interface NotesDrawerContextValue {
  open: (target: NotesTarget) => void;
}

const NotesDrawerContext = createContext<NotesDrawerContextValue | null>(null);

export function NotesDrawerProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<{ target: NotesTarget; openId: number; isOpen: boolean } | null>(null);
  const [seenKey, setSeenKey] = useState(location.key);
  const opens = useRef(0);

  if (seenKey !== location.key) {
    setSeenKey(location.key);
    if (state?.isOpen) setState({ ...state, isOpen: false });
  }

  const open = useCallback((target: NotesTarget) => {
    opens.current += 1;
    setState({ target, openId: opens.current, isOpen: true });
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <NotesDrawerContext.Provider value={value}>
      {children}
      <Drawer.Root
        open={state?.isOpen ?? false}
        placement="end"
        size="md"
        onOpenChange={(e) => {
          if (!e.open) setState((current) => current && { ...current, isOpen: false });
        }}
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>{state?.target.name}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                {state && (
                  <PlayerNotesLog
                    key={state.openId}
                    uid={state.target.uid}
                    player={state.target.identity}
                    defaultBriefId={state.target.briefId}
                  />
                )}
              </Drawer.Body>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </NotesDrawerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotesDrawer() {
  const ctx = useContext(NotesDrawerContext);
  if (!ctx) throw new Error("useNotesDrawer must be used within NotesDrawerProvider");
  return ctx;
}
