const fs = require('fs');
const path = require('path');

const targetSpan = `<span className="text-[#F5A800] font-extrabold text-xl tracking-tight">SHADOWMEN</span>`;

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

            // Replace image + span combinations
            content = content.replace(/<img[^>]*src="\/logo\.png"[^>]*>[\s\n]*<span[^>]*>Shadowmen<span[^>]*>\.<\/span><\/span>/g, targetSpan);
            content = content.replace(/<img[^>]*src="\/logo\.png"[^>]*>[\s\n]*Shadowmen<span[^>]*>\.<\/span>/g, targetSpan);
            content = content.replace(/<img[^>]*src="\/logo\.png"[^>]*>[\s\n]*<span[^>]*>HyperLocal<span[^>]*>\.<\/span><\/span>/g, targetSpan);
            content = content.replace(/<img[^>]*src="\/logo\.png"[^>]*>[\s\n]*HyperLocal<span[^>]*>\.<\/span>/g, targetSpan);

            // Replace stray brand marks
            content = content.replace(/<span[^>]*>Shadowmen<span[^>]*>\.<\/span><\/span>/g, targetSpan);
            content = content.replace(/Shadowmen<span[^>]*>\.<\/span>/g, targetSpan);
            content = content.replace(/<span[^>]*>HyperLocal<span[^>]*>\.<\/span><\/span>/g, targetSpan);
            content = content.replace(/HyperLocal<span[^>]*>\.<\/span>/g, targetSpan);

            // Text occurrences
            content = content.replace(/\bHyperLocal\b/g, "SHADOWMEN");
            content = content.replace(/\bHyperlocal\b/g, "SHADOWMEN");
            content = content.replace(/\bShadowmen\b(?! Marketplace Services)/g, "SHADOWMEN"); // Keep company name but uppercase others if standalone text

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDir(path.join(__dirname, 'frontend/src'));
