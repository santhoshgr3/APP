const express = require("express");
const router = express.Router();
const { db } = require("../db");

// GET /locations/districts
router.get("/districts", (req, res) => {
  res.json(db.prepare("SELECT * FROM districts ORDER BY name").all());
});

// GET /locations/mandals?district_id=1
router.get("/mandals", (req, res) => {
  const { district_id } = req.query;
  if (!district_id) return res.status(400).json({ error: "district_id required" });
  res.json(db.prepare("SELECT * FROM mandals WHERE district_id = ? ORDER BY name").all(district_id));
});

// GET /locations/villages?mandal_id=1
router.get("/villages", (req, res) => {
  const { mandal_id } = req.query;
  if (!mandal_id) return res.status(400).json({ error: "mandal_id required" });
  res.json(db.prepare("SELECT * FROM villages WHERE mandal_id = ? ORDER BY name").all(mandal_id));
});

// GET /locations/categories (retailer sectors)
router.get("/categories", (req, res) => {
  res.json(db.prepare("SELECT * FROM retailer_categories ORDER BY name").all());
});

// GET /locations/plans (membership plans)
router.get("/plans", (req, res) => {
  const plans = db.prepare("SELECT * FROM membership_plans").all();
  res.json(plans.map((p) => ({ ...p, benefits: JSON.parse(p.benefits) })));
});

module.exports = router;
