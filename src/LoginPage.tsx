import {
  Button,
  Container,
  Flex,
  Heading,
  TextField,
  Callout,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
type Inputs = {
  username: string;
  password: string;
};

const API_URL = import.meta.env.VITE_API_URL;

console.log(API_URL);

const LoginPage = () => {
  const navigate = useNavigate();
  const { userLoggedIn, setUserLoggedIn } = useAuth();
  const { register, handleSubmit, formState } = useForm<Inputs>();
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (userLoggedIn) {
      navigate("/");
    }
  }, [userLoggedIn]);

  const onSubmit = (data: Inputs) => {
    fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then(async (res) => {
        const jsonResponse = await res.json();
        if (res.ok) {
          return jsonResponse;
        }
        setErrorMessage(jsonResponse.error);
      })
      .then((json) => {
        localStorage.setItem("accessToken", json.accessToken);
        localStorage.setItem("refreshToken", json.refreshToken);
        setUserLoggedIn(true);
      });
  };

  return (
    <Container size="1" p="4">
      <Heading align="center">Login</Heading>
      {!!errorMessage && (
        <Callout.Root size="1" color="red">
          <Callout.Text>{errorMessage}</Callout.Text>
        </Callout.Root>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Flex direction="column" gap="2" mt="4">
          <Flex>
            <TextField.Root
              {...register("username", { required: true })}
              className="w-full"
              placeholder="Fill in your username"
            />
          </Flex>
          <Flex>
            <TextField.Root
              {...register("password", { required: true })}
              type="password"
              className="w-full"
              placeholder="Fill in your password"
            />
          </Flex>
          <Flex>
            <Button disabled={!formState.isValid} className="w-full">
              Login
            </Button>
          </Flex>
          <Flex>
            <Link className="underline text-blue-400" to="/register">
              Create an account instead
            </Link>
          </Flex>
        </Flex>
      </form>
    </Container>
  );
};

export default LoginPage;
