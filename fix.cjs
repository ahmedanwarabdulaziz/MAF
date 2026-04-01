const fs = require('fs');

const files = [
  'D:\\\\Res\\\\MAF\\\\src\\\\app\\\\(system)\\\\projects\\\\[id]\\\\certificates\\\\page.tsx',
  'D:\\\\Res\\\\MAF\\\\src\\\\app\\\\(system)\\\\projects\\\\[id]\\\\certificates\\\\ViewCertificateDialog.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\.toLocaleString\('ar-EG'/g, ".toLocaleString('en-US'");
  content = content.replace(/\.toLocaleString\(undefined/g, ".toLocaleString('en-US'");
  content = content.replace(/\.toLocaleString\(\)/g, ".toLocaleString('en-US')");
  fs.writeFileSync(file, content, 'utf8');
}
console.log('Done!');
