// routes/pic.js
const router = require('express').Router();
const Pic = require('../models/PicTemp');

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const cond = q ? { $or: [{name: new RegExp(q,'i')}, {email: new RegExp(q,'i')}] } : {};
    const rows = await Pic.find(cond).limit(15).select('_id name email department').lean();
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
