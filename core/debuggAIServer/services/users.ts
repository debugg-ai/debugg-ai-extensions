// services/issues.ts
import { DebuggAiConfig } from "../..";
import { AxiosTransport } from "../utils/axiosTransport";


export interface UsersService {
    getUserConfig(): Promise<DebuggAiConfig | null>;
}


export const createUsersService = (tx: AxiosTransport): UsersService => ({
    /**
     * Get the user config
     */
    async getUserConfig(): Promise<DebuggAiConfig | null> {
        try {
            const serverUrl = "api/v1/users/get_ide_config/";
            const response = await tx.get<DebuggAiConfig>(serverUrl);
            console.log("Raw API response:", response);
            return response;

        } catch (err) {
            console.error("Error fetching user config:", err);
            return null;
        }
    },

});
