import {
  Button,
  Callout,
  Container,
  Flex,
  Heading,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
type Inputs = {
  username: string;
  password: string;
};

const API_URL = import.meta.env.VITE_API_URL;

console.log(API_URL);

const RegisterPage = () => {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { register, handleSubmit, formState } = useForm<Inputs>();
  const navigate = useNavigate();
  const { userLoggedIn } = useAuth();

  useEffect(() => {
    if (userLoggedIn) {
      navigate("/");
    }
  }, [userLoggedIn]);

  const onSubmit = (data: Inputs) => {
    fetch(`${API_URL}/auth/register`, {
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
        console.log(json);
      });
  };

  return (
    <Container size="1" p="4">
      <Heading align="center">Register</Heading>
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
              Register
            </Button>
          </Flex>
        </Flex>
      </form>
    </Container>
  );
};

export default RegisterPage;
