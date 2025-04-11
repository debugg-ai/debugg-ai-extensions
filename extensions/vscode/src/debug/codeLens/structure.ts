import { Issue, IssueSolution, LogOverview, SnippetUpdate } from "../../services/backend/types";

export function getMarkdownStructure(
    title: string,
    message: string,
    {
    eventId,
    timestamp,
    level,
    exceptionType,
    messagePreview,
    filePath,
    stackTrace,
    handled,
    mechanism,
    environment,
    traceId,
    celeryTaskId,
    runtimeVersion,
    serverName,
    args,
    kwargs
  }: LogOverview): string {

const struct = `
# ${title}

${message}

**Level:** ${level}

**Timestamp:** ${timestamp}


---


### Description

**Event ID:** ${eventId}   

**Exception Type:** ${exceptionType}  

**Message Preview:** ${messagePreview}  

**File Path:** ${filePath}  

**Handled:** ${handled}


---

### Stack Trace

\`\`\`
${stackTrace?.split('\n').join('\n')}
\`\`\`


---


### Additional Details

| Field               | Value         
|---------------------|--------------------
| **Mechanism**       | ${mechanism}
| **Environment**     | ${environment}
| **Trace ID**        | ${traceId}
| **Celery Task ID**  | ${celeryTaskId}
| **Runtime Version** | ${runtimeVersion}
| **Server Name**     | ${serverName}


---


### Invocation Context

- **Args:**
    ${JSON.stringify(args, null, 2)}

- **Kwargs:**
    ${JSON.stringify(kwargs, null, 2)}`;

    return struct;
}

function getFileChangeMarkdown(
    fileChange: SnippetUpdate
): string {
    return `
// existing code...

Lines: ${fileChange.startLine}:${fileChange.endLine}

\`\`\`
${fileChange.newContent?.split('\n').join('\n')}
\`\`\`

// rest of file...

---

`;
}

export function getFixMarkdown(
    title: string,
    solution: IssueSolution
): string {
    const file = solution.changes[0];
    const strs = file.snippetsToUpdate.map(snippet => getFileChangeMarkdown(snippet));
    return `
# ${title}

${strs.join('\n')}

`;
}

export function getIssueMarkdown(
    issue: Issue
): string {

    const {
        title,
        message,
        overview,
        environment,
    } = issue;
    const {
        args,
        kwargs,
        eventId,
        timestamp,
        level,
        stackTrace,
        exceptionType,
        messagePreview,
        filePath,
        handled,
        mechanism,
        traceId,
        celeryTaskId,
        runtimeVersion,
        serverName,
    } = overview;

    const struct = `# ${title}

${message}

**Level:** ${level}

**Priority:** ${issue.priority}

**Timestamp:** ${new Date(issue.timestamp).toLocaleString()}


---


### Description

  **Event ID:** ${issue.uuid}   


  **File Path:** ${issue.filePath}  


  **Handled:** ${issue.status}

---


### Additional Details

| Field               | Value         
|---------------------|--------------------
| **Event Count**     | ${issue.eventsCount}
| **Environment**     | ${issue.environment}
| **Trace ID**        | ${traceId}


---


### Invocation Context

- **Args:**
    ${JSON.stringify(args, null, 2)}

- **Kwargs:**
    ${JSON.stringify(kwargs, null, 2)}


---


### Stack Trace

\`\`\`
${stackTrace?.split('\n').join('\n')}
\`\`\`

---`;

    return struct;
}