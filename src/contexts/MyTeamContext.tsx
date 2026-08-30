import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";

interface MyTeamContextValue {
  myClub: string | null;
  isLoaded: boolean;
  setMyClub: (club: string) => void;
  clearMyClub: () => void;
}

const MyTeamContext = createContext<MyTeamContextValue | null>(null);

export function MyTeamProvider({ children }: { children: ReactNode }) {
  const [myClub, setMyClubState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    db.getMyClub().then((club) => {
      setMyClubState(club);
      loaded.current = true;
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    db.setMyClub(myClub);
  }, [myClub]);

  const setMyClub = useCallback((club: string) => setMyClubState(club), []);
  const clearMyClub = useCallback(() => setMyClubState(null), []);

  return (
    <MyTeamContext.Provider value={{ myClub, isLoaded, setMyClub, clearMyClub }}>
      {children}
    </MyTeamContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMyTeam() {
  const ctx = useContext(MyTeamContext);
  if (!ctx) throw new Error("useMyTeam must be used within MyTeamProvider");
  return ctx;
}
