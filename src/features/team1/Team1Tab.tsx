import { Button, Card, Flex, TextField } from "@radix-ui/themes";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { Inputs, Task } from "../../lib/types";
import { useAppContext } from "../../AppContext";

const Team1Tab = () => {
  const { register, handleSubmit, formState, setValue } = useForm<Inputs>();
  const { getTasks, tasksData, deleteTask, postTask } = useAppContext();

  useEffect(() => {
    getTasks();
  }, []);

  const handleDelete = (id: Task["id"]) => {
    deleteTask(id);
  };

  const onSubmit = async (data: Inputs) => {
    await postTask(data);
    setValue("title", "");
  };

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
          {!tasksData.loading &&
            tasksData.items.length === 0 &&
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
