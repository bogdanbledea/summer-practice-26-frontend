import { Box, Container, Flex, Heading, Tabs, Text } from "@radix-ui/themes";
import Team1Tab from "./features/team1/Team1Tab";
import Team2Tab from "./features/team2/Team2Tab";
import Team3Tab from "./features/team3/Team3Tab";

const App = () => {
  return (
    <Container size="3" p="4">
      <Flex direction="column" gap="5">
        <Flex direction="column" gap="1" asChild>
          <header>
            <Heading size="7">Summer Practice</Heading>
            <Text size="2" color="gray">
              One app, three tabs, three teams.
            </Text>
          </header>
        </Flex>

        {/* Radix unmounts the tab that is not showing, so each team's state and
            data load fresh every time someone switches to their tab. */}
        <Tabs.Root defaultValue="team1">
          <Tabs.List>
            <Tabs.Trigger value="team1">Tasks</Tabs.Trigger>
            <Tabs.Trigger value="team2">Expenses</Tabs.Trigger>
            <Tabs.Trigger value="team3">Message board</Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            <Tabs.Content value="team1">
              <Team1Tab />
            </Tabs.Content>
            <Tabs.Content value="team2">
              <Team2Tab />
            </Tabs.Content>
            <Tabs.Content value="team3">
              <Team3Tab />
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Flex>
    </Container>
  );
};

export default App;
