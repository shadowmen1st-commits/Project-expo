import http from 'http';

function testLogin(email, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Testing live HTTP logins against http://localhost:5001/api/auth/login...\n');
  
  const testCases = [
    { label: 'ADMIN', email: 'admin@test.com', pass: 'Admin@12345' },
    { label: 'CUSTOMER', email: 'customer@test.com', pass: 'Customer@12345' },
    { label: 'DEMO CUST', email: 'demo@jobnest.com', pass: 'Demo@123' },
    { label: 'WORKER', email: 'worker@test.com', pass: 'Worker@12345' },
    { label: 'COMPANY', email: 'company@test.com', pass: 'Company@12345' },
  ];

  for (const c of testCases) {
    const res = await testLogin(c.email, c.pass);
    if (res.status === 200) {
      console.log(`[${c.label.padEnd(9)}] ✅ HTTP 200 OK | User: ${res.data.user?.name} | Role: ${res.data.user?.role} | Token: Present`);
    } else {
      console.log(`[${c.label.padEnd(9)}] ❌ HTTP ${res.status}`, res.data || res.error || res.body);
    }
  }
}

run();
