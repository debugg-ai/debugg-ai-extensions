import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { URL } from "url";
import { IDE } from "../index.js";


export async function fetchAndOpenGif(ide: IDE, recordingUrl: string, testName: string, testId: string): Promise<void> {
    let projectRoot = (await ide.getWorkspaceDirs())[0];
    projectRoot = projectRoot.replace("file://", "");
    let cacheDir = path.join(projectRoot, ".debugg-ai");

    if (cacheDir.includes("file:")) {
        cacheDir = cacheDir.replace("file:", "");
    }
    cacheDir = decodeURIComponent(cacheDir);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    // Create a subdirectory for the gif
    let gifDir = path.join(cacheDir, "e2e-runs");
    await fs.promises.mkdir(gifDir, { recursive: true });

    console.log('....downloading gif....')
    console.log('cacheDir', cacheDir);
    console.log('gifDir', gifDir);
    console.log('testId', testId);
    console.log('recordingUrl', recordingUrl);
    let localUrl = recordingUrl.replace('localhost', 'localhost:8002');
    console.log('localUrl', localUrl);

    const filePath = path.join(gifDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId}.gif`);
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

export async function fetchAndOpenScript(ide: IDE, scriptUrl: string, testName: string, testId: string): Promise<void> {
    let projectRoot = (await ide.getWorkspaceDirs())[0];
    projectRoot = projectRoot.replace("file://", "");
    let cacheDir = path.join(projectRoot, ".debugg-ai");

    if (cacheDir.includes("file:")) {
        cacheDir = cacheDir.replace("file:", "");
    }
    cacheDir = decodeURIComponent(cacheDir);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    
    // Create a subdirectory for the scripts
    let scriptDir = path.join(cacheDir, "e2e-runs");
    await fs.promises.mkdir(scriptDir, { recursive: true });

    console.log('....downloading script....')
    console.log('cacheDir', cacheDir);
    console.log('scriptDir', scriptDir);
    console.log('testId', testId);
    console.log('scriptUrl', scriptUrl);
    let localUrl = scriptUrl.replace('localhost', 'localhost:8002');
    console.log('localUrl', localUrl);

    // Determine file extension based on content or default to .js
    const urlObj = new URL(localUrl);
    const urlPath = urlObj.pathname;
    let fileExtension = '.js'; // default
    if (urlPath.includes('.')) {
        const lastDot = urlPath.lastIndexOf('.');
        const ext = urlPath.substring(lastDot);
        if (['.js', '.ts', '.py', '.java', '.cs', '.rb', '.go', '.php'].includes(ext)) {
            fileExtension = ext;
        }
    }

    const filePath = path.join(scriptDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId}-script${fileExtension}`);
    const fileUrl = new URL(localUrl);

    const file = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
        console.log('fetching script', fileUrl);
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

    const fileUri = filePath.replace("file://", "");
    console.log('script fileUri', fileUri);
    await ide.openFile(fileUri);
}

export async function fetchAndOpenJson(ide: IDE, jsonUrl: string, testName: string, testId: string): Promise<void> {
    let projectRoot = (await ide.getWorkspaceDirs())[0];
    projectRoot = projectRoot.replace("file://", "");
    let cacheDir = path.join(projectRoot, ".debugg-ai");

    if (cacheDir.includes("file:")) {
        cacheDir = cacheDir.replace("file:", "");
    }
    cacheDir = decodeURIComponent(cacheDir);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    
    // Create a subdirectory for the json files
    let jsonDir = path.join(cacheDir, "e2e-runs");
    await fs.promises.mkdir(jsonDir, { recursive: true });

    console.log('....downloading json....')
    console.log('cacheDir', cacheDir);
    console.log('jsonDir', jsonDir);
    console.log('testId', testId);
    console.log('jsonUrl', jsonUrl);
    let localUrl = jsonUrl.replace('localhost', 'localhost:8002');
    console.log('localUrl', localUrl);

    const filePath = path.join(jsonDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId}-details.json`);
    const fileUrl = new URL(localUrl);

    const file = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
        console.log('fetching json', fileUrl);
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

    const fileUri = filePath.replace("file://", "");
    console.log('json fileUri', fileUri);
    await ide.openFile(fileUri);
}
