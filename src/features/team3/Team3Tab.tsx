import { Button, Card, Flex, Text, TextArea, TextField } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { AxiosResponse } from "axios";
import axiosInstance from "../../lib/axiosInstance";

type Message = {
  id: number;
  text: string;
  author: {
    username: string;
    name: string;
  };
  mine: boolean;
  createdAt: string;
};

type Inputs = {
  text: string;
};

const Team3Tab = () => {
  const { register, handleSubmit, reset } = useForm<Inputs>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    axiosInstance.get("/messages").then((res: AxiosResponse<Message[] | { items: Message[] }>) => {
      const fetchedMessages = Array.isArray(res.data) ? res.data : res.data.items;
      setMessages(fetchedMessages);
      setLoading(false);
    });
  }, []);

  const onSubmit = (data: Inputs) => {
    axiosInstance.post("/messages", data).then((res: AxiosResponse<Message>) => {
      setMessages((previous) => [res.data, ...previous]);
      reset();
    });
  };

  const saveEdit = (id: number) => {
    axiosInstance
      .patch(`/messages/${id}`, { text: editingText })
      .then((res: AxiosResponse<Message>) => {
        setMessages((previous) =>
          previous.map((message) => (message.id === id ? res.data : message)),
        );
        setEditingId(null);
      });
  };

  const handleDelete = (id: number) => {
    axiosInstance.delete(`/messages/${id}`).then(() => {
      setMessages((previous) => previous.filter((message) => message.id !== id));
    });
  };

  return (
    <Card size="3">
      <div className="min-h-40">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Flex gap="2" align="end">
            <TextField.Root
              {...register("text", { required: true })}
              className="w-full"
              placeholder="Write a message"
            />
            <Button type="submit">Send</Button>
          </Flex>
        </form>

        <Flex mt="4" direction="column" gap="2">
          {loading && <Text color="gray">Loading messages...</Text>}
          {!loading && messages.length === 0 && (
            <Text color="gray">There are no messages</Text>
          )}
          {messages.map((message) => (
            <Flex
              key={message.id}
              direction="column"
              align={message.mine ? "end" : "start"}
            >
              <Card
                style={{
                  maxWidth: "75%",
                  backgroundColor: message.mine ? "var(--accent-3)" : "var(--gray-3)",
                }}
              >
                {!message.mine && <Text size="2">{message.author.name}</Text>}
                {editingId === message.id ? (
                  <Flex direction="column" gap="2">
                    <TextArea
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                    />
                    <Flex gap="2">
                      <Button type="button" onClick={() => saveEdit(message.id)}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="soft"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </Flex>
                  </Flex>
                ) : (
                  <Text as="p">{message.text}</Text>
                )}
                <Text size="1" color="gray">
                  {new Date(message.createdAt).toLocaleString()}
                </Text>
                {message.mine && editingId !== message.id && (
                  <Flex gap="2" mt="2">
                    <Button
                      type="button"
                      size="1"
                      onClick={() => {
                        setEditingId(message.id);
                        setEditingText(message.text);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="1"
                      onClick={() => handleDelete(message.id)}
                    >
                      Delete
                    </Button>
                  </Flex>
                )}
              </Card>
            </Flex>
          ))}
        </Flex>
      </div>
    </Card>
  );
};

export default Team3Tab;
