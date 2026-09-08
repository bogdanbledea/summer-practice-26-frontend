import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Tabs,
  Text,
} from "@radix-ui/themes";
import Team1Tab from "./features/team1/Team1Tab";
import Team2Tab from "./features/team2/Team2Tab";
import Team3Tab from "./features/team3/Team3Tab";
import Team4Tab from "./features/team4/Team4Tab";
import Team5Tab from "./features/team5/Team5Tab";
import Team6Tab from "./features/team6/Team6Tab";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAppContext } from "./AppContext";

const App = () => {
  const { userLoggedIn, getMe, userProfile } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    getMe();
  }, []);

  useEffect(() => {});

  useEffect(() => {
    if (!userLoggedIn) {
      navigate("/login");
    }
  }, []);

  return (
    <Container size="3" p="4">
      <Flex direction="column" gap="5">
        <Flex direction="column" gap="1" asChild>
          <header>
            <Flex>
              <Flex flexGrow="1">
                <Heading size="7">Summer Practice</Heading>
              </Flex>
              <Flex>Hello {userProfile?.name}</Flex>
            </Flex>

            <Text size="2" color="gray">
              One app, six tabs, six teams.
            </Text>
            <Flex>
              {!userLoggedIn ? (
                <Button onClick={() => navigate("/login")}>Login</Button>
              ) : (
                <Button onClick={() => navigate("/logout")}>Logout</Button>
              )}
            </Flex>
          </header>
        </Flex>

        {/* Radix unmounts the tab that is not showing, so each team's state and
            data load fresh every time someone switches to their tab. */}
        <Tabs.Root defaultValue="team1">
          <Tabs.List>
            <Tabs.Trigger value="team1">Tasks</Tabs.Trigger>
            <Tabs.Trigger value="team2">Expenses</Tabs.Trigger>
            <Tabs.Trigger value="team3">Message board</Tabs.Trigger>
            <Tabs.Trigger value="team4">Reading list</Tabs.Trigger>
            <Tabs.Trigger value="team5">Leaderboard</Tabs.Trigger>
            <Tabs.Trigger value="team6">Event sign-up</Tabs.Trigger>
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
            <Tabs.Content value="team4">
              <Team4Tab />
            </Tabs.Content>
            <Tabs.Content value="team5">
              <Team5Tab />
            </Tabs.Content>
            <Tabs.Content value="team6">
              <Team6Tab />
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Flex>
    </Container>
  );
};

export default App;
