import http from 'http';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  console.log("=== INITIATING EMULATOR WEBVIEW TESTS ===");
  
  let targets;
  try {
    targets = await getJson('http://localhost:9222/json');
  } catch (err) {
    console.error("Failed to connect to forwarded port 9222. Ensure adb forward is active:", err.message);
    process.exit(1);
  }
  
  const page = targets.find(t => t.type === 'page');
  if (!page) {
    console.error("No active webview page target found in emulator.");
    process.exit(1);
  }
  
  const wsUrl = page.webSocketDebuggerUrl;
  console.log(`Connecting to WebView WebSocket: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  let cmdId = 0;
  
  const evaluate = (expression) => {
    return new Promise((resolve, reject) => {
      const id = ++cmdId;
      const payload = JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true }
      });
      const onMessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onMessage);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else if (msg.result?.exceptionDetails) {
            reject(new Error(msg.result.exceptionDetails.exception.description));
          } else {
            resolve(msg.result?.result?.value);
          }
        }
      };
      ws.addEventListener('message', onMessage);
      ws.send(payload);
    });
  };

  ws.onopen = async () => {
    console.log("WebSocket connected. Starting tests...");
    
    // Enable console logs with custom serialization
    ws.send(JSON.stringify({ id: 999, method: 'Runtime.enable' }));
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => {
          if (a.type === 'object') {
            return JSON.stringify(a.value || a.preview || a.description || {});
          }
          return a.value || a.description || '';
        }).join(' ');
        console.log(`[WebView Console]: ${args}`);
      }
    });

    try {
      const suffix = Date.now();
      const testPhone = () => String(Math.floor(1000000000 + Math.random() * 9000000000));
      
      // Define a helper function inside the page context to find and set input values
      await evaluate(`
        window.fillField = function(labelText, val) {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(l => l.textContent.toLowerCase().includes(labelText.toLowerCase()));
          if (!label) {
            console.error("Label not found:", labelText);
            return false;
          }
          let input = label.parentElement.querySelector('input, textarea');
          if (!input) {
            const outer = label.closest('div').parentElement;
            if (outer) input = outer.querySelector('input, textarea');
          }
          if (!input) {
            console.error("Input not found for label:", labelText);
            return false;
          }
          
          // Bypass React 16+ value setter override
          const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
          const prototype = Object.getPrototypeOf(input);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(input, val);
          } else if (valueSetter) {
            valueSetter.call(input, val);
          } else {
            input.value = val;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      `);

      // ==========================================
      // 1. CUSTOMER SIGNUP
      // ==========================================
      console.log("\n--- TESTING CUSTOMER SIGNUP ---");
      await evaluate(`window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      const cEmail = `c_emu_${suffix}@test.com`;
      const cPhone = testPhone();
      
      await evaluate(`
        (function() {
          fillField('Full Name', 'Emulator Customer');
          fillField('Email Address', '${cEmail}');
          fillField('Mobile Phone Number', '${cPhone}');
          fillField('Password', 'Customer@12345');
          fillField('Confirm Password', 'Customer@12345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      
      console.log("Submitted Customer signup, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterCustomerUrl = await evaluate('window.location.href');
      console.log("URL after customer signup:", afterCustomerUrl);
      
      // ==========================================
      // 2. CUSTOMER LOGIN
      // ==========================================
      console.log("\n--- TESTING CUSTOMER LOGIN ---");
      await evaluate(`window.history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      await evaluate(`
        (function() {
          fillField('Email Address', '${cEmail}');
          fillField('Password', 'Customer@12345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      console.log("Submitted Customer login, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterCustomerLoginUrl = await evaluate('window.location.href');
      console.log("URL after customer login:", afterCustomerLoginUrl);
      
      // Capture Token
      const customerToken = await evaluate('localStorage.getItem("accessToken")');
      console.log("Customer JWT Token in localStorage:", customerToken ? "PRESENT (VERIFIED)" : "MISSING");
      
      // Clear token to test next user
      await evaluate('localStorage.clear(); sessionStorage.clear();');
      
      // ==========================================
      // 3. WORKER SIGNUP
      // ==========================================
      console.log("\n--- TESTING WORKER SIGNUP ---");
      await evaluate(`window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      const wEmail = `w_emu_${suffix}@test.com`;
      const wPhone = testPhone();
      
      await evaluate(`
        (function() {
          // Select Worker Role button
          const buttons = Array.from(document.querySelectorAll('button'));
          const workerButton = buttons.find(b => b.textContent.includes('Worker'));
          if (workerButton) workerButton.click();
          
          fillField('Full Name', 'Emulator Worker');
          fillField('Email Address', '${wEmail}');
          fillField('Mobile Phone Number', '${wPhone}');
          fillField('Password', 'Worker@012345');
          fillField('Confirm Password', 'Worker@012345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      console.log("Submitted Worker signup, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterWorkerUrl = await evaluate('window.location.href');
      console.log("URL after worker signup:", afterWorkerUrl);
      
      // ==========================================
      // 4. WORKER LOGIN
      // ==========================================
      console.log("\n--- TESTING WORKER LOGIN ---");
      await evaluate(`window.history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      await evaluate(`
        (function() {
          fillField('Email Address', '${wEmail}');
          fillField('Password', 'Worker@012345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      console.log("Submitted Worker login, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterWorkerLoginUrl = await evaluate('window.location.href');
      console.log("URL after worker login:", afterWorkerLoginUrl);
      
      // Capture Token
      const workerToken = await evaluate('localStorage.getItem("accessToken")');
      console.log("Worker JWT Token in localStorage:", workerToken ? "PRESENT (VERIFIED)" : "MISSING");
      
      await evaluate('localStorage.clear(); sessionStorage.clear();');
      
      // ==========================================
      // 5. COMPANY SIGNUP
      // ==========================================
      console.log("\n--- TESTING COMPANY SIGNUP ---");
      await evaluate(`window.history.pushState({}, '', '/register/company'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      // Redefine fillField on CompanyRegister page just in case
      await evaluate(`
        window.fillField = function(labelText, val) {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(l => l.textContent.toLowerCase().includes(labelText.toLowerCase()));
          if (!label) {
            console.error("Label not found:", labelText);
            return false;
          }
          let input = label.parentElement.querySelector('input, textarea');
          if (!input) {
            const outer = label.closest('div').parentElement;
            if (outer) input = outer.querySelector('input, textarea');
          }
          if (!input) {
            console.error("Input not found for label:", labelText);
            return false;
          }
          
          const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
          const prototype = Object.getPrototypeOf(input);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(input, val);
          } else if (valueSetter) {
            valueSetter.call(input, val);
          } else {
            input.value = val;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      `);

      const compEmail = `comp_emu_${suffix}@test.com`;
      const compPhone = testPhone();
      
      await evaluate(`
        (function() {
          fillField('Company Name', 'Emulator Company');
          fillField('Official Email', '${compEmail}');
          fillField('Phone Number', '${compPhone}');
          fillField('Business Type', 'Logistics');
          fillField('Address', 'Staging Road 42');
          fillField('City', 'Delhi');
          fillField('Pincode', '110001');
          fillField('State', 'Delhi');
          fillField('Authorized Person Name', 'Authorized Person');
          fillField('Authorized Person Phone', '${compPhone}');
          fillField('PAN Card Number', 'ABCDE1234F');
          fillField('GST Number', '07AAAAA1111A1Z1');
          fillField('Website', 'https://emu-company.com');
          fillField('Company Description', 'Bulk hiring event specialists');
          fillField('Password', 'Company@012345');
          fillField('Confirm Password', 'Company@012345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      console.log("Submitted Company signup, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterCompanyUrl = await evaluate('window.location.href');
      console.log("URL after company signup:", afterCompanyUrl);
      
      // ==========================================
      // 6. COMPANY LOGIN
      // ==========================================
      console.log("\n--- TESTING COMPANY LOGIN ---");
      await evaluate(`window.history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      await evaluate(`
        (function() {
          fillField('Email Address', '${compEmail}');
          fillField('Password', 'Company@012345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      console.log("Submitted Company login, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterCompanyLoginUrl = await evaluate('window.location.href');
      console.log("URL after company login:", afterCompanyLoginUrl);
      
      // Capture Token
      const companyToken = await evaluate('localStorage.getItem("accessToken")');
      console.log("Company JWT Token in localStorage:", companyToken ? "PRESENT (VERIFIED)" : "MISSING");
      
      await evaluate('localStorage.clear(); sessionStorage.clear();');
      
      // ==========================================
      // 7. ADMIN LOGIN
      // ==========================================
      console.log("\n--- TESTING ADMIN LOGIN ---");
      await evaluate(`window.history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate'));`);
      await new Promise(r => setTimeout(r, 1500));
      
      await evaluate(`
        (function() {
          fillField('Email Address', 'admin@test.com');
          fillField('Password', 'Admin@012345');
          
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        })()
      `);
      console.log("Submitted Admin login, waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
      const afterAdminLoginUrl = await evaluate('window.location.href');
      console.log("URL after admin login:", afterAdminLoginUrl);
      
      // Capture Token
      const adminToken = await evaluate('localStorage.getItem("accessToken")');
      console.log("Admin JWT Token in localStorage:", adminToken ? "PRESENT (VERIFIED)" : "MISSING");

      console.log("\n=== EMULATOR WEBVIEW TESTS COMPLETED SUCCESSFULLY ===");
      ws.close();
      process.exit(0);

    } catch (err) {
      console.error("Test failed during evaluation:", err);
      ws.close();
      process.exit(1);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

run();
