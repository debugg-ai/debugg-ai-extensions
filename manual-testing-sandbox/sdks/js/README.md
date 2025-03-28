# DebuggAI SDK

A powerful application monitoring and logging SDK that helps you capture, analyze, and debug your application logs in real time. DebuggAI leverages cutting-edge AI to provide instant suggestions and automatically push fixes to your pull requests. 

[Learn more on our website](https://debugg.ai) or get started now with a [free account](https://app.debugg.ai).


---

## Key Features

- **1-Line Installation**  
  Quickly install the SDK with a single command.

- **Intelligent Debugging**  
  Receive AI-powered suggestions directly in your IDE to help pinpoint and fix issues faster.

- **Real-time Monitoring**  
  Capture logs instantly from your application, whether running locally or in a CI/CD pipeline.

- **Automated Pull Request Fixes**  
  Let the AI propose solutions and push them as pull request commits, reducing manual intervention and ensuring rapid, high-quality code improvements.

- **Flexible Integration**  
  Works with various frameworks and deployment setups (Node.js, serverless, containers, etc.).

---

## Installation

Run the following command in your project’s root directory:

```bash
npm install debugg-ai-sdk
```


---

## Quick Start

Below is a minimal example showing how to integrate DebuggAI in your Node.js application.

```js
// Import the DebuggAI SDK
const { DebuggAiLogger } = require('debugg-ai-sdk');

// Initialize DebuggAI with your API key and optional configuration
DebuggAiLogger.init({
  endpoint: ENDPOINT,
  // Optional configurations
  level: 'error',
  includeConsole: true,
  environment: 'local',
  pinoOptions: {
    // Optional Pino extensions
    base: { serviceName: 'sophies-local' },
  }
});

// Example: Capture an error and get AI suggestions
try {
  // Some logic that may throw
  throw new Error('Something went wrong!');
} catch (err) {
  // DebuggAI will automatically log the error and generate AI fixes
  console.error(err);
}
```

Once you’ve set up your `DebuggAiLogger`, you can log errors, warnings, or custom events. The SDK will route them to DebuggAI’s AI engine, returning suggestions or automatically proposing code fixes in your repository.

---

## Configuration

You can initialize the SDK with an object that includes any of the following parameters:

| Parameter     | Type     | Description                                                                        | Default           |
|---------------|----------|------------------------------------------------------------------------------------|-------------------|
| `endpoint`    | `string` | **(Required)** Your DebuggAI project API Key.                                      | `undefined`       |
| `level`       | `string` | Current environment (e.g. `"production"`, `"development"`, `"staging"`).           | `"development"`   |
| `includeConsole` | `boolean`| Include console logs in the logs.                                                    | `false`           |
| `environment`    | `string` | Current environment (e.g. `"production"`, `"development"`, `"staging"`).           | `"development"`   |
| `pinoOptions`    | `object` | Pino options for customizing the logger.                                            | `{}`              |

---

## Logging Methods

You can customize the levels which generate logs to DebuggAI in the initialization object. If you choose to use includeConsole, the logs will support the same levels as the console.log method. If not, you will need to 
call the DebuggAiLogger.<level> methods. 

1. **logError(error, [metadata])**  
   Sends detailed error information to DebuggAI’s AI engine.
   ```js
   DebuggAiLogger.error(new Error('User creation failed'), { userId: 1234 });
   ```

2. **logWarning(message, [metadata])**  
   Logs warnings that might not be fatal but could indicate potential issues.
   ```js
   DebuggAiLogger.warning('Memory usage is high', { usage: '512MB' });
   ```

3. **logEvent(eventName, [metadata])**  
   Logs custom application events, making it easier to track important milestones or state changes.
   ```js
   DebuggAiLogger.log('UserSignedUp', { userEmail: 'test@example.com' });
   ```


---

## Real-time AI Suggestions in Your IDE

To get real-time feedback:

1. **Configure Your IDE**  
   Install the DebuggAI extension (available for VS Code, JetBrains, etc.).  
2. **Connect to DebuggAI**  
   Provide your `apiKey` and any optional configurations in the extension settings.  
3. **View Suggestions**  
   Errors, warnings, and even certain refactoring suggestions will appear directly in your editor.


---

## Enabling Automatic AI Fixes in Pull Requests

DebuggAI can automatically propose (and optionally merge) code changes that fix issues:

1. **Connect Your Repository**  
   - Provide your repository URL (`repoUrl`) and branch name (`branch`) in the SDK configuration.  
   - Ensure the SDK has the proper credentials or tokens to push commits (e.g., a GitHub token stored in your environment variables).

2. **Enable AutoFix**  
   - Set the `autoFix` parameter to `true` in the constructor.  
   - DebuggAI will create or update a pull request with AI-driven suggestions whenever an error is detected and a potential fix is identified.

3. **Review & Merge**  
   - Receive a notification in your Git repository or your CI/CD platform.  
   - Review the PR changes.  
   - Merge if they look good.

---

## Handling Sensitive Data

DebuggAI is designed to keep your data secure:

- **Token Masking**: By default, API keys and tokens are masked in logs.  
- **GDPR Compliant**: (If applicable) The SDK can be configured to redact personal data, ensuring compliance with data protection regulations.

---

## Examples

### 1. Simple Express.js Integration

```js
const express = require('express');
const { DebuggAiLogger } = require('debugg-ai-sdk');

const app = express();

// Replace with your project's endpoint from the DebuggAI dashboard
// You can find it in the project settings page

const ENDPOINT = 'https://ingest.debugg.ai/api/v1/ingest/<YOUR_PROJECTS_ENDPOINT>';

// Initialize DebuggAI
DebuggAiLogger.init({
  endpoint: ENDPOINT,
  level: 'error',
  includeConsole: true,
  environment: 'local',
});

// Middleware to catch errors
app.use((err, req, res, next) => {
  DebuggAiLogger.error(err, { url: req.url })
    .then((response) => {
      // Possibly respond with AI-suggested messages or solutions
      console.log('AI suggestions:', response.suggestions);
    })
    .catch((logErr) => console.error('Error logging to DebuggAI:', logErr));

  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

---

## Troubleshooting

- **API Key Not Found**  
  Make sure you set your `apiKey` in the constructor or as an environment variable:  
  `export DEBUGG_AI_API_KEY=your_key_goes_here`

- **AI Suggestions Not Appearing**  
  Ensure your IDE extension is properly installed and that the application environment (`env`) matches the one configured in your DebuggAI dashboard.

- **Auto-Fix PRs Not Created**  
  Check your repository settings, and confirm you have granted appropriate permissions (e.g., GitHub personal access token or similar) to let DebuggAI push code.

---

## License

[BSD-3-Clause](LICENSE)

---

## Contact & Support

If you have any questions or need personalized support:

- **Email**: support@debugg.ai 
- **Slack**: Join our Slack community at [DebuggAI Slack Channel](https://example.com/slack-invite)  
- **Documentation**: [Official DebuggAI Docs](https://docs.debugg.ai)

---


Happy debugging! If you found DebuggAI helpful, consider giving this repo a ⭐ on GitHub.