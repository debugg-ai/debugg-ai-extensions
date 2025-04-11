"use client"

// @ts-ignore
import { DebuggAiLogger } from "debugg-ai-sdk"
import type React from "react"
import { useEffect } from "react"

// Add a LoggerInitializer component to initialize the logger
function LoggerInitializer() {
  useEffect(() => {
    // Only try to initialize the logger if we're in a browser environment
    if (typeof window !== "undefined") {
      try {
          const ENDPOINT =
            "https://debuggai-backend.ngrok.app/api/v1/ingest/a9179c1c-94fc-4c9b-9bcf-3a442407426e/13bd4e88-3b40-4039-a32c-8fcd174b7b9f/"
          DebuggAiLogger.init({
            endpoint: ENDPOINT,
            level: "error",
            includeConsole: true,
            hostName: process.env.NEXT_PUBLIC_DEBUGGAI_HOST || "debuggai-web-app",
            environment: process.env.NODE_ENV || "development",
            pinoOptions: {},
          })
          console.log("DebuggAI Logger initialized successfully")
      } catch (error) {
        console.warn("DebuggAI Logger not available in this environment")
      }
    }
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LoggerInitializer />
      {children}
    </>
  )
}

