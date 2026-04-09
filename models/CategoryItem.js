const mongoose = require("mongoose");

const categoryItemSchema = new mongoose.Schema({
    productCategory: { type: String, default: "" },
    subCategory: { type: String, default: "" },
    productName: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    supplierName: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("CategoryItem", categoryItemSchema);
