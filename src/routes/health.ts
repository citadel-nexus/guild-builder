import express from 'express';
const router = express.Router();
router.get('/health', (_req, res) => {
  res.json({ guild: 'builder', status: 'ok', version: '0.1.0', nats_prefix: 'citadel.builder.*' });
});
export default router;
