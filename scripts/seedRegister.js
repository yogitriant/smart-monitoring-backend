const axios = require("axios");
require("dotenv").config();

(async () => {
  try {
    const res = await axios.post(`${process.env.BASE_URL}/api/pc/register`, {
      serialNumber: "SEED-LT-0001",
      assetNumber: "AST-TEST-001",
      pic: "Yogi",
      userLogin: "yogi.trianto",
      isAdmin: true,
      type: "LT", // Laptop
      location: {
        campus: "Kemanggisan",
        room: "701",
        floor: "7",
        category: "Lab Komputer",
      },
    });

    console.log("✅ Seed register success:", res.data);
  } catch (err) {
    console.error(
      "❌ Seed register failed:",
      err.response?.data || err.message
    );
  }
})();
