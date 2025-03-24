import { LogOverview } from "../../services/debugg-ai/inlays";

export function getMarkdownStructure({
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
# Error Overview

**Event ID:** ${eventId}

**Timestamp:** ${timestamp}

**Level:** ${level}


---


### Description

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