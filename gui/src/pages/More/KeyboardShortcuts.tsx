import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscForeground,
} from "../../components";
import { ToolTip } from "../../components/gui/Tooltip";
import { getPlatform } from "../../util";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: 1rem;
  padding: 1rem 0;
  justify-items: center;
  align-items: center;
`;

const StyledKeyDiv = styled.div`
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 2px;
  color: ${vscForeground};

  width: 16px;
  height: 16px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

const keyToName: { [key: string]: string } = {
  "⌘": "Cmd",
  "⌃": "Ctrl",
  "⇧": "Shift",
  "⏎": "Enter",
  "⌫": "Backspace",
  "⌥": "Option",
  "⎇": "Alt",
};

function KeyDiv({ text }: { text: string }) {
  return (
    <>
      <StyledKeyDiv data-tooltip-id={`header_button_${text}`}>
        {text}
      </StyledKeyDiv>

      <ToolTip id={`header_button_${text}`} place="bottom">
        {keyToName[text]}
      </ToolTip>
    </>
  );
}

interface KeyboardShortcutProps {
  mac: string;
  windows: string;
  description: string;
}

function KeyboardShortcut(props: KeyboardShortcutProps) {
  const shortcut = getPlatform() === "mac" ? props.mac : props.windows;
  return (
    <div className="flex w-full items-center justify-between gap-x-4">
      <span className="text-sm">{props.description}</span>
      <div className="float-right flex gap-2">
        {shortcut.split(" ").map((key, i) => {
          return <KeyDiv key={i} text={key}></KeyDiv>;
        })}
      </div>
    </div>
  );
}
const debuggVsShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ ⌥ C",
    windows: "Ctrl ⌃ C",
    description: "Create New E2e Test",
  },
  {
    mac: "⌘ ⌥ E",
    windows: "Ctrl ⌃ E",
    description: "Start E2e Test Suite Generator",
  },
  // {
  //   mac: "⌥ T",
  //   windows: "Alt T",
  //   description: "Create Tests For File",
  // },
  // {
  //   mac: "⌥ R",
  //   windows: "Alt R",
  //   description: "Run Tests For File",
  // },
];

const vscodeShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ '",
    windows: "⌃ '",
    description: "Toggle Selected Model",
  },
  {
    mac: "⌘ I",
    windows: "⌃ I",
    description: "Edit highlighted code",
  },
  {
    mac: "⌘ L",
    windows: "⌃ L",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    mac: "⌘ ⌫",
    windows: "⌃ ⌫",
    description: "Cancel response",
  },
  {
    mac: "⌘ ⇧ I",
    windows: "⌃ ⇧ I",
    description: "Toggle inline edit focus",
  },
  {
    mac: "⌘ ⇧ L",
    windows: "⌃ ⇧ L",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    mac: "⌘ ⇧ R",
    windows: "⌃ ⇧ R",
    description: "Debug Terminal",
  },
  {
    mac: "⌘ ⇧ ⌫",
    windows: "⌃ ⇧ ⌫",
    description: "Reject Diff",
  },
  {
    mac: "⌘ ⇧ ⏎",
    windows: "⌃ ⇧ ⏎",
    description: "Accept Diff",
  },
  {
    mac: "⌥ ⌘ N",
    windows: "Alt ⌃ N",
    description: "Reject Top Change in Diff",
  },
  {
    mac: "⌥ ⌘ Y",
    windows: "Alt ⌃ Y",
    description: "Accept Top Change in Diff",
  },
  {
    mac: "⌘ K ⌘ A",
    windows: "⌃ K ⌃ A",
    description: "Toggle Autocomplete Enabled",
  },
  {
    mac: "⌘ K ⌘ M",
    windows: "⌃ K ⌃ M",
    description: "Toggle Full Screen",
  },
];

const jetbrainsShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ '",
    windows: "⌃ '",
    description: "Toggle Selected Model",
  },
  {
    mac: "⌘ I",
    windows: "⌃ I",
    description: "Edit highlighted code",
  },
  {
    mac: "⌘ J",
    windows: "⌃ J",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    mac: "⌘ ⌫",
    windows: "⌃ ⌫",
    description: "Cancel response",
  },
  {
    mac: "⌘ ⇧ I",
    windows: "⌃ ⇧ I",
    description: "Toggle inline edit focus",
  },
  {
    mac: "⌘ ⇧ J",
    windows: "⌃ ⇧ J",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    mac: "⌘ ⇧ ⌫",
    windows: "⌃ ⇧ ⌫",
    description: "Reject Diff",
  },
  {
    mac: "⌘ ⇧ ⏎",
    windows: "⌃ ⇧ ⏎",
    description: "Accept Diff",
  },
  {
    mac: "⌥ ⇧ J",
    windows: "Alt ⇧ J",
    description: "Quick Input",
  },
  {
    mac: "⌥ ⌘ J",
    windows: "Alt ⌃ J",
    description: "Toggle Sidebar",
  },
];

function KeyboardShortcuts({ top }: { top?: boolean }) {
  return (
    <>
      <div className={`${top ? "" : "hidden"}`}>
        <GridDiv className={`${top ? "my-4" : "hidden"}`}>
          {debuggVsShortcuts.map(
            (shortcut, i) => {
              return (
                <KeyboardShortcut
                  key={i}
                  mac={shortcut.mac}
                  windows={shortcut.windows}
                  description={shortcut.description}
                />
              );
            },
          )}
        </GridDiv>

      </div>
      {/* <div className={`${top ? "hidden" : ""}`}>
        <GridDiv>
          {(isJetBrains() ? jetbrainsShortcuts : vscodeShortcuts).map(
            (shortcut, i) => {
              return (
                <KeyboardShortcut
                  key={i}
                  mac={shortcut.mac}
                  windows={shortcut.windows}
                  description={shortcut.description}
                />
              );
            },
          )}
        </GridDiv>

      </div> */}
    </>
  );
}

export default KeyboardShortcuts;
