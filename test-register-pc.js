/**
 * Script untuk simulasi agent register PC baru
 * Jalankan: node test-register-pc.js
 */
const http = require("http");

const BASE_URL = "http://localhost:3001";

const testData = {
  serialNumber: "TEST-SN-" + Date.now(),
  assetNumber: "AST-TEST-001",
  userLogin: "testuser",
  isAdmin: false,
  type: "LT", // LT = Laptop, DT = Desktop
  agentVersion: "1.0.4",
  location: {
    category: "Lab",
    room: "Lab 101",
    floor: "1",
    campus: "Anggrek",
  },
};

console.log("📡 Registering PC with data:");
console.log(JSON.stringify(testData, null, 2));
console.log("");

const postData = JSON.stringify(testData);

const req = http.request(
  `${BASE_URL}/api/pc/register`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const data = JSON.parse(body);
        console.log("Response:", JSON.stringify(data, null, 2));
        if (res.statusCode === 200) {
          console.log("\n✅ PC registered! Sekarang cek halaman Asset Management di browser.");
          console.log("   Seharusnya ada 1 asset baru dengan:");
          console.log(`   - Serial Number: ${testData.serialNumber}`);
          console.log("   - Category: Hardware");
          console.log("   - Sub Category: Laptop");
          console.log("   - Status: Deployed");
        }
      } catch (e) {
        console.log("Raw response:", body);
      }
    });
  }
);

req.on("error", (err) => {
  console.error("❌ Error:", err.message);
  console.error("   Pastikan backend sudah running di", BASE_URL);
});

req.write(postData);
req.end();
