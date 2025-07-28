/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Note that these breakpoints are primarily optimized for the input toolbar
    screens: {
      "2xs": "170px", // Smallest width for Primary Sidebar in VS Code
      xs: "250px", // Avg default sidebar width in VS Code
      sm: "330px",
      int: "380px",
      md: "460px",
      lg: "590px",
      xl: "720px",
      "2xl": "860px",
      "3xl": "1000px",
      "4xl": "1180px",
    },
    extend: {
      animation: {
        "spin-slow": "spin 6s linear infinite",
      },
      colors: {
        lightgray: "#999998",
        "vsc-input-background": "var(--vscode-input-background, rgb(45 45 45))",
        "vsc-background": "var(--vscode-sideBar-background, rgb(30 30 30))",
        "vsc-foreground": "var(--vscode-editor-foreground, #fff)",
        "vsc-editor-background":
          "var(--vscode-editor-background, var(--vscode-sideBar-background, rgb(30 30 30)))",
        "vsc-input-border": "var(--vscode-input-border, #999998)",

        // VS Code design system colors
        "vsc-panel-border": "var(--vscode-panel-border, rgba(128, 128, 128, 0.35))",
        "vsc-button-background": "var(--vscode-button-background, #0e639c)",
        "vsc-button-foreground": "var(--vscode-button-foreground, #ffffff)",
        "vsc-button-hoverBackground": "var(--vscode-button-hoverBackground, #1177bb)",
        "vsc-button-secondaryBackground": "var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.1))",
        "vsc-button-secondaryForeground": "var(--vscode-button-secondaryForeground, #ffffff)",
        "vsc-button-secondaryHoverBackground": "var(--vscode-button-secondaryHoverBackground, rgba(255, 255, 255, 0.2))",
        
        // Tab colors
        "vsc-tab-activeBackground": "var(--vscode-tab-activeBackground, transparent)",
        "vsc-tab-activeBorder": "var(--vscode-tab-activeBorder, #0e639c)",
        "vsc-tab-activeForeground": "var(--vscode-tab-activeForeground, #ffffff)",
        "vsc-tab-inactiveForeground": "var(--vscode-tab-inactiveForeground, rgba(255, 255, 255, 0.5))",
        "vsc-tab-hoverBackground": "var(--vscode-tab-hoverBackground, rgba(255, 255, 255, 0.12))",
        
        // List colors
        "vsc-list-hoverBackground": "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))",
        "vsc-list-activeSelectionBackground": "var(--vscode-list-activeSelectionBackground, #0e639c)",
        "vsc-list-focusBackground": "var(--vscode-list-focusBackground, rgba(255, 255, 255, 0.1))",
        
        // Text colors
        "vsc-descriptionForeground": "var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.7))",
        "vsc-textLink-foreground": "var(--vscode-textLink-foreground, #3794ff)",
        
        // Status colors
        "vsc-notificationsInfoIcon-foreground": "var(--vscode-notificationsInfoIcon-foreground, #3794ff)",
        "vsc-notificationsWarningIcon-foreground": "var(--vscode-notificationsWarningIcon-foreground, #ffcc02)",
        "vsc-notificationsErrorIcon-foreground": "var(--vscode-notificationsErrorIcon-foreground, #f85149)",
        "vsc-testing-iconPassed": "var(--vscode-testing-iconPassed, #73c991)",
        "vsc-testing-iconFailed": "var(--vscode-testing-iconFailed, #f85149)",
        "vsc-testing-iconQueued": "var(--vscode-testing-iconQueued, #cca700)",

        // Starting to make things less vsc-specific
        // TODO make it all non-IDE-specific naming
        "find-match-selected":
          "var(--vscode-editor-findMatchHighlightBackground, rgba(255, 223, 0))",
        "list-active": "var(--vscode-list-activeSelectionBackground, #1bbe84)",
        "list-active-foreground":
          "var(--vscode-quickInputList-focusForeground, var(--vscode-editor-foreground))",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
