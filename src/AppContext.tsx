import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import axiosInstance from "./lib/axiosInstance";
import type { AxiosResponse } from "axios";
import type { Task, Inputs } from "./lib/types";

type TasksDataProps = {
  items: Task[];
  total: number;
  loading: boolean;
  loaded: boolean;
};

type AppContextValue = {
  userLoggedIn: boolean;
  userProfile: UserProfile | undefined;
  tasksData: TasksDataProps;
  setUserLoggedIn: (v: boolean) => void;
  getMe: () => void;
  getTasks: () => void;
  deleteTask: (id: number) => void;
  postTask: (data: Inputs) => Promise<void>;
};

type UserProfile = {
  id: number;
  name: string;
  username: string;
};

const AppContext = createContext<AppContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const isThereATokenInLocalStorage = !!localStorage.getItem("accessToken");
  const [userLoggedIn, setUserLoggedIn] = useState(isThereATokenInLocalStorage);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>();
  const [tasksData, setTasksData] = useState<TasksDataProps>({
    items: [],
    total: 0,
    loading: false,
    loaded: false,
  });

  const getMe = () => {
    axiosInstance.get("/me").then((res) => setUserProfile(res.data));
  };

  const getTasks = () => {
    if (tasksData.items.length > 0 || tasksData.loading) {
      return;
    }
    axiosInstance
      .get("/tasks", {
        params: {
          scope: "all",
        },
      })
      .then((res: AxiosResponse) => {
        setTasksData({ ...res.data, loading: false });
      });
  };

  const postTask = async (data: Inputs) => {
    const response = await axiosInstance.post("/tasks", {
      title: data.title,
    });
    const newTask = response.data;
    setTasksData((prev) => {
      return {
        ...prev,
        items: [newTask, ...prev.items],
      };
    });
    Promise.resolve();
  };

  const deleteTask = (id: number) => {
    axiosInstance.delete(`/tasks/${id}`).then(() => {
      setTasksData((prev) => {
        const newList = prev.items.filter((item) => item.id !== id);
        return {
          ...prev,
          items: newList,
        };
      });
    });
  };

  const value = useMemo(
    () => ({
      userLoggedIn,
      setUserLoggedIn,
      userProfile,
      getMe,
      getTasks,
      tasksData,
      postTask,
      deleteTask,
    }),
    [userLoggedIn, userProfile, tasksData],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within an AppProvider");
  return ctx;
};
