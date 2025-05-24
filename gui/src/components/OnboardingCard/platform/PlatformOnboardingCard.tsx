import { useState } from "react";
import { useAppSelector } from "../../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../../util/localStorage";
import { ReusableCard } from "../../ReusableCard";
import { TabTitle } from "../components/OnboardingCardTabs";
import { useOnboardingCard } from "../hooks";
import MainTab from "./tabs/main";

export interface OnboardingCardState {
  show?: boolean;
  activeTab?: TabTitle;
}

interface OnboardingCardProps {
  isDialog: boolean;
}

export function PlatformOnboardingCard({ isDialog }: OnboardingCardProps) {
  const onboardingCard = useOnboardingCard();
  const config = useAppSelector((store) => store.config.config);
  const [currentTab, setCurrentTab] = useState<"main" | "local">("main");

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  return (
    <ReusableCard
      showCloseButton={!isDialog && !!config.models.length}
      onClose={() => onboardingCard.close()}
    >
      <div className="flex h-full w-full items-center justify-center">
        <MainTab
            onRemainLocal={() => setCurrentTab("local")}
            isDialog={isDialog}
          />
      </div>
    </ReusableCard>
  );
}
