import { Card, Flex, TextField, Button } from "@radix-ui/themes";
import { useState, useEffect } from "react";
import axiosInstance from "../../lib/axiosInstance";
import type { AxiosResponse } from "axios";
import { useForm } from "react-hook-form";

type MessageInputForm = {
  text: string;
};
type MessagesData = {
  items: Message[];
  total: number;
  loading: boolean;
};
type Message = {
  id: number;
  text: string;
  author: { username: string; name: string };
  mine: boolean;
  createdAt: Date;
};

const Team3Tab = () => {
  const [messagesData, setMessagesData] = useState<MessagesData>({
    items: [],
    total: 0,
    loading: true,
  });

  const { register, handleSubmit, setValue } = useForm<MessageInputForm>();
  //Get Messages
  useEffect(() => {
    axiosInstance.get("/messages").then((res: AxiosResponse) => {
      setMessagesData({
        items: res.data.items,
        total: res.data.total,
        loading: false,
      });
    });
  }, []);

  console.log(messagesData);
  //Post Messages
  const onSubmit = async (data: MessageInputForm) => {
    const response = await axiosInstance.post("/messages", {
      text: data.text,
    });
    const createdMessage = response.data;
    setMessagesData((prev) => {
      return {
        ...prev,
        items: [...prev.items, createdMessage],
      };
    });
    setValue("text", "");
  };

  //Delete Message
  //const handleDelete = () => {};

  return (
    <Card size="3">
      {messagesData.items &&
        messagesData.items.length > 0 &&
        messagesData.items.map((message) => (
          <div key={message.id}>
            <Card>
              <Flex maxWidth={"-1"}>{message.text}</Flex>
            </Card>
          </div>
        ))}
      <div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Flex>
            <Flex flexGrow={"1"}>
              <TextField.Root
                {...register("text")}
                placeholder="Type a message"
                className="w-full"
              />
            </Flex>
            <Flex>
              <Button>Send</Button>
            </Flex>
          </Flex>
        </form>
      </div>
    </Card>
  );
};

export default Team3Tab;
