import { Card, Text } from "@radix-ui/themes";

const Team3Tab = () => {
  return (
    <Card size="3">
      <div className="flex min-h-40 items-center justify-center">
        <Text as="p" align="center" color="gray">
          Team 3 builds the message board here, against /api/messages.
        </Text>
      </div>
    </Card>
  );
};

export default Team3Tab;
