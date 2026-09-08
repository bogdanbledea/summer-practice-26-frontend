import { Card, Text } from "@radix-ui/themes";

const Team5Tab = () => {
  return (
    <Card size="3">
      <div className="flex min-h-40 items-center justify-center">
        <Text as="p" align="center" color="gray">
          Team 5 builds a leaderboard here, against /api/scores.
        </Text>
      </div>
    </Card>
  );
};

export default Team5Tab;
