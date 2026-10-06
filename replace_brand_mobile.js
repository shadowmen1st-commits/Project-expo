const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('dist')) {
                processDir(fullPath);
            }
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Replace plain text brand occurrences in UI
            // Avoid changing internal variables if not needed, but text inside UI should be uppercase SHADOWMEN
            // Since we know "Shadowmen" with capitalized S is mostly used in user facing text or comments:
            content = content.replace(/\bHyperLocal GUARANTEE\b/ig, "SHADOWMEN GUARANTEE");
            
            // "Shadowmen" -> "SHADOWMEN" in user facing texts, skipping keys/identifiers like SHADOWMEN_GUEST_PENDING_BOOKING
            // We can replace exactly "Shadowmen" (Title case) with "SHADOWMEN" if it's not followed by a quote mark (e.g. key)
            // Or just do a blind replace of "Shadowmen" since we are switching to SHADOWMEN.
            content = content.replace(/Shadowmen/g, "SHADOWMEN");
            content = content.replace(/HyperLocal/g, "SHADOWMEN");
            content = content.replace(/Hyperlocal/g, "SHADOWMEN");

            // We should be careful about internal keys. 
            // "SHADOWMEN_PENDING_PAYMENT" is fine.
            // "com.anonymous.hyperlocalmobile" -> keep it as it is an identifier.
            content = content.replace(/com\.anonymous\.SHADOWMENmobile/gi, "com.anonymous.hyperlocalmobile");

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDir(path.join(__dirname, 'hyperlocal-mobile/src'));
