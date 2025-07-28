import { useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import E2eTestsPage from "./E2eTestsPage";

function E2esPage() {
  useNavigationListener();
  const { session } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  
  // Refs for cleanup
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!session?.account.id) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground">
        <div className="p-3">
          <div className="mb-3">
            <h1 className="text-sm font-medium text-vsc-foreground mb-1">E2E Tests</h1>
            <p className="text-xs text-vsc-descriptionForeground">Individual end-to-end tests</p>
          </div>
          
          <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-3">
            <PlatformOnboardingCard isDialog={false} />
          </div>
        </div>
      </div>
    );
  }

  return <E2eTestsPage />;
}

export default E2esPage;
