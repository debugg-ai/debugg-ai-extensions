const path = require('path');
process.env.CONTINUE_DEVELOPMENT = true;

process.env.DEBUGG_AI_GLOBAL_DIR = path.join(process.env.PROJECT_DIR, 'extensions', '.debugg-ai-debug');

require('./out/index.js');