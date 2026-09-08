import { Flex } from "@radix-ui/themes";
import { useEffect } from "react";
import { useAppContext } from "./AppContext";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

const LogoutPage = () => {
  const { userLoggedIn, setUserLoggedIn } = useAppContext();
  console.log(userLoggedIn);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userLoggedIn) {
      navigate("/");
    }
  }, [userLoggedIn]);
  useEffect(() => {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: localStorage.getItem("refreshToken"),
      }),
    }).then((res) => {
      console.log(res);
      if (res.ok) {
        localStorage.clear();
        setUserLoggedIn(false);
      }
    });
  }, []);
  return (
    <Flex height="100vh" align="center" justify="center">
      logging you out... please wait...
    </Flex>
  );
};

export default LogoutPage;
