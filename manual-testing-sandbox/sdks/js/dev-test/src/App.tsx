import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import DebuggAiLogger from '../../src/logger/debuggAiLogger'


const ENDPOINT = 'http://api.localhost:81/api/v1/ingest/b3e51bab-a37b-49d9-b07c-af9b8c7c9146/aa1c72c7-45ed-48e6-be1b-83e81cbefb55/'

// 1) Initialize
DebuggAiLogger.init({
  endpoint: ENDPOINT,
  level: 'error',
  includeConsole: true,
  pinoOptions: {
    base: { serviceName: 'debugg-ai-js-local' }, // Pino's standard config
  }
});

function App() {
  const [count, setCount] = useState(0)
  
  console.error('Hello World')
  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
