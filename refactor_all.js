const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'apps/web/src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace rounded-2xl, rounded-xl, rounded-lg with rounded-sm
  content = content.replace(/rounded-(2xl|xl|lg)/g, 'rounded-sm');
  
  // Replace rounded-full with rounded-none
  content = content.replace(/rounded-full/g, 'rounded-none');
  
  // Replace emerald with amber
  content = content.replace(/emerald/g, 'amber');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
