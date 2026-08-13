import { Card, Text } from "@radix-ui/themes";

const Team1Tab = () => {
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
