import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";

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
  const userChanged = useRef(false);

  useEffect(() => {
    db.getMyClub().then((club) => {
      setMyClubState((current) => (userChanged.current ? current : club));
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    db.setMyClub(myClub).catch(() => {
      toaster.create({
        title: "My Team Not Saved",
        description: "Your club selection could not be saved.",
        type: "error",
        duration: 3000,
      });
    });
  }, [isLoaded, myClub]);

  const setMyClub = useCallback((club: string) => {
    userChanged.current = true;
    setMyClubState(club);
  }, []);
  const clearMyClub = useCallback(() => {
    userChanged.current = true;
    setMyClubState(null);
  }, []);

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
