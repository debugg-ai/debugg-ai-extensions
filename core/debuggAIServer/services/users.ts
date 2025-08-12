// services/issues.ts
import { DebuggAiConfig } from "../..";
import { DebuggTransport } from "../stubs/client";
import { ProjectAnalysis } from "../utils/projectAnalyzer";


export interface UsersService {
    getUserConfig(): Promise<DebuggAiConfig | null>;
}


export const createUsersService = (tx: DebuggTransport): UsersService => ({
    /**
     * Get the user config
     */
    async getUserConfig(): Promise<DebuggAiConfig | null> {
        try {
            console.log("getUserConfig called");
            console.log("Transport auth header:", (tx as any).getAuthorizationHeader?.());
            const serverUrl = "api/v1/users/get_ide_config/";
            let response = null;
            let projectLanguageConfig: ProjectAnalysis | undefined = undefined;
            projectLanguageConfig = await tx.getProjectLanguageConfig();

            if (tx.getAuthorizationHeader()) {
                response = await tx.get<DebuggAiConfig>(serverUrl);
                console.log("Raw API response:", response);
                if (response.debuggAiRepoSettingsLs) {
                    const curRepoName = projectLanguageConfig?.repoName;
                    if (curRepoName) {
                        response.debuggAiRepoSettings = response.debuggAiRepoSettingsLs.find(repo => repo.repoName === curRepoName);
                    }
                } else {
                    if (projectLanguageConfig) {
                        response.debuggAiRepoSettings = {
                            repoName: projectLanguageConfig.repoName,
                            repoPath: projectLanguageConfig.repoPath,
                            primaryLanguage: projectLanguageConfig.primaryLanguage,
                            testingLanguage: projectLanguageConfig.testingLanguage,
                            testingFramework: projectLanguageConfig.testingFramework,
                            framework: projectLanguageConfig.framework,
                        };
                    }
                }
                return response;
            } else {
                console.log("Cant call get_ide_config with no header token");
                return response;
            }
        } catch (err) {
            console.error("Error fetching user config:", err);
            return null;
        }
    },

});
