import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { useOnTabReturn } from "../hooks/useOnTabReturn";

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
  const changes = useRef(0);

  useEffect(() => {
    db.getMyClub().then((club) => {
      setMyClubState((current) => (changes.current > 0 ? current : club));
      setIsLoaded(true);
    });
  }, []);

  useOnTabReturn(() => {
    if (!isLoaded) return;
    const start = changes.current;
    db.getMyClub()
      .then((club) => {
        if (changes.current === start) setMyClubState(club);
      })
      .catch(() => undefined);
  });

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
    changes.current++;
    setMyClubState(club);
  }, []);
  const clearMyClub = useCallback(() => {
    changes.current++;
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
