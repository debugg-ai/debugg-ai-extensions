import {
    BeakerIcon,
    CodeBracketIcon,
    FolderOpenIcon
} from "@heroicons/react/24/outline";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformOnboardingCard } from "../../components/OnboardingCard/platform/PlatformOnboardingCard";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import E2eCommitSuites from "./E2eCommitSuites";
import E2eSuites from "./E2eSuites";
import E2eTestsPage from "./E2eTestsPage";

interface TabType {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

function E2esPage() {
  useNavigationListener();
  const { session, logout } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const { disableIndexing } = config;

  const [activeTab, setActiveTab] = useState("tests");
  
  // Debug logging
  console.log('E2es component rendered, activeTab:', activeTab);
  
  // Refs for cleanup
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const tabs: TabType[] = [
    {
      id: "tests",
      label: "Tests",
      icon: <BeakerIcon className="w-4 h-4" />,
      component: <E2eTestsPage />,
    },
    {
      id: "suites",
      label: "Suites",
      icon: <FolderOpenIcon className="w-4 h-4" />,
      component: <E2eSuites />,
    },
    {
      id: "commit-suites",
      label: "Commits",
      icon: <CodeBracketIcon className="w-4 h-4" />,
      component: <E2eCommitSuites />,
    }
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab) || tabs[0];

  const handleTabChange = useCallback((tabId: string) => {
    console.log('Tab clicked:', tabId, 'Current tab:', activeTab);
    if (mountedRef.current) {
      setActiveTab(tabId);
      console.log('Tab changed to:', tabId);
    }
  }, [activeTab]);

  const getTabDescription = (tabId: string): string => {
    switch (tabId) {
      case 'tests': return 'Individual end-to-end tests';
      case 'suites': return 'Organized test collections';
      case 'commit-suites': return 'Tests for commit changes';
      default: return '';
    }
  };

  if (!session?.account.id) {
    return (
      <div className="h-full bg-vsc-editor-background text-vsc-foreground">
        <div className="p-4">
          <div className="mb-4">
            <h1 className="text-sm font-medium text-vsc-foreground mb-1">E2E Testing</h1>
            <p className="text-xs text-vsc-descriptionForeground">End-to-end testing</p>
          </div>
          
          <div className="bg-vsc-input-background border border-vsc-input-border rounded-sm p-3">
            <PlatformOnboardingCard isDialog={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
      {/* VS Code-style Header */}
      <div className="border-b border-vsc-panel-border">
        <div className="px-3 py-2">
          <h1 className="text-sm font-medium text-vsc-foreground mb-2">E2E Testing</h1>
          
          {/* Ultra-compact Icon-based Tab Navigation */}
          <div className="flex space-x-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center space-x-1 px-1.5 py-0.5 text-xs rounded transition-all duration-150 ${
                  activeTab === tab.id
                    ? "bg-vsc-tab-activeBackground text-vsc-tab-activeForeground border border-vsc-tab-activeBorder"
                    : "text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-tab-hoverBackground"
                }`}
                onClick={() => handleTabChange(tab.id)}
                title={`${tab.label} - ${getTabDescription(tab.id)}`}
              >
                {tab.icon}
                <span className="font-medium text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Debug info */}
        <div className="p-1 text-xs text-gray-500 bg-gray-100 border-b">
          Debug: Active Tab = {activeTab} | Current Tab ID = {currentTab.id}
        </div>
        {currentTab.component}
      </div>
    </div>
  );
}

export default E2esPage;
