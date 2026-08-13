import { Card, Text } from "@radix-ui/themes";

const Team2Tab = () => {
  return (
    <Card size="3">
      <div className="flex min-h-40 items-center justify-center">
        <Text as="p" align="center" color="gray">
          Team 2 builds expenses here, against /api/expenses.
        </Text>
      </div>
    </Card>
  );
};

export default Team2Tab;
