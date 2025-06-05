import {
  BookOpenIcon,
  PencilSquareIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { isJetBrains } from "../../util";
import Shortcut from "../gui/Shortcut";

interface TutorialCardProps {
  onClose: () => void;
}

export function TutorialCard({ onClose }: TutorialCardProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const jetbrains = isJetBrains();

  return (
    <div
      className="border-0.5 border-lightGray bg-vsc-background m-1 max-w-96 rounded-md border-solid px-3 py-3 sm:px-5"
      data-testid="tutorial-card"
    >
      <div className="flex items-center justify-between">
        <h3 className="m-0 p-0">Getting Started with DebuggAI</h3>
        <div
          onClick={onClose}
          className="cursor-pointer items-center justify-center"
        >
          <XMarkIcon className="h-5 w-5" />
        </div>
      </div>

      <ul className="space-y-4 pl-0" style={{ color: lightGray }}>
        <li className="flex items-start">
          <div>
            <PencilSquareIcon className="h-4 w-4 pr-3 align-middle" />
          </div>
          <span>
            To quickly create a new test, use the <Shortcut>Ctrl+Alt+C</Shortcut> shortcut.
          </span>
        </li>
        <li className="flex items-start">
          <div>
            <BookOpenIcon className="h-4 w-4 pr-3 align-middle" />
          </div>
          <span>
            <a
              className="cursor-pointer text-inherit underline hover:text-inherit"
              onClick={() =>
                ideMessenger.post("openUrl", "https://docs.debugg.ai")
              }
            >
              Read our documentation
            </a>{" "}
            to learn more about DebuggAI’s features.
          </span>
        </li>
      </ul>
    </div>
  );
}
