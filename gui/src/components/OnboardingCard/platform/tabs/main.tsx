import { useContext } from "react";
import { Button } from "../../..";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { hasPassedFTL } from "../../../../util/freeTrial";
import DebuggAILogo from "../../../gui/DebuggAILogo";
import { useOnboardingCard } from "../../hooks";

export default function MainTab({
  onRemainLocal,
  isDialog,
}: {
  onRemainLocal: () => void;
  isDialog: boolean;
}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const auth = useAuth();

  function onGetStarted() {
    auth.login(true).then((success) => {
      if (success) {
        onboardingCard.close(isDialog);
      }
    });
  }

  function openPastFreeTrialOnboarding() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "setup-models",
      orgSlug: auth.selectedOrganization?.slug,
    });
    onboardingCard.close(isDialog);
  }

  const pastFreeTrialLimit = hasPassedFTL();

  return (
    <div className="xs:px-0 flex w-full max-w-full flex-col items-center justify-center px-4 text-center">
      <div className="xs:flex hidden">
        <DebuggAILogo height={75} width={75}/>
      </div>

      <>
        <p className="xs:w-3/4 w-full text-sm">
          Please login to start using Debugg AI
        </p>

        <Button
          onClick={onGetStarted}
          className="mt-4 grid w-full grid-flow-col items-center gap-2"
        >
          Get started
        </Button>
      </>
    </div>
  );
}
