const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('docs/design/*.md');
const missing = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const imageRegex = /!\[.*?\]\((\.\/diagrams\\.*?\.svg)\)/g;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    const imagePath = match[1];
    // Convert .\diagrams\file.svg to docs/design/diagrams/file.svg
    const cleanPath = imagePath.replace('.\\', '').split('\\').join('/');
    const fullPath = path.join('docs/design', cleanPath);

    if (!fs.existsSync(fullPath)) {
      missing.push({
        mdFile: file,
        imagePath: imagePath,
        fullPath: fullPath
      });
    }
  }
});

console.log('Found', missing.length, 'missing images:\n');
missing.forEach(item => {
  console.log('File:', path.basename(item.mdFile));
  console.log('  Missing:', item.imagePath);
  console.log('');
});
