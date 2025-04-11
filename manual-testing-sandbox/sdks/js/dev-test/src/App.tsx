import { useState } from 'react'
import DebuggAiLogger from '../../src/logger/debuggAiLogger'
import './App.css'
import reactLogo from './assets/react.svg'
import Second from './second/Second'
import viteLogo from '/vite.svg'

const PROJECT_KEY = '2f7142cf-7501-4f2b-96f4-08da17d0d780';
const COMPANY_KEY = 'b3e51bab-a37b-49d9-b07c-af9b8c7c9146';
const ENDPOINT = `http://api.localhost:81/api/v1/ingest/${COMPANY_KEY}/${PROJECT_KEY}/`;

// 1) Initialize
DebuggAiLogger.init({
  endpoint: ENDPOINT,
  level: 'error',
  includeConsole: true,
  hostName: 'debugg-ai-js-local',
  pinoOptions: {
    base: { serviceName: 'debugg-ai-js-local' }, // Pino's standard config
  }
});

// https://debuggai-backend.ngrok.app/api/v1/ingest/a9179c1c-94fc-4c9b-9bcf-3a442407426e/13bd4e88-3b40-4039-a32c-8fcd174b7b9f/

// Simulating a complex nested error scenario
const deepNestedFunction = (obj: any) => {
  const recursiveSearch = (data: any, depth: number): any => {
    if (depth > 3) {
      return data.nonexistent.property.access; // This will throw
    }
    return recursiveSearch(data, depth + 1);
  };

  setTimeout(() => {
    Promise.resolve().then(() => {
      try {
        recursiveSearch(obj, 0);
      } catch (e) {
        console.error("Something went wrong in data processing", e);
      }
    });
  }, 1500);
};

// Trigger the error after component mounts
setTimeout(() => {
  deepNestedFunction({
    someData: {
      nested: {
        value: "test"
      }
    }
  });
}, 2000);

function App() {
  const [count, setCount] = useState(0)
  
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
      <Second />
    </>
  )
}

export default App
