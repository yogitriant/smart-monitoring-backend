require("dotenv").config();
const mongoose = require("mongoose");
const xlsx = require("xlsx");

const CategoryItem = require("./models/CategoryItem");
const RegionSiteItem = require("./models/RegionSiteItem");
const Location = require("./models/Location");
const FieldOption = require("./models/FieldOption");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/smart-monitoring-db";

async function seed() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected!");

  const workbook = xlsx.readFile("../Template_MasterData-Yoga.xlsx");

  // Helper function to upsert FieldOption
  async function addFieldOption(type, value, parent = null) {
      if (!value) return;
      // trim spaces
      value = value.toString().trim();
      if (!value) return;
      if (parent) parent = parent.toString().trim();

      await FieldOption.findOneAndUpdate(
          { type, value },
          { $set: { parent: parent || null } },
          { upsert: true, new: true }
      );
  }

  // 1. Template_MasterData_Category -> CategoryItem
  if (workbook.SheetNames.includes("Template_MasterData_Category")) {
    const catSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Template_MasterData_Category"]);
    for (const row of catSheet) {
      const productCategory = row["PRODUCT CATEGORY"];
      const subCategory = row["SUB CATEGORY"];
      const parentProdCat = row["PARENT (PRODUCT CATEGORY)"]; // Assuming this exists based on CSV
      const productName = row["PRODUCT NAME"];
      const manufacturer = row["MANUFACTURER"];
      const supplierName = row["SUPPLIER NAME"];

      if (!productCategory && !productName) continue;

      // Create CategoryItem record
      await CategoryItem.findOneAndUpdate(
        { 
          productCategory: productCategory || "", 
          subCategory: subCategory || "", 
          productName: productName || "",
          manufacturer: manufacturer || "",
          supplierName: supplierName || ""
        },
        { $set: {} },
        { upsert: true, new: true }
      );

      // Create FieldOptions
      await addFieldOption("productCategory", productCategory);
      await addFieldOption("subCategory", subCategory, parentProdCat || productCategory);
      await addFieldOption("productName", productName, subCategory);
      await addFieldOption("manufacturer", manufacturer);
      await addFieldOption("supplierName", supplierName);
    }
    console.log("✅ CategoryItem & related FieldOptions populated.");
  }

  // 2. Template_MasterData_Location -> RegionSiteItem
  if (workbook.SheetNames.includes("Template_MasterData_Location")) {
    const locSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Template_MasterData_Location"]);
    for (const row of locSheet) {
      const region = row["REGION"];
      const siteGroup = row["SITE GROUP"];
      const site = row["SITE"];
      const division = row["DIVISION"];
      const department = row["DEPARTMENT"];
      const ownerSite = row["OWNER SITE"];

      if (!region && !site && !department) continue;

      await RegionSiteItem.findOneAndUpdate(
        {
          region: region || "",
          siteGroup: siteGroup || "",
          site: site || "",
          division: division || "",
          department: department || "",
          ownerSite: ownerSite || ""
        },
        { $set: {} },
        { upsert: true, new: true }
      );

      // Create FieldOptions
      await addFieldOption("region", region);
      await addFieldOption("siteGroup", siteGroup, region);
      await addFieldOption("site", site, siteGroup);
      await addFieldOption("division", division, site);
      await addFieldOption("department", department, division);
      await addFieldOption("ownerSite", ownerSite);
    }
    console.log("✅ RegionSiteItem & related FieldOptions populated.");
  }

  // 3. Template_MasterData_Ruangan -> Location
  if (workbook.SheetNames.includes("Template_MasterData_Ruangan")) {
    const roomSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Template_MasterData_Ruangan"]);
    for (const row of roomSheet) {
      const room = row["NAMA RUANGAN (ROOM)"];
      const category = row["KATEGORI (CATEGORY)"];
      const floor = row["LANTAI (FLOOR)"];

      if (!room) continue;

      await Location.findOneAndUpdate(
        {
          room: room || "",
          category: category || "",
          floor: floor || ""
        },
        { $set: {} },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Location populated.");
  }

  console.log("\n📊 Summary in Database:");
  console.log(`- CategoryItem: ${await CategoryItem.countDocuments()}`);
  console.log(`- RegionSiteItem: ${await RegionSiteItem.countDocuments()}`);
  console.log(`- Location: ${await Location.countDocuments()}`);
  console.log(`- FieldOption: ${await FieldOption.countDocuments()}`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected. Seeding done!");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err.message);
  process.exit(1);
});
