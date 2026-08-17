const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'dump.xml');
if (!fs.existsSync(xmlPath)) {
  console.log('dump.xml not found');
  process.exit(1);
}

const xml = fs.readFileSync(xmlPath, 'utf8');
const nodeRegex = /<node\s+([^>]+)\/?>/g;
let match;
while ((match = nodeRegex.exec(xml)) !== null) {
  const attrs = match[1];
  const textMatch = attrs.match(/text="([^"]*)"/);
  const boundsMatch = attrs.match(/bounds="(\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\])"/);
  const descMatch = attrs.match(/content-desc="([^"]*)"/);
  const text = textMatch ? textMatch[1] : '';
  const desc = descMatch ? descMatch[1] : '';
  const bounds = boundsMatch ? boundsMatch[1] : '';
  if (text || desc) {
    console.log(`Text: "${text}" | Desc: "${desc}" | Bounds: ${bounds}`);
  }
}
