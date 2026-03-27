import fs from 'fs'
import path from 'path'

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f)
    let isDirectory = fs.statSync(dirPath).isDirectory()
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath)
  })
}

let replacedCount = 0

walkDir('d:/Res/MAF/src', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8')
  if (content.includes("toLocaleString('ar-EG'") || content.includes('toLocaleString("ar-EG"')) {
    content = content.replace(/toLocaleString\('ar-EG'/g, "toLocaleString('en-US'")
    content = content.replace(/toLocaleString\("ar-EG"/g, 'toLocaleString("en-US"')
    fs.writeFileSync(filePath, content)
    console.log('Fixed', filePath)
    replacedCount++
  }
})

console.log(`Replaced numbers in ${replacedCount} files.`)
