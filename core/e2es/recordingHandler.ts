import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { URL } from "url";
import { IDE } from "../index.js";

async function downloadFileWithRedirects(url: string, filePath: string, maxRedirects: number = 5, originalBaseUrl?: string): Promise<void> {
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
        console.log(`Attempting to download from: ${currentUrl} (redirect ${redirectCount})`);
        
        const fileUrl = new URL(currentUrl);
        const file = fs.createWriteStream(filePath);

        try {
            const redirectUrl = await new Promise<string | null>((resolve, reject) => {
                const request = fileUrl.protocol === 'https:' ? https.get : http.get;
                
                request(currentUrl, (response) => {
                    const statusCode = response.statusCode || 0;
                    
                    // Handle redirects
                    if (statusCode >= 300 && statusCode < 400) {
                        const location = response.headers.location;
                        if (!location) {
                            reject(new Error(`Redirect response (${statusCode}) without Location header`));
                            return;
                        }
                        
                        // Close the current file stream since we're redirecting
                        file.close();
                        resolve(location);
                        return;
                    }
                    
                    // Handle success
                    if (statusCode === 200) {
                        response.pipe(file);
                        file.on("finish", () => {
                            console.log(`file finished. Replacing urls with ${originalBaseUrl}`);
                            if (originalBaseUrl) {
                                // Replace any https://<any digit, letter, hyphen>.ngrok.debugg.ai urls with localhost:localPort
                                const fileContent = fs.readFileSync(filePath, 'utf8');
                                const ngrokRegex = /https:\/\/[\w-]+\.ngrok\.debugg\.ai/g;
                                const updatedContent = fileContent.replace(ngrokRegex, originalBaseUrl);
                                fs.writeFileSync(filePath, updatedContent);
                            }
                            file.close();
                            resolve(null); // null means success, no redirect
                        });
                        return;
                    }
                    
                    // Handle other errors
                    file.close();
                    reject(new Error(`Failed to download file: ${statusCode}`));
                }).on("error", (err) => {
                    file.close();
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    reject(err);
                });
            });

            // If no redirect, we're done
            if (!redirectUrl) {
                return;
            }

            // Handle redirect
            redirectCount++;
            if (redirectCount > maxRedirects) {
                throw new Error(`Too many redirects (${maxRedirects})`);
            }
            
            // Convert relative URLs to absolute
            if (redirectUrl.startsWith('/')) {
                const baseUrl = new URL(currentUrl);
                currentUrl = `${baseUrl.protocol}//${baseUrl.host}${redirectUrl}`;
            } else if (redirectUrl.startsWith('http')) {
                currentUrl = redirectUrl;
            } else {
                // Relative URL, resolve against current URL
                currentUrl = new URL(redirectUrl, currentUrl).toString();
            }
            
            console.log(`Redirecting to: ${currentUrl}`);

        } catch (error) {
            // Clean up file on error
            file.close();
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw error;
        }
    }

    throw new Error(`Exceeded maximum redirects (${maxRedirects})`);
}


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

    const filePath = path.join(gifDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId.slice(0, 4)}.gif`);

    console.log('fetching gif from', localUrl);
    await downloadFileWithRedirects(localUrl, filePath);
    // const fileUri = vscode.Uri.file(filePath);
    // await vscode.commands.executeCommand('vscode.open', fileUri);
    const fileUri = filePath.replace("file://", "");
    console.log('fileUri', fileUri);
    await ide.openImageFile(fileUri);
}

export async function fetchAndOpenScript(ide: IDE, localSavePath: string, remoteScriptUrl: string, testName: string, testId: string, originalBaseUrl?: string): Promise<void> {
    // let projectRoot = (await ide.getWorkspaceDirs())[0];
    // projectRoot = projectRoot.replace("file://", "");
    // let cacheDir = path.join(projectRoot, ".debugg-ai");

    // if (cacheDir.includes("file:")) {
    //     cacheDir = cacheDir.replace("file:", "");
    // }
    // cacheDir = decodeURIComponent(cacheDir);
    // await fs.promises.mkdir(cacheDir, { recursive: true });
    
    // // Create a subdirectory for the scripts
    // let scriptDir = path.join(cacheDir, "e2e-runs");
    // await fs.promises.mkdir(scriptDir, { recursive: true });

    console.log('....downloading script....')
    // console.log('cacheDir', cacheDir);
    // console.log('scriptDir', scriptDir);
    console.log('testId', testId);
    console.log('remoteScriptUrl', remoteScriptUrl);
    let localUrl = remoteScriptUrl.replace('localhost', 'localhost:8002');
    console.log('localUrl', localUrl);

    // Determine file extension based on content or default to .js
    // const urlObj = new URL(localUrl);
    // const urlPath = urlObj.pathname;
    // let fileExtension = '.js'; // default
    // if (urlPath.includes('.')) {
    //     const lastDot = urlPath.lastIndexOf('.');
    //     const ext = urlPath.substring(lastDot);
    //     if (['.js', '.ts', '.py', '.java', '.cs', '.rb', '.go', '.php'].includes(ext)) {
    //         fileExtension = ext;
    //     }
    // }

    // const filePath = path.join(scriptDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId.slice(0, 4)}.spec${fileExtension}`);
    const filePath = localSavePath;
    console.log('fetching script from', localUrl);
    await downloadFileWithRedirects(localUrl, filePath, 5, originalBaseUrl);

    const fileUri = filePath.replace("file://", "");
    console.log('script fileUri', fileUri);
    await ide.openFile(fileUri);
}

export async function fetchAndOpenJson(ide: IDE, jsonUrl: string, testName: string, testId: string, originalBaseUrl?: string): Promise<void> {
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

    const filePath = path.join(jsonDir, `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${testId.slice(0, 4)}-details.json`);

    console.log('fetching json from', localUrl);
    await downloadFileWithRedirects(localUrl, filePath, 5, originalBaseUrl);

    const fileUri = filePath.replace("file://", "");
    console.log('json fileUri', fileUri);
    // For now don't open the jsons. 
    // await ide.openFile(fileUri);
}
