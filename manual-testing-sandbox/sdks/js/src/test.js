// Using import
import * as dotenv from 'dotenv';
import DebuggAiLogger from './logger/debuggAiLogger.js';

dotenv.config()

console.info(process.env.DEBUGG_AI_HOST)

// 1) Initialize
// DebuggLogger.init({
//   endpoint: 'http://localhost:81/api/v1/ingest/59be6716-a478-4834-b7e0-754f975f4368/',
//   level: 'error',
//   handleExceptions: true, // if you want to catch node exceptions
//   console: false,
//   host: process.env.DEBUGG_AI_HOST,
//   otherTransports: [
//     // e.g. new transports.File({ filename: 'combined.log' })
//   ]
// });

const ENDPOINT = 'http://localhost:81/api/v1/ingest/b3e51bab-a37b-49d9-b07c-af9b8c7c9146/aa1c72c7-45ed-48e6-be1b-83e81cbefb55/'

// 1) Simple initialization
// This starts up pino with our custom transport in a worker thread
DebuggAiLogger.init({
  endpoint: ENDPOINT,
  level: 'debug', 
  includeConsole: true,
  pinoOptions: {
    base: { serviceName: 'debuggai-sandbox' }, // Pino's standard config
  }
  // concurrency: 5, etc.
});

// 2) Start logging
// Or get direct pino instance:
// const logger = DebuggAiLogger.getLogger();
console.error('Oops, something went wrong!', { some: 'metadata' });

const newFunction = () => {
  console.debug({ userId: 123 }, 'User fetched data');
}

const nestedFunction = () => {
  newFunction();
}

nestedFunction();


// wait for 10 seconds
setTimeout(() => {
  // do nothing
}, 10000);