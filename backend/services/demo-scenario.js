/** Presentation-only demo overlay. It never changes model inference or inputs. */
const DEMO_OVERRIDES = {
  'west-siang-aalo-corridor': { riskScore: 82, riskLevel: 'critical', landslideRate: 82, rainfall24h: 128, rainfall7d: 390, groundDeformation: 0.95, deformationRateMm: 30.4, roadStatus: 'blocked', triggerProbability: 0.88, explanation: 'CRITICAL HAZARD: Aalo, West Siang, has 128mm of rainfall in 24 hours, saturated antecedent conditions, and elevated ground deformation. Keep the Siyom corridor closed and activate the approved diversion plan.' },
  'lower-subansiri-potin-junction': { riskScore: 67, riskLevel: 'high', landslideRate: 67, rainfall24h: 84, rainfall7d: 285, groundDeformation: 0.72, deformationRateMm: 23, roadStatus: 'restricted', triggerProbability: 0.71, explanation: 'HIGH WARNING: Potin, Lower Subansiri, has saturated slopes following sustained rainfall. Restrict heavy vehicles and inspect drainage before allowing movement.' },
  'papum-pare-sagalee-nh13': { riskScore: 58, riskLevel: 'high', landslideRate: 58, rainfall24h: 69, rainfall7d: 244, groundDeformation: 0.62, deformationRateMm: 19.8, roadStatus: 'restricted', triggerProbability: 0.62, explanation: 'HIGH WARNING: Sagalee, Papum Pare, shows increased ground disturbance during heavy rainfall. Avoid roadside halts near exposed slopes and keep response teams ready.' },
};

function applyDemoScenario(zone) {
  if (process.env.LANDGUARD_DEMO_SCENARIO === 'false') return zone;
  const override = DEMO_OVERRIDES[zone.id];
  return override ? { ...zone, ...override, demoScenario: true } : zone;
}

module.exports = { applyDemoScenario };
