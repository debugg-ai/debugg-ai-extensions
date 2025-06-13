import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { URL } from "url";
import { IDE } from "../index.js";


export async function fetchAndOpenGif(ide: IDE, projectRoot: string, recordingUrl: string, testName: string, testId: string): Promise<void> {
    let cacheDir = path.join(projectRoot, ".debugg-ai", "e2e-runs");
    console.log('....downloading gif....')
    console.log('cacheDir', cacheDir);
    console.log('testId', testId);
    console.log('recordingUrl', recordingUrl);
    let localUrl = recordingUrl.replace('localhost', 'localhost:8002');
    console.log('localUrl', localUrl);

    if (cacheDir.includes("file:")) {
        cacheDir = cacheDir.replace("file:", "");
    }
    await fs.promises.mkdir(cacheDir, { recursive: true });

    const filePath = path.join(cacheDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId.slice(0, 4)}.gif`);
    const fileUrl = new URL(localUrl);

    const file = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
        console.log('fetching gif', fileUrl);
        if (fileUrl.protocol === 'https:') {
            https.get(localUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    resolve();
                });
            }).on("error", (err) => {
                fs.unlinkSync(filePath);
                reject(err);
            });

        } else {
            http.get(localUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    resolve();
                });
            }).on("error", (err) => {
                fs.unlinkSync(filePath);
                reject(err);
            });
        }
    });
    // const fileUri = vscode.Uri.file(filePath);
    // await vscode.commands.executeCommand('vscode.open', fileUri);
    const fileUri = filePath.replace("file://", "");
    console.log('fileUri', fileUri);
    await ide.openImageFile(fileUri);
}
