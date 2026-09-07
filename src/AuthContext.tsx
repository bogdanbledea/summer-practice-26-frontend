import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

type AuthContextValue = {
  userLoggedIn: boolean;
  setUserLoggedIn: (v: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const isThereATokenInLocalStorage = !!localStorage.getItem("accessToken");
  const [userLoggedIn, setUserLoggedIn] = useState(isThereATokenInLocalStorage);

  const value = useMemo(
    () => ({ userLoggedIn, setUserLoggedIn }),
    [userLoggedIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
