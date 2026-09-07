import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import axiosInstance from "./lib/axiosInstance";

type AuthContextValue = {
  userLoggedIn: boolean;
  setUserLoggedIn: (v: boolean) => void;
  userProfile: UserProfile | undefined;
  getMe: () => void;
};

type UserProfile = {
  id: number;
  name: string;
  username: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const isThereATokenInLocalStorage = !!localStorage.getItem("accessToken");
  const [userLoggedIn, setUserLoggedIn] = useState(isThereATokenInLocalStorage);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>();

  const getMe = () => {
    axiosInstance.get("/me").then((res) => setUserProfile(res.data));
  };

  const value = useMemo(
    () => ({ userLoggedIn, setUserLoggedIn, userProfile, getMe }),
    [userLoggedIn, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
