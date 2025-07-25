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
            console.log("getUserConfig called");
            console.log("Transport auth header:", (tx as any).getAuthorizationHeader?.());
            const serverUrl = "api/v1/users/get_ide_config/";
            let response = null;

            if (tx.getAuthorizationHeader()) {
                response = await tx.get<DebuggAiConfig>(serverUrl);
                console.log("Raw API response:", response);
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
