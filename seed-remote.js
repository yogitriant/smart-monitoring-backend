const axios = require("axios");
const xlsx = require("xlsx");

const API_URL = "http://10.20.0.71:3001/api";

// ⚠️ ISIKAN KREDENSIAL ADMIN ANDA DI SINI UNTUK LOGIN KE SERVER ⚠️
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password123";

async function loginToBackend() {
    console.log("🔐 Melakukan autentikasi ke server...");
    try {
        const res = await axios.post(`${API_URL}/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const token = res.data.token;
        console.log("✅ Login berhasil! Mendapatkan Token JWT.");
        return token;
    } catch (e) {
        console.error("❌ Login gagal! Periksa email dan password admin Anda.");
        if (e.response && e.response.data) console.error("Error dari server:", e.response.data.message);
        process.exit(1);
    }
}

async function run() {
    console.log("🚀 Starting secure remote seeding to", API_URL);
    
    const token = await loginToBackend();
    
    // Menerapkan token JWT sebagai Authorization Header di semua request AXIOS selanjutnya
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const workbook = xlsx.readFile("../Template_MasterData-Yoga.xlsx");

    console.log("📡 Fetching existing data for deduplication...");
    let existingFieldOptions = [];
    let existingCategoryItems = [];
    let existingRegionSiteItems = [];
    let existingLocations = [];

    try {
        existingFieldOptions = (await axios.get(`${API_URL}/field-options`)).data;
        existingCategoryItems = (await axios.get(`${API_URL}/category-items`)).data;
        existingRegionSiteItems = (await axios.get(`${API_URL}/region-site-items`)).data;
        existingLocations = (await axios.get(`${API_URL}/location`)).data;
    } catch(e) {
        console.error("❌ Failed to fetch from remote API. Token mungkin kadaluarsa atau API tidak dapat diakses.");
        return;
    }

    const foSet = new Set(existingFieldOptions.map(o => `${o.type}|${o.value}|${o.parent||""}`));
    const catSet = new Set(existingCategoryItems.map(c => `${c.productCategory}|${c.subCategory}|${c.productName}`));
    const regSet = new Set(existingRegionSiteItems.map(r => `${r.region}|${r.siteGroup}|${r.site}|${r.department}`));
    const locSet = new Set(existingLocations.map(l => `${l.room}|${l.category}|${l.floor}`));

    let newFoCount = 0;
    let newCatCount = 0;
    let newRegCount = 0;
    let newLocCount = 0;

    async function addFieldOption(type, value, parent = null) {
        if (!value) return;
        value = value.toString().trim();
        if (!value) return;
        if (parent) parent = parent.toString().trim();

        const key = `${type}|${value}|${parent||""}`;
        if (!foSet.has(key)) {
            await axios.post(`${API_URL}/field-options`, { type, value, parent });
            foSet.add(key);
            newFoCount++;
        }
    }

    // 2. Templates_MasterData_Category -> CategoryItem
    if (workbook.SheetNames.includes("Template_MasterData_Category")) {
        console.log("📝 Processing Template_MasterData_Category...");
        const catSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Template_MasterData_Category"]);
        for (const row of catSheet) {
            const productCategory = row["PRODUCT CATEGORY"] || "";
            const subCategory = row["SUB CATEGORY"] || "";
            const parentProdCat = row["PARENT (PRODUCT CATEGORY)"] || "";
            const productName = row["PRODUCT NAME"] || "";
            const manufacturer = row["MANUFACTURER"] || "";
            const supplierName = row["SUPPLIER NAME"] || "";

            if (!productCategory && !productName) continue;

            const key = `${productCategory}|${subCategory}|${productName}`;
            if (!catSet.has(key)) {
                await axios.post(`${API_URL}/category-items`, {
                    productCategory, subCategory, productName, manufacturer, supplierName
                });
                catSet.add(key);
                newCatCount++;
            }

            await addFieldOption("productCategory", productCategory);
            await addFieldOption("subCategory", subCategory, parentProdCat || productCategory);
            await addFieldOption("productName", productName, subCategory);
            await addFieldOption("manufacturer", manufacturer);
            await addFieldOption("supplierName", supplierName);
        }
    }

    // 3. Template_MasterData_Location -> RegionSiteItem
    if (workbook.SheetNames.includes("Template_MasterData_Location")) {
        console.log("📝 Processing Template_MasterData_Location...");
        const locSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Template_MasterData_Location"]);
        for (const row of locSheet) {
            const region = row["REGION"] || "";
            const siteGroup = row["SITE GROUP"] || "";
            const site = row["SITE"] || "";
            const division = row["DIVISION"] || "";
            const department = row["DEPARTMENT"] || "";
            const ownerSite = row["OWNER SITE"] || "";

            if (!region && !site && !department) continue;

            const key = `${region}|${siteGroup}|${site}|${department}`;
            if (!regSet.has(key)) {
                await axios.post(`${API_URL}/region-site-items`, {
                    region, siteGroup, site, division, department, ownerSite
                });
                regSet.add(key);
                newRegCount++;
            }

            await addFieldOption("region", region);
            await addFieldOption("siteGroup", siteGroup, region);
            await addFieldOption("site", site, siteGroup);
            await addFieldOption("division", division, site);
            await addFieldOption("department", department, division);
            await addFieldOption("ownerSite", ownerSite);
        }
    }

    // 4. Template_MasterData_Ruangan -> Location
    if (workbook.SheetNames.includes("Template_MasterData_Ruangan")) {
        console.log("📝 Processing Template_MasterData_Ruangan...");
        const roomSheet = xlsx.utils.sheet_to_json(workbook.Sheets["Template_MasterData_Ruangan"]);
        for (const row of roomSheet) {
            const room = row["NAMA RUANGAN (ROOM)"] || "";
            const category = row["KATEGORI (CATEGORY)"] || "";
            const floor = row["LANTAI (FLOOR)"] || "";

            if (!room) continue;

            const key = `${room}|${category}|${floor}`;
            if (!locSet.has(key)) {
                await axios.post(`${API_URL}/location`, { room, category, floor });
                locSet.add(key);
                newLocCount++;
            }
        }
    }

    console.log("✅ Secured Remote Seeding Complete!");
    console.log("📊 Inserted new records:");
    console.log(`- CategoryItem: ${newCatCount}`);
    console.log(`- RegionSiteItem: ${newRegCount}`);
    console.log(`- Location: ${newLocCount}`);
    console.log(`- FieldOption: ${newFoCount}`);
}

run().catch(e => {
    console.error("❌ Fatal Error:", e.message);
});
