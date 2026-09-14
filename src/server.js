'use strict';

/**
 * Express server (Phase 6).
 *
 * Exposes the existing backend pipeline — generateSubstation() ->
 * simulateEnvelope() -> decideRecommendation() -> explainRecommendation() —
 * over HTTP for the React frontend in client/. No new simulation or decision
 * logic lives here; this only wires together what Phases 1-5 already built
 * and serves it as JSON.
 */

const express = require('express');
const { generateSubstation } = require('./data/generator');
const { simulateEnvelope } = require('./simulation/envelopeSimulator');
const { decideRecommendation } = require('./agent/decisionEngine');
const { explainRecommendation } = require('./agent/explainability');

const PORT = process.env.PORT || 3001;

// Matches the seed used throughout the README, scripts/decideSample.js, and
// scripts/runEval.js's SUB-001 substation, so UI results stay consistent with
// everything already hand-verified in Phases 2-5.
const SEED = 42;
const SUBSTATION_ID = 'SUB-001';
const SUBSTATION_NAME = 'Test Substation';

const app = express();
app.use(express.json());

app.post('/api/envelope', (req, res) => {
  const { ratedCapacityMW, proposedLoadMW } = req.body || {};

  if (!(Number(ratedCapacityMW) > 0)) {
    res.status(400).json({ error: 'ratedCapacityMW must be a positive number' });
    return;
  }
  if (!(Number(proposedLoadMW) >= 0)) {
    res.status(400).json({ error: 'proposedLoadMW must be a non-negative number' });
    return;
  }

  try {
    const substation = generateSubstation({
      id: SUBSTATION_ID,
      name: SUBSTATION_NAME,
      ratedCapacityMW: Number(ratedCapacityMW),
      seed: SEED,
    });

    const proposedLoad = {
      substationId: substation.id,
      sizeMW: Number(proposedLoadMW),
      flexibilityAvailable: true,
    };

    const envelopeResult = simulateEnvelope(substation, proposedLoad);
    const decided = decideRecommendation(envelopeResult);
    const explained = explainRecommendation(decided, {
      ratedCapacityMW: substation.ratedCapacityMW,
      scenarioDays: substation.scenarioDays,
    });

    res.json({
      ...explained,
      ratedCapacityMW: substation.ratedCapacityMW,
      hourlyLoadProfile: substation.hourlyLoadProfile,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Grid Headroom Advisor API listening on http://localhost:${PORT}`);
});
