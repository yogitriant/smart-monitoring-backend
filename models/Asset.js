const mongoose = require("mongoose");

const customSpecSchema = new mongoose.Schema(
    {
        key: { type: String, required: true },
        value: { type: String, required: true },
    },
    { _id: false }
);

const assetSchema = new mongoose.Schema(
    {
        // ─── CI / FA Information ───────────────────────────
        faNumber: { type: String, unique: true, sparse: true },
        serialNumber: { type: String },
        company: { type: String },
        status: {
            type: String,
            enum: ["Deployed", "Reserve", "Received", "On Loan", "Down", "Inventory", "Disposed"],
            default: "Reserve",
        },
        statusReason: {
            type: String,
            enum: ["Hibah", "Lelang", "Obsolete", "-"],
            default: "-",
        },

        // ─── Field Categorization ──────────────────────────
        productCategory: { type: String, default: "" },
        subCategory: { type: String }, // Peripheral, Desktop, Laptop, Monitor, dsb
        productName: { type: String }, // HP Elitebook 640 G10
        manufacturer: { type: String }, // HP, Dell, Samsung
        supplierName: { type: String }, // PT. ABC

        // ─── Location ──────────────────────────────────────
        location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
        region: { type: String },
        siteGroup: { type: String },
        site: { type: String },
        division: { type: String },
        department: { type: String },
        ownerSite: { type: String },

        // ─── Lifecycle ─────────────────────────────────────
        receiveDate: { type: Date },
        loanStartDate: { type: Date },
        loanEndDate: { type: Date },
        downTime: { type: Date },
        disposalDate: { type: Date },
        warrantyExpDate: { type: Date },

        // ─── Owner Information ─────────────────────────────
        ownerFullname: { type: String },
        jobDesignation: { type: String },

        // ─── Specs ─────────────────────────────────────────
        brand: { type: String },
        model: { type: String },
        customSpecs: [customSpecSchema],

        // ─── Relasi ke PC (opsional) ───────────────────────
        pc: { type: mongoose.Schema.Types.ObjectId, ref: "Pc" },

        // ─── Attachments ───────────────────────────────────
        attachments: [{
            filename: String,
            originalName: String,
            url: String,
            uploadedAt: { type: Date, default: Date.now },
            mimetype: String,
            size: Number
        }],
    },
    { timestamps: true }
);

// Indexes
assetSchema.index({ serialNumber: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ productCategory: 1 });
assetSchema.index({ site: 1 });

module.exports = mongoose.model("Asset", assetSchema);
