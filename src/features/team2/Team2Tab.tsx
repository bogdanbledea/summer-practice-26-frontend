import { Button, Card, Flex, Select, TextField } from "@radix-ui/themes";

import { Controller, useForm } from "react-hook-form";
import axiosInstance from "../../lib/axiosInstance";
import { useEffect, useMemo, useState } from "react";
import type { AxiosResponse } from "axios";
 

type Expense = {
  id: number,
  title: string,
  amount: number,
  category: string,
  date: string,
  createdAt: string
}

type Inputs = {
  title: string;
  amount: number;
  category: string;
  date: string;
};

const Team2Tab = () => {
  const { register, handleSubmit, formState, setValue, control } = useForm<Inputs>();
  const [expenseData, setExpenseData] = useState<{
    items: Expense[];
    total: number;
    loading: boolean;
  }>({ items: [], total: 0, loading: true });

  const expensesByCategory = useMemo(() => {
    return expenseData.items.reduce<Record<string, Expense[]>>((groups, expense) => {
      groups[expense.category] ??= [];
      groups[expense.category].push(expense);
      return groups;
    }, {});
  }, [expenseData.items]);

  useEffect(() => {
    axiosInstance
      .get("/expenses", {
        params: {
          scope: "all",
        },
      })
      .then((res: AxiosResponse) => {
        setExpenseData({ ...res.data, loading: false });
      });
  }, []);

    const onSubmit = (data: Inputs) => {
      console.log(data);
      axiosInstance
        .post("/expenses", {
          title: data.title,
          amount: data.amount,
          category: data.category,
        })
        .then((res) =>
          setExpenseData((prev) => ({
            ...prev,
            items: [res.data, ...prev.items],
          })),
        );
      setValue("title", "");
    };

    const handleDelete = (id: Expense["id"]) => {
    axiosInstance.delete(`/expenses/${id}`).then(() => {
      setExpenseData((prev) => {
        const newList = prev.items.filter((item) => item.id !== id);
        return {
          ...prev,
          items: newList,
        };
      });
    });
  };


  return (
    <Card size="3">
      <div className="min-h-40">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Flex>
            <Flex flexGrow="1" gap="2" mr= "2">
              <TextField.Root
                {...register("title")}
                className="w-full"
                placeholder="Type here the expense name"
              />
              <TextField.Root type = "number"
                {...register("amount")}
                className="w-full"
                placeholder="Type here the amount"
              />
              <Controller
                name="category"
                control={control}
                defaultValue="category"
                render={({ field }) => (
                  <Select.Root
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <Select.Trigger />
                  <Select.Content >
                    <Select.Item value="category">category</Select.Item>
                    <Select.Item value="food">food</Select.Item>
                    <Select.Item value="transport">transport</Select.Item>
                    <Select.Item value="books">books</Select.Item>
                    <Select.Item value="gear">gear</Select.Item>
                    <Select.Item value="fun">fun</Select.Item>
                    <Select.Item value="other">other</Select.Item>                    
                  </Select.Content>
                  </Select.Root>
                )}
              />
            </Flex>
            <Flex>
              <Button disabled={!formState.isValid}>Add expense</Button>
            </Flex>
          </Flex>
        </form>
        <Flex mt="3" direction={"column"} gap="2">
          {expenseData.loading && "Loading tasks..."}
          {expenseData.items.length === 0 &&
            !expenseData.loading &&
            "There are no tasks"}
          {Object.entries(expensesByCategory).map(([category, expenses]) => (
            <div key={category}>
              <h3>{category}</h3>
              {expenses.map((item) => (
                <Card key={item.id}>
                  <Flex>
                    <Flex flexGrow="1">{item.title}</Flex>
                    <Flex flexGrow="1">{item.amount}</Flex>
                    <Flex flexGrow="1">{item.category}</Flex>
                    <Flex flexGrow="1">{item.date}</Flex>
                    <Flex flexGrow="1">{item.createdAt}</Flex>
                    <Flex>
                      <Button onClick={() => handleDelete(item.id)} color="red">
                        X
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </div>
          ))}
        </Flex>
      </div>
    </Card>
  );
};

export default Team2Tab;
