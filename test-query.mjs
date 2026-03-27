async function main() {
  const url = `https://mudmlntyyozezevdccll.supabase.co/rest/v1/projects?select=*,cost_centers(arabic_name,english_name),project_parties(id,project_role,status,parties(id,arabic_name,english_name))&id=eq.88465538-7e12-4133-a63f-b86493252232`
  const res = await fetch(url, {
    headers: {
      apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjM3NTcsImV4cCI6MjA5MDA5OTc1N30.L-EAr85rAGDvKRr-xqebJBMta1kU22TJFjqD4VC3XjQ',
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZG1sbnR5eW96ZXpldmRjY2xsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMzc1NywiZXhwIjoyMDkwMDk5NzU3fQ.4cu4coFccwO6NXAfQVpTJrHuJ3DslMhlfBKHNsMgzhs`
    }
  })
  const text = await res.text()
  console.log(res.status, text)
}
main().catch(console.error)
