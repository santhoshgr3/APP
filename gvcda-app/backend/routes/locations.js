const express = require("express");
const router = express.Router();
const { all } = require("../db");

// GET /locations/districts
router.get("/districts", async (req, res, next) => {
  try { res.json(await all("SELECT * FROM districts ORDER BY name")); } catch (e) { next(e); }
});

// GET /locations/mandals?district_id=1
router.get("/mandals", async (req, res, next) => {
  try {
    const { district_id } = req.query;
    if (!district_id) return res.status(400).json({ error: "district_id required" });
    res.json(await all("SELECT * FROM mandals WHERE district_id = ? ORDER BY name", [district_id]));
  } catch (e) { next(e); }
});

// GET /locations/villages?mandal_id=1
router.get("/villages", async (req, res, next) => {
  try {
    const { mandal_id } = req.query;
    if (!mandal_id) return res.status(400).json({ error: "mandal_id required" });
    res.json(await all("SELECT * FROM villages WHERE mandal_id = ? ORDER BY name", [mandal_id]));
  } catch (e) { next(e); }
});

// GET /locations/categories (retailer sectors)
router.get("/categories", async (req, res, next) => {
  try { res.json(await all("SELECT * FROM retailer_categories ORDER BY name")); } catch (e) { next(e); }
});

// GET /locations/plans (membership plans)
router.get("/plans", async (req, res, next) => {
  try {
    const plans = await all("SELECT * FROM membership_plans");
    res.json(plans.map((p) => ({ ...p, benefits: JSON.parse(p.benefits) })));
  } catch (e) { next(e); }
});

module.exports = router;
