// services/issues.ts
import { DebuggTransport } from "../stubs/client";
import { ProjectAnalysis } from "../utils/projectAnalyzer";


export interface ProjectsService {
    setProjectSettings(projectSettings: ProjectAnalysis): Promise<ProjectAnalysis>;
}


export const createProjectsService = (tx: DebuggTransport): ProjectsService => ({
    /**
     * Set the project settings
     */
    setProjectSettings: async (projectSettings: ProjectAnalysis) => {
        console.log("setProjectSettings called");
        console.log("Transport auth header:", (tx as any).getAuthorizationHeader?.());
        const serverUrl = "api/v1/projects/project_settings/";
        let response = null;

        // Ensure we add the project to the call
        const updatedProjectSettings = await tx.post<ProjectAnalysis>(serverUrl, projectSettings, undefined, true);
        return updatedProjectSettings;
    }
});
