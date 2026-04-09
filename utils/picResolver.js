const mongoose = require("mongoose");
const Pic = require("../models/PicTemp");

const isOid = (v) => mongoose.isValidObjectId(v);
const esc = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isEmail = (s = "") => /\S+@\S+\.\S+/.test(String(s));

async function resolvePic(input) {
  if (!input) return null;

  // ==========================
  // 📌 STRING input
  // Bisa ObjectId, Email, atau Nama
  // ==========================
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;

    // case ObjectId langsung
    if (isOid(s)) return s;

    // case email
    if (isEmail(s)) {
      const doc = await Pic.findOneAndUpdate(
        { email: s.toLowerCase() },
        {
          $setOnInsert: { email: s.toLowerCase() },
          $set: { name: s }, // kalau baru dibuat, name default = email
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return doc._id;
    }

    // case nama
    let doc = await Pic.findOne({
      name: new RegExp(`^${esc(s)}$`, "i"),
    });
    if (!doc) doc = await Pic.create({ name: s });
    return doc._id;
  }

  // ==========================
  // 📌 OBJECT input
  // {_id?, name?, email?, department?, phone?}
  // ==========================
  if (typeof input === "object") {
    const { _id, name, email, department, phone } = input;

    // case pakai _id
    if (_id && isOid(_id)) {
      const doc = await Pic.findByIdAndUpdate(
        _id,
        {
          $set: {
            ...(name && { name }),
            ...(email && { email: email.toLowerCase() }),
            ...(department && { department }),
            ...(phone && { phone }),
          },
        },
        { new: true }
      );
      return doc?._id || _id;
    }

    // case pakai email
    if (email) {
      const doc = await Pic.findOneAndUpdate(
        { email: email.toLowerCase() },
        {
          $set: {
            name: name || email,
            email: email.toLowerCase(),
            ...(department && { department }),
            ...(phone && { phone }),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return doc._id;
    }

    // case pakai nama (tanpa email)
    if (name) {
      const doc = await Pic.findOneAndUpdate(
        { name: new RegExp(`^${esc(name)}$`, "i") },
        {
          $set: {
            name,
            ...(email && { email: email.toLowerCase() }),
            ...(department && { department }),
            ...(phone && { phone }),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return doc._id;
    }
  }

  return null;
}

module.exports = { resolvePic };
