import { Card, Text } from "@radix-ui/themes";

const Team4Tab = () => {
  return (
    <Card size="3">
      <div className="flex min-h-40 items-center justify-center">
        <Text as="p" align="center" color="gray">
          Team 4 builds a reading list here, against /api/links.
        </Text>
      </div>
    </Card>
  );
};

export default Team4Tab;
