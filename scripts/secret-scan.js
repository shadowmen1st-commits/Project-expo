const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Patterns for potential secrets (Regex)
const SECRET_PATTERNS = [
  { name: 'JWT Secret', regex: /jwt_?secret/i },
  { name: 'API Key', regex: /api[_-]?key/i },
  { name: 'MongoDB URI', regex: /mongodb(?:\+srv)?:\/\/[^"'\s]+/ },
  { name: 'Private Key', regex: /-----BEGIN PRIVATE KEY-----/ },
  { name: 'Stripe Secret Key', regex: /sk_(test|live)_[0-9a-zA-Z]{24}/ },
  { name: 'Generic Secret', regex: /secret[_-]?(key|token|id)?\s*=\s*['"][^'"]+['"]/i },
  { name: 'Generic Secret JSON', regex: /"secret[_-]?(key|token|id)?"\s*:\s*['"][^'"]+['"]/i },
  { name: 'Password in URI', regex: /[a-zA-Z]+:\/\/[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+/ }, // Basic auth in URL
];

// Directories and files to exclude from scanning
const IGNORED_PATHS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.idea',
  '.vscode',
  'logs',
  'coverage',
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
  'package-lock.json',
  'app-debug.apk',
  'mobile'
];

// Check if a path is ignored
function isIgnored(itemPath) {
  return IGNORED_PATHS.some((ignored) => itemPath.includes(path.sep + ignored) || itemPath.endsWith(ignored));
}

let violations = [];

// Recursively scan files
async function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (isIgnored(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectory(fullPath);
    } else if (entry.isFile()) {
      // Check file extensions. Skip binaries.
      const ext = path.extname(entry.name);
      const skipExts = ['.apk', '.aab', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz'];
      if (skipExts.includes(ext.toLowerCase())) continue;

      await scanFile(fullPath);
    }
  }
}

// Read file line-by-line and test against patterns
async function scanFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    // We want to exclude checking lines that clearly look like test mocks or examples.
    // e.g., 'your_secret_here' or similar placeholder values, but to be safe, we'll flag them anyway.
    
    // Also ignore long base64 chunks or minified css/js which can false positive heavily if we aren't careful, 
    // but the regexes are relatively specific.

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        // If the match looks like a standard config variable assignment without a real secret, skip it.
        // e.g. process.env.JWT_SECRET or config.jwtSecret
        if (line.includes('process.env.') || line.includes('config.') || line.includes('process.env[')) {
          // It's likely a reference, not a hardcoded secret.
          // Unless it's an assignment like `process.env.JWT_SECRET = 'actual_secret'`
          if (!line.match(/=\s*['"][^'"]+['"]/)) {
            continue; 
          }
        }
        
        // Exclude test mock files that might have fake tokens intentionally.
        if (filePath.includes('.test.js') || filePath.includes('__mocks__') || filePath.includes('runTestFile.js') || filePath.includes('test.js')) {
            continue;
        }

        // Whitelist itself and config validator which just has string keys
        if (filePath.includes('secret-scan.js') || filePath.includes('productionConfigValidator.js')) {
            continue;
        }

        violations.push({
          file: filePath,
          line: lineNumber,
          type: pattern.name,
          content: line.trim().substring(0, 100), // Trim length for safety
        });
      }
    }
  }
}

async function run() {
  const rootDir = process.cwd();
  console.log(`Starting secret scan in ${rootDir}...`);
  await scanDirectory(rootDir);

  if (violations.length > 0) {
    console.error(`\n🚨 FOUND ${violations.length} POTENTIAL SECRETS 🚨\n`);
    violations.forEach((v) => {
      console.error(`File: ${v.file}:${v.line} [${v.type}] -> ${v.content}`);
    });
    process.exit(1);
  } else {
    console.log(`\n✅ No secrets detected. Workspace is safe to track.\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Error during secret scan:', err);
  process.exit(1);
});
