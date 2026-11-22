const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth, requirePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../config/rbac');

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission(PERMISSIONS.USERS_MANAGE));

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.patch('/:id', userController.updateUser);

module.exports = router;
