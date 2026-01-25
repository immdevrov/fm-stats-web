import { VStack, Heading, Link as ChakraLink } from "@chakra-ui/react";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  path: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: "/import", label: "Import" },
  { path: "/leagues", label: "Leagues" },
];

export function Navigation() {
  const location = useLocation();

  return (
    <VStack align="stretch" p={6} gap={6}>
      <Heading 
        size="lg" 
        colorPalette="glaucous"
        color="fg.emphasized"
      >
        FM Stats
      </Heading>
      
      <VStack align="stretch" gap={2}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ChakraLink
              key={item.path}
              as={Link}
              to={item.path}
              px={4}
              py={2}
              borderRadius="md"
              bg={isActive ? "glaucous.500" : "transparent"}
              color={isActive ? "softBlush.50" : "fg.default"}
              _hover={{
                bg: isActive ? "glaucous.600" : "bg.muted",
              }}
              transition="all 0.2s"
            >
              {item.label}
            </ChakraLink>
          );
        })}
      </VStack>
    </VStack>
  );
}
