var express = require('express');
var router = express.Router();

// API Root route
router.get('/', function(req, res, next) {
	res.send("API Version 0.0.1: Created by Gearvy LLC (Jared Healy)");
});

// All other API Routes
router.get('/search', require('../controllers/search'));
router.get('/delete', require('../controllers/delete'));
router.get('/upload', require('../controllers/upload'));
router.get('/execute', require('../controllers/execute'));
router.get('/config', require('../controllers/config'));
router.post('/config', require('../controllers/config'));
router.get('/files', require('../controllers/files'));

// Export the router
module.exports = router;