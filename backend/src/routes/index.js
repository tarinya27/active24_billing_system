import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', time: new Date().toISOString() }, error: null });
});

router.use('/auth', authRoutes);

// Future day modules mount here:
// router.use('/users', userRoutes);
// router.use('/products', productRoutes);
// ...

export default router;
