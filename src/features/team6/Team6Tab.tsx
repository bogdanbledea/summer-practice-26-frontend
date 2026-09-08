import { Card, Text } from "@radix-ui/themes";

const Team6Tab = () => {
  return (
    <Card size="3">
      <div className="flex min-h-40 items-center justify-center">
        <Text as="p" align="center" color="gray">
          Team 6 builds an event sign-up sheet here, against /api/events.
        </Text>
      </div>
    </Card>
  );
};

export default Team6Tab;
