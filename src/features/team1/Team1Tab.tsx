import { Card, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import axiosInstance from "../../lib/axiosInstance";

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
const Team1Tab = () => {
  const [tasks, setTasks] = useState<Task[]>();

  useEffect(() => {
    axiosInstance.get("/tasks");
    // the call to manually create a todo
    // axiosInstance.post("/tasks", {title: 'My first todo'})
  }, []);

  return (
    <Card size="3">
      <div className="flex min-h-40 items-center justify-center">
        <Text as="p" align="center" color="gray">
          Team 1 builds tasks here, against /api/tasks.
        </Text>
      </div>
    </Card>
  );
};

export default Team1Tab;
