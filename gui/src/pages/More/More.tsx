import {
  ArrowTopRightOnSquareIcon,
  TableCellsIcon
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import DocsIndexingStatuses from "../../components/indexing/DocsIndexingStatuses";
import PageHeader from "../../components/PageHeader";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import IndexingProgress from "./IndexingProgress";
import KeyboardShortcuts from "./KeyboardShortcuts";
import MoreHelpRow from "./MoreHelpRow";

function MorePage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const { disableIndexing } = config;

  return (
    <div className="overflow-y-scroll">
      <PageHeader showBorder onTitleClick={() => navigate("/")} title="E2e Tests" />


      <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <div>
          <h3 className="mx-auto mb-1 text-lg">E2E Test Shortcuts</h3>
          <KeyboardShortcuts top={true} />
        </div>
        
        <div className="py-5">
          <h3 className="mb-4 mt-0 text-xl">Help center</h3>
          <div className="-mx-4 flex flex-col">
            <MoreHelpRow
              title="Documentation"
              description="Learn how to configure and use Debugg AI"
              Icon={ArrowTopRightOnSquareIcon}
              onClick={() =>
                ideMessenger.post("openUrl", "https://docs.debugg.ai/")
              }
            />

            <MoreHelpRow
              title="Have an issue?"
              description="Let us know on GitHub and we'll do our best to resolve it"
              Icon={ArrowTopRightOnSquareIcon}
              onClick={() =>
                ideMessenger.post(
                  "openUrl",
                  "https://github.com/debugg-ai/debugg-ai-extensions/issues/",
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <div className="py-5">
          <div>
            <h3 className="mx-auto mb-1 mt-0 text-xl">Indexing Status</h3>
            <span className="w-3/4 text-xs text-stone-500">
              Local embeddings of your codebase
            </span>
          </div>
          {disableIndexing ? (
            <div className="pb-2 pt-5">
              <p className="py-1 text-center font-semibold">
                Indexing is disabled
              </p>
              <p className="text-lightgray cursor-pointer text-center text-xs">
                Open settings and toggle <code>Disable Indexing</code> to
                re-enable
              </p>
            </div>
          ) : (
            <IndexingProgress />
          )}
        </div>

        <div className="flex flex-col py-5">
          <DocsIndexingStatuses />
        </div>

        <div>
          <h3 className="mx-auto mb-1 text-lg">Additional Keyboard shortcuts</h3>
          <KeyboardShortcuts />
        </div>
        <div>
          <MoreHelpRow
            title="Token usage"
            description="Daily token usage across models"
            Icon={TableCellsIcon}
            onClick={() => navigate("/stats")}
          />
          <MoreHelpRow
            title="Contribute to Continue"
            description="Continue's Open Source project provided the base for our extensions. Join their community to stay up-to-date on the latest developments."
            Icon={ArrowTopRightOnSquareIcon}
            onClick={() =>
              ideMessenger.post("openUrl", "https://discord.gg/vapESyrFmJ")
            }
          />
        </div>
      </div>
    </div>
  );
}

export default MorePage;
