export const presetThemes = [
  {
    name: "t3-chat",
    label: "T3 Chat",
    activeColor: {
      light: "333.2673 42.9787% 46.0784%",
      dark: "332.0245 100% 31.9608%",
    },
  },
  {
    name: "claude",
    label: "Claude",
    activeColor: {
      light: "15.1111 55.5556% 52.3529%",
      dark: "14.7692 63.1068% 59.6078%",
    },
  },
  {
    name: "bubble",
    label: "Bubble",
    activeColor: {
      light: "266.0440 85.0467% 58.0392%",
      dark: "267.4074 83.5052% 80.9804%",
    },
  },
  {
    name: "vintage",
    label: "Vintage",
    activeColor: {
      light: "30.0000 33.8710% 48.6275%",
      dark: "30 33.6842% 62.7451%",
    },
  },
  {
    name: "doom",
    label: "Doom",
    activeColor: {
      light: "0 0% 20%",
      dark: "0 0% 80%",
    },
  },
  {
    name: "vs-code",
    label: "VS Code",
    activeColor: {
      light: "201 90% 55%",
      dark: "201 90% 55%",
    },
  },
] as const;

export type PresetTheme = (typeof presetThemes)[number];
