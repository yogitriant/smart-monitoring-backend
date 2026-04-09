const mongoose = require("mongoose");

const fieldOptionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      "productCategory",
      "subCategory",
      "productName",
      "manufacturer",
      "supplierName",
      "region",
      "siteGroup",
      "site",
      "division",
      "department",
      "ownerSite"
    ]
  },
  value: {
    type: String,
    required: true
  },
  parent: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("FieldOption", fieldOptionSchema);
