import { LogOverview } from "../../services/backend/types";

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