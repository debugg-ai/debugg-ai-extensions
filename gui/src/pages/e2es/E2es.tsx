import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import E2eTests from "./E2eTestsPage";


function E2esPage() {
  useNavigationListener();
  const { session, logout } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const { disableIndexing } = config;

  return (
    <div className="overflow-y-scroll">
      <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <div>
          <h3 className="mx-auto mb-1 text-lg">E2E Tests</h3>
          {!session?.account.id ? (
            <div className="mx-2 mt-10">
              <PlatformOnboardingCard isDialog={false} />
            </div>
          ):(
            <E2eTests />
          )}
        </div>
        
        <div className="py-5">
          {/* <h3 className="mb-4 mt-0 text-xl">E2E Test Suites</h3> */}
          {/* <E2eSuites /> */}
        </div>
      </div>
    </div>
  );
}

export default E2esPage;
