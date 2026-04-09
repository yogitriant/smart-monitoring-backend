const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Pc = require("../models/Pc");
const Spec = require("../models/Spec");
const Location = require("../models/Location");
const Performance = require("../models/Performance");
const Pic = require("../models/PicTemp");
const verifyToken = require("../middleware/verifyToken");

// helpers
const isOid = (v) => mongoose.isValidObjectId(v);
const toOid = (v) => (isOid(v) ? new mongoose.Types.ObjectId(v) : null);
const esc = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ===========================
 * GET /api/pc
 * (list lengkap + spec/performance terbaru)
 * =========================== */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { campus, category, room, nolocOnly } = req.query;

    const query = {};
    if (nolocOnly === "true") {
      query.$or = [{ location: { $exists: false } }, { location: null }];
    } else {
      const locationFilter = {};
      if (campus) locationFilter.campus = campus;
      if (category) locationFilter.category = category;
      if (room) locationFilter.room = room;

      const matchedLocations = await Location.find(locationFilter).select("_id");
      if (matchedLocations.length) {
        query.location = { $in: matchedLocations.map((l) => l._id) };
      } else if (campus || category || room) {
        // ada filter lokasi tapi tidak ada yang cocok
        return res.json([]);
      }
    }

    const pcs = await Pc.find(query)
      .populate("location", "campus room category")
      .populate("pic", "name email department")
      .sort({ updatedAt: -1 })
      .lean();

    const pcIds = pcs.map((pc) => pc._id);
    const [specs, latestPerformances] = await Promise.all([
      Spec.find({ pc: { $in: pcIds } }).lean(),
      // ✅ Single aggregation instead of N+1 queries
      Performance.aggregate([
        { $match: { pc: { $in: pcIds } } },
        { $sort: { timestamp: -1 } },
        { $group: {
          _id: "$pc",
          doc: { $first: "$$ROOT" },
        }},
        { $replaceRoot: { newRoot: "$doc" } },
      ]),
    ]);

    // Build map for O(1) lookup
    const perfMap = {};
    for (const p of latestPerformances) {
      perfMap[String(p.pc)] = p;
    }

    const result = pcs.map((pc) => {
      const spec = specs.find((s) => String(s.pc) === String(pc._id));
      const performance = perfMap[String(pc._id)] || null;
      return {
        ...pc,
        spec,
        performance,
        picName: typeof pc.pic === "object" ? pc.pic?.name : pc.pic || null,
        picEmail: typeof pc.pic === "object" ? pc.pic?.email : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Gagal ambil daftar PC:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
 * GET /api/pc/list
 * =========================== */
// ...

router.get("/list", verifyToken, async (req, res) => {
  try {
    const { campus, category, room, pic, nolocOnly } = req.query;
    const query = {};

    // ---- lokasi (tetap sama) ----
    if (nolocOnly === "true") {
      query.$or = [{ location: { $exists: false } }, { location: null }];
    } else if (campus || category || room) {
      const lf = {};
      if (campus) lf.campus = campus;
      if (category) lf.category = category;
      if (room) lf.room = room;
      const locs = await Location.find(lf).select("_id");
      if (!locs.length) return res.json([]);
      query.location = { $in: locs.map(l => l._id) };
    }

    // ---- PIC filter ----
    if (typeof pic === "string" && pic.trim().length > 0) {
      const term = pic.trim();
      if (isOid(term)) {
        query.pic = toOid(term);                // cari langsung by _id
      } else {
        // cari _id PIC by name/email
        const re = new RegExp(esc(term), "i");
        const picIds = await Pic.find({ $or: [{ name: re }, { email: re }] }).distinct("_id");
        // match ref baru (ObjectId) ATAU data lama string yg mengandung term
        query.$or = [
          ...(query.$or || []),
          ...(picIds.length ? [{ pic: { $in: picIds } }] : []),
          { pic: re },
        ];
      }
    }

    // ---- ambil rows ----
    // IMPORTANT: batasi populate hanya untuk dokumen yang pic bertipe ObjectId
    const rows = await Pc.find(query)
      .where({ $or: [ { pic: { $type: "objectId" } }, { pic: { $exists: false } }, { pic: null } ] })
      .populate("location", "campus room category")
      .populate("pic", "name email department")
      .sort({ updatedAt: -1 })
      .select("pcId serialNumber assetNumber userLogin lastLoginUser lastActive status location pic idleTimeout isAdmin lifecycleStatus")
      .lean();

    // ambil juga dokumen yang pic-nya masih string (tanpa populate)
    const legacyRows = await Pc.find({
      ...query,
      pic: { $type: "string" }                      // hanya yang string
    })
    .populate("location", "campus room category")
    .sort({ updatedAt: -1 })
    .select("pcId serialNumber assetNumber userLogin lastLoginUser lastActive status location pic idleTimeout isAdmin lifecycleStatus")
    .lean();

    const all = [...rows, ...legacyRows];

    res.json(all.map(r => ({
      ...r,
      picName: typeof r.pic === "object" ? r.pic?.name : (r.pic || null),
      picEmail: typeof r.pic === "object" ? r.pic?.email : null,
    })));
  } catch (err) {
    console.error("❌ /api/pc/list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
 * GET /api/pc/list-with-location
 * =========================== */
router.get("/list-with-location", verifyToken, async (req, res) => {
  try {
    const rowsA = await Pc.find({
      $or: [
        { location: { $type: "objectId" } },
        { location: { $exists: false } },
        { location: null },
      ],
      $and: [
        {
          $or: [
            { pic: { $type: "objectId" } },
            { pic: { $exists: false } },
            { pic: null },
          ],
        },
      ],
    })
      .populate("location", "campus room category")
      .populate("pic", "name email department")
      .sort({ pcId: 1 })
      .select(
        "pcId pic serialNumber assetNumber userLogin status location idleTimeout performanceInterval isAdmin lifecycleStatus"
      )
      .lean();

    const rowsB = await Pc.find({
      location: { $type: "string" },
      pic: { $type: "objectId" },
    })
      .populate("pic", "name email department")
      .sort({ pcId: 1 })
      .select(
        "pcId pic serialNumber assetNumber userLogin status location idleTimeout performanceInterval isAdmin lifecycleStatus"
      )
      .lean();

    const rowsC_objLoc = await Pc.find({
      pic: { $type: "string" },
      location: { $type: "objectId" },
    })
      .populate("location", "campus room category")
      .sort({ pcId: 1 })
      .select(
        "pcId pic serialNumber assetNumber userLogin status location idleTimeout performanceInterval isAdmin"
      )
      .lean();

    const rowsC_strLoc = await Pc.find({
      pic: { $type: "string" },
      location: { $type: "string" },
    })
      .sort({ pcId: 1 })
      .select(
        "pcId pic serialNumber assetNumber userLogin status location idleTimeout performanceInterval isAdmin"
      )
      .lean();

    const all = [...rowsA, ...rowsB, ...rowsC_objLoc, ...rowsC_strLoc].map(
      (pc) => ({
        ...pc,
        location: typeof pc.location === "object" ? pc.location : null,
        picName: typeof pc.pic === "object" ? pc.pic?.name : pc.pic || null,
        picEmail: typeof pc.pic === "object" ? pc.pic?.email : null,
        idleTimeout: pc.idleTimeout ?? 0,
        performanceInterval: pc.performanceInterval ?? 3600, // ✅ default 1 jam (detik)
      })
    );

    res.json(all);
  } catch (err) {
    console.error("❌ Gagal ambil list PC+lokasi:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});


/* ===========================
 * GET /api/pc/list-full
 * =========================== */
router.get("/list-full", verifyToken, async (req, res) => {
  try {
    const pcs = await Pc.find({})
      .sort({ pcId: 1 })
      .lean();

    const pcIds = pcs.map((pc) => pc._id);

    // ---- Ambil Spec terbaru ----
    const specs = await Spec.find({ pc: { $in: pcIds } }).lean();
    const specMap = {};
    specs.forEach((s) => {
      specMap[s.pc.toString()] = s;
    });

    // ---- PIC (ObjectId) ----
    const picIds = pcs
      .filter((pc) => mongoose.isValidObjectId(pc.pic))
      .map((pc) => pc.pic);

    const picMap = {};
    if (picIds.length > 0) {
      const pics = await Pic.find({ _id: { $in: picIds } })
        .select("name email department")
        .lean();
      pics.forEach((p) => {
        picMap[p._id.toString()] = p;
      });
    }

    // ---- Location (ObjectId) ----
    const locIds = pcs
      .filter((pc) => mongoose.isValidObjectId(pc.location))
      .map((pc) => pc.location);

    const locMap = {};
    if (locIds.length > 0) {
      const locs = await Location.find({ _id: { $in: locIds } })
        .select("campus room category")
        .lean();
      locs.forEach((l) => {
        locMap[l._id.toString()] = l;
      });
    }

    // ---- Gabungkan semua data ----
    const result = pcs.map((pc) => {
      const spec = specMap[pc._id.toString()] || null;

      // PIC
      let picName = null;
      let picEmail = null;
      if (mongoose.isValidObjectId(pc.pic)) {
        const picObj = picMap[pc.pic.toString()];
        if (picObj) {
          picName = picObj.name;
          picEmail = picObj.email;
        }
      } else if (typeof pc.pic === "string") {
        picName = pc.pic;
      }

      // Location
      let location = null;
      if (mongoose.isValidObjectId(pc.location)) {
        location = locMap[pc.location.toString()] || null;
      } else if (typeof pc.location === "string" && pc.location.trim() !== "") {
        // coba parse format: "Campus, Room (Category)"
        const regex = /^(.*?)(?:,\s*(.*?))?(?:\s*\((.*?)\))?$/;
        const match = pc.location.match(regex);
        if (match) {
          location = {
            campus: match[1] || "-",
            room: match[2] || "-",
            category: match[3] || "-",
          };
        } else {
          location = { campus: pc.location, room: "-", category: "-" };
        }
      }

      return {
        ...pc,
        spec,
        location,
        picName,
        picEmail,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("❌ /api/pc/list-full error:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
  
});




module.exports = router;
