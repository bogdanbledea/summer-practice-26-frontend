export type Task = {
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


export type Inputs = {
  title: string;
};