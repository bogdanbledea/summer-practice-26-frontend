import { Button, Card, Flex, TextField } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import axiosInstance from "../../lib/axiosInstance";
import type { AxiosResponse } from "axios";
import { useForm } from "react-hook-form";

type Task = {
  id: number;
  title: string;
  done: boolean;
  dueDate: string;
  owner: { username: string; name: string };
  assignee: { username: string; name: string };
  mine: boolean;
  assignedToMe: boolean;
  createdAt: string;
};

type Inputs = {
  title: string;
};
const Team1Tab = () => {
  const { register, handleSubmit, formState, setValue } = useForm<Inputs>();
  const [tasksData, setTasksData] = useState<{
    items: Task[];
    total: number;
    loading: boolean;
  }>({ items: [], total: 0, loading: true });

  useEffect(() => {
    axiosInstance
      .get("/tasks", {
        params: {
          scope: "all",
        },
      })
      .then((res: AxiosResponse) => {
        setTasksData({ ...res.data, loading: false });
      });
  }, []);

  const handleDelete = (id: Task["id"]) => {
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

  const onSubmit = (data: Inputs) => {
    axiosInstance
      .post("/tasks", {
        title: data.title,
      })
      .then((res) =>
        setTasksData((prev) => {
          const task = res.data;
          return {
            ...prev,
            items: [task, ...prev.items],
          };
        }),
      );
    setValue("title", "");
  };

  console.log(tasksData);

  return (
    <Card size="3">
      <div className="min-h-40">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Flex>
            <Flex flexGrow="1">
              <TextField.Root
                {...register("title")}
                className="w-full"
                placeholder="Type here your todo"
              />
            </Flex>
            <Flex>
              <Button disabled={!formState.isValid}>Add task</Button>
            </Flex>
          </Flex>
        </form>
        <Flex mt="3" direction={"column"} gap="2">
          {tasksData.loading && "Loading tasks..."}
          {tasksData.items.length === 0 &&
            !tasksData.loading &&
            "There are no tasks"}
          {tasksData?.items.map((item) => {
            return (
              <Card key={item.id}>
                <Flex>
                  <Flex flexGrow="1">{item.title}</Flex>
                  <Flex>
                    <Button onClick={() => handleDelete(item.id)} color="red">
                      X
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      </div>
    </Card>
  );
};

export default Team1Tab;
