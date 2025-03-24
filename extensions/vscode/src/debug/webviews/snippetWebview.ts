import * as vscode from 'vscode';

export function showSnippetWebview(context: vscode.ExtensionContext, snippet: string) {
  const panel = vscode.window.createWebviewPanel(
    'snippetPreview',
    'Snippet Preview (React)',
    vscode.ViewColumn.One,
    {
      enableScripts: true, // Required to run JS in the webview
    }
  );

  // Provide the content for the webview
  panel.webview.html = getReactWebviewHtml(panel.webview, context.extensionUri, snippet);

  // Listen for messages from the webview
  panel.webview.onDidReceiveMessage(
    (message) => {
      if (message.command === 'accept') {
        vscode.window.showInformationMessage('Snippet accepted!');
        panel.dispose();
      }
    },
    undefined,
    context.subscriptions
  );
}

/**
 * Returns an HTML string that loads React/ReactDOM from a CDN,
 * renders a simple React App, and passes in snippet + sample errors.
 */
function getReactWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  snippet: string
): string {
  // Escape snippet for safe embedding
  const escapedSnippet = snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Sample errors
  const sampleErrors = [
    {
      id: 1,
      timestamp: '2024-03-15 10:23:45',
      message: 'TypeError: Cannot read property "foo" of undefined',
      stackTrace: 'at Object.<anonymous> (/app/src/index.js:12:5)',
    },
    {
      id: 2,
      timestamp: '2024-03-15 10:24:12',
      message: 'ReferenceError: someVar is not defined',
      stackTrace: 'at processData (/app/src/utils.js:45:12)',
    },
    {
      id: 3,
      timestamp: '2024-03-15 10:25:33',
      message: 'SyntaxError: Unexpected token }',
      stackTrace: 'at Module._compile (internal/modules/cjs/loader.js:999:30)',
    },
  ];

  // Convert sampleErrors to a JSON string so we can embed it
  const errorsJson = JSON.stringify(sampleErrors);

  // IMPORTANT: The webview has its own unique origin and disallows inline scripts by default.
  // For a quick demo, we'll load React & ReactDOM from unpkg. Real-world usage typically bundles.
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <!--
          Allow scripts (we set enableScripts=true in the panel options).
          NOTE: If you do any advanced content security policy, 
          you'd need to adjust or embed these in a safer manner.
        -->
        <title>Snippet Preview (React)</title>
      </head>
      <body>
        <div id="root" style="font-family: sans-serif; padding: 1rem;"></div>

        <!-- React & ReactDOM from CDN -->
        <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>

        <!-- Main script that mounts our React component -->
        <script>
          // We have snippet data + errors from extension:
          const snippet = "${escapedSnippet}";
          const sampleErrors = ${errorsJson};

          // We'll define a simple React component:
          function App(props) {
            const { snippet, errors } = props;

            function onAcceptClick() {
              // Post a message back to VS Code
              const vscode = acquireVsCodeApi();
              vscode.postMessage({ command: 'accept' });
            }

            return React.createElement(
              'div',
              null,
              [
                React.createElement('h2', { key: 'title' }, 'React Snippet Preview'),
                React.createElement('pre', { key: 'snippet' }, snippet),
                React.createElement(
                  'table',
                  { key: 'errorTable', border: 1, cellPadding: 5, style: { marginTop: '1rem' } },
                  [
                    React.createElement('thead', { key: 'thead' }, 
                      React.createElement('tr', null, [
                        React.createElement('th', { key: 'time' }, 'Timestamp'),
                        React.createElement('th', { key: 'msg' }, 'Message'),
                        React.createElement('th', { key: 'stack' }, 'Stack Trace'),
                      ])
                    ),
                    React.createElement(
                      'tbody',
                      { key: 'tbody' },
                      errors.map((error) =>
                        React.createElement('tr', { key: error.id }, [
                          React.createElement('td', { key: 'time' }, error.timestamp),
                          React.createElement('td', { key: 'msg' }, error.message),
                          React.createElement('td', { key: 'stack' },
                            React.createElement('pre', null, error.stackTrace)
                          ),
                        ])
                      )
                    ),
                  ]
                ),
                React.createElement(
                  'button',
                  { key: 'acceptBtn', style: { marginTop: '1rem' }, onClick: onAcceptClick },
                  'Accept Snippet'
                )
              ]
            );
          }

          // Wait for DOM load
          document.addEventListener('DOMContentLoaded', () => {
            ReactDOM.render(
              React.createElement(App, { snippet, errors: sampleErrors }),
              document.getElementById('root')
            );
          });
        </script>
      </body>
    </html>
  `;
}
