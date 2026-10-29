import { Router } from 'express';
import { ExpenseController } from '../controllers/expenseController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', ExpenseController.list);
router.post('/', ExpenseController.create);
router.put('/:id', ExpenseController.update);
router.delete('/:id', ExpenseController.delete);

export default router;

