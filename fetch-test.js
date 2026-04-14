async function test() {
  const ids = [
    'pr-billing-6ff7f3d7-aaa1-48f5-96d2-a9e379ff0cf7',
  ];
  for (const id of ids) {
    console.log("Testing", id);
    const res = await fetch(`http://localhost:3000/api/mobile/critical-actions/${id}`, {
      headers: { 'Authorization': 'Bearer dev_test_token' }
    });
    console.log("Status:", res.status);
    const txt = await res.text();
    console.log("Response:", txt.substring(0, 500));
  }
}
test();
