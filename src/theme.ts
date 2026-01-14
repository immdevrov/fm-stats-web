import { createSystem, defaultConfig } from "@chakra-ui/react";

const customColors = {
  carbonBlack: {
    50: "#f5f5f5",
    100: "#e0e0e0",
    200: "#bdbdbd",
    300: "#9e9e9e",
    400: "#757575",
    500: "#616161",
    600: "#424242",
    700: "#262626",
    800: "#1a1a1a",
    900: "#0f0f0f",
    950: "#050505",
  },
  glaucous: {
    50: "#f0f2f8",
    100: "#d4d9ed",
    200: "#b8c0e2",
    300: "#9ca7d7",
    400: "#808ecc",
    500: "#6a7fdb",
    600: "#5566b0",
    700: "#404d85",
    800: "#2b345a",
    900: "#161b2f",
    950: "#0b0e17",
  },
  thistle: {
    50: "#faf8fa",
    100: "#f5eff5",
    200: "#ebe0eb",
    300: "#e3c0d3",
    400: "#d9a0bb",
    500: "#cf80a3",
    600: "#b8668f",
    700: "#a14c7b",
    800: "#8a3267",
    900: "#731853",
    950: "#5c0e3f",
  },
  spicyPaprika: {
    50: "#fef5f2",
    100: "#fde0d6",
    200: "#fbcbba",
    300: "#f9b69e",
    400: "#f7a182",
    500: "#dc602e",
    600: "#b84e26",
    700: "#943c1e",
    800: "#702a16",
    900: "#4c180e",
    950: "#280606",
  },
  softBlush: {
    50: "#fefbfb",
    100: "#fdf7f7",
    200: "#fbefef",
    300: "#f9e7e7",
    400: "#f7dfdf",
    500: "#f4dbd8",
    600: "#d4b9b6",
    700: "#b49794",
    800: "#947572",
    900: "#745350",
    950: "#54312e",
  },
};

export const customSystem = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        carbonBlack: customColors.carbonBlack,
        glaucous: customColors.glaucous,
        thistle: customColors.thistle,
        spicyPaprika: customColors.spicyPaprika,
        softBlush: customColors.softBlush,
      },
    },
    semanticTokens: {
      colors: {
        "bg.canvas": {
          value: {
            base: "{colors.carbonBlack.50}",
            _dark: "{colors.carbonBlack.900}",
          },
        },
        "fg.default": {
          value: {
            base: "{colors.carbonBlack.900}",
            _dark: "{colors.softBlush.100}",
          },
        },
        "fg.emphasized": {
          value: {
            base: "{colors.carbonBlack.950}",
            _dark: "{colors.softBlush.50}",
          },
        },
        "fg.muted": {
          value: {
            base: "{colors.softBlush.700}",
            _dark: "{colors.softBlush.300}",
          },
        },
      },
    },
  },
});