import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Layout from "./components/Layout";
import { SubmenuContextProvidersProvider } from "./context/SubmenuContextProviders";
import { VscThemeProvider } from "./context/VscTheme";
import useSetup from "./hooks/useSetup";
import { AddNewModel, ConfigureProvider } from "./pages/AddNewModel";
import ConfigPage from "./pages/config";
import ConfigErrorPage from "./pages/config-error";
import E2es from "./pages/e2es";
import E2eCommitSuitesPage from "./pages/e2es/E2eCommitSuitesPage";
import E2eSuitesPage from "./pages/e2es/E2eSuitesPage";
import ErrorPage from "./pages/error";
import Chat from "./pages/gui";
import History from "./pages/history";
import MigrationPage from "./pages/migration";
import MorePage from "./pages/More";
import Stats from "./pages/stats";
import { ROUTES } from "./util/navigation";

const router = createMemoryRouter([
  {
    path: ROUTES.HOME,
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/index.html",
        element: <E2es />,
      },
      {
        path: ROUTES.HOME,
        element: <E2es />,
      },
      {
        path: "/chat",
        element: <Chat />,
      },
      {
        path: ROUTES.E2E_SUITES,
        element: <E2eSuitesPage />,
      },
      {
        path: ROUTES.E2E_COMMIT_SUITES,
        element: <E2eCommitSuitesPage />,
      },
      {
        path: "/history",
        element: <History />,
      },
      {
        path: "/stats",
        element: <Stats />,
      },
      {
        path: "/addModel",
        element: <AddNewModel />,
      },
      {
        path: "/addModel/provider/:providerName",
        element: <ConfigureProvider />,
      },
      {
        path: "/more",
        element: <MorePage />,
      },
      {
        path: ROUTES.CONFIG_ERROR,
        element: <ConfigErrorPage />,
      },
      {
        path: ROUTES.CONFIG,
        element: <ConfigPage />,
      },
      {
        path: "/migration",
        element: <MigrationPage />,
      },
    ],
  },
]);

/*
  Prevents entire app from rerendering continuously with useSetup in App
  TODO - look into a more redux-esque way to do this
*/
function SetupListeners() {
  useSetup();
  return <></>;
}

function App() {
  return (
    <VscThemeProvider>
      <SubmenuContextProvidersProvider>
        <RouterProvider router={router} />
      </SubmenuContextProvidersProvider>
      <SetupListeners />
    </VscThemeProvider>
  );
}

export default App;
