import http from 'http'

const req = http.request('http://localhost:3000/company/projects/88465538-7e12-4133-a63f-b86493252232', {
  method: 'GET',
  headers: {
    // If I need cookies, it will redirect, but let's see what it returns first.
  }
}, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    // Search for the Next.js error data in the HTML script tags
    const errMatch = data.match(/"message":"([^"]+)"/)
    if (errMatch) {
      console.log('Error Message Match:', errMatch[1])
    }
    const stackMatch = data.match(/"stack":"([^"]+)"/)
    if (stackMatch) {
      console.log('Stack Trace Match:', stackMatch[1].replace(/\\n/g, '\n'))
    }
    // Just dump some of the content:
    console.log('\nStatus:', res.statusCode)
    if (!errMatch && !stackMatch) {
       console.log('Preview:', data.substring(0, 500))
    }
  })
})
req.on('error', console.error)
req.end()
