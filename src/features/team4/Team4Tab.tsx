import { Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import type { AxiosResponse } from "axios";
import axiosInstance from "../../lib/axiosInstance";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";


type LinkItem = {
    id: number,
    title: string,
    url: string,
    tag: string,
    createdAt: string
};

type ItemToBeCreated = {
    title: string,
    url: string,
    tag?: string
};

type ItemToBeUpdated = {
    title?: string,
    url?: string,
    tag?: string
};


const Team4Tab = () => {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const { register, handleSubmit, formState, setValue } = useForm<ItemToBeCreated>();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editUrl, setEditUrl] = useState<string>("");
    const [editTitle, setEditTitle] = useState<string>("");

    const addLink = (title: string, url: string, tag?: string) => {
        axiosInstance.post(("/links"), { title, url, tag }).then((res: AxiosResponse) => {
            setLinks((prev) => [res.data, ...prev,]);
        });
        setValue("title", "");
        setValue("url", "");
        setValue("tag", "");
    }
    const updateLink = (id: number, data: ItemToBeUpdated) => {
        axiosInstance
            .patch(`/links/${id}`, data)
            .then((res: AxiosResponse<LinkItem>) => {
                setLinks((prev) =>
                    prev.map((link) =>
                        link.id === id ? res.data : link
                    )
                );
            });
    };

    const startEditing = (link: LinkItem) => {
        setEditingId(link.id);
        setEditUrl(link.url);
        setEditTitle(link.title);
    }

    const saveEdit = (id: number) => {
        updateLink(id, {
            title: editTitle,
            url: editUrl,
        });

        setEditingId(null);
    };

    useEffect(() => {
        axiosInstance.get("/links").then((res: AxiosResponse) => {
            setLinks(res.data.items);
        });
    }, []);

    return (
        <Card size="3">
            <div className="flex flex-col gap-4">
                <form onSubmit={handleSubmit((data) => addLink(data.title, data.url, data.tag))}>
                    <Flex>
                        <Flex flexGrow="1">
                            <TextField.Root
                                className="w-full"
                                placeholder="Title"
                                {...register("title")}
                            />
                            <TextField.Root
                                className="w-full"
                                placeholder="URL"
                                {...register("url")}
                            />
                            <TextField.Root
                                className="w-full"
                                placeholder="Tag"
                                {...register("tag")}
                            />
                        </Flex>
                        <Flex>
                            <Button type="submit">Add Link</Button>
                        </Flex>
                    </Flex>
                </form>
                {links.length > 0 &&
                    links.map((link) => (
                        <div key={link.id} className="border-b pb-3">
                            {editingId === link.id ? (
                                <Flex direction="column" gap="2">
                                    <TextField.Root
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                    />

                                    <TextField.Root
                                        value={editUrl}
                                        onChange={(e) => setEditUrl(e.target.value)}
                                    />

                                    <Flex gap="2">
                                        <Button onClick={() => saveEdit(link.id)}>
                                            Save
                                        </Button>

                                        <Button
                                            variant="soft"
                                            onClick={() => setEditingId(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </Flex>
                                </Flex>
                            ) : (
                                <Flex justify="between" align="center">
                                    <Text as="p" weight="bold">
                                        {link.title}, {link.url}, {link.tag}
                                    </Text>

                                    <Button onClick={() => startEditing(link)}>
                                        Edit
                                    </Button>
                                </Flex>
                            )}
                        </div>
                    ))}
            </div>
        </Card>
    );
};

export default Team4Tab;

