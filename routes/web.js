var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var utils = require('../lib/utils');

// Index route
router.get('/', function(req, res, next) {
	// Re-read the config file for each page refresh
	var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
	
	// Handle \" in the JSON string by also escaping the slash, \\"
	var configString = JSON.stringify(configObj);
	// configString = configString.replace(/\\/g,"\\\\");
	
	res.render('index', {
		title: 'Express',
		mainConfig: configString,
		instances: JSON.stringify(utils.getInstances(configObj)),
		savedScripts: JSON.stringify(utils.getSavedScripts(configObj, 'all')),
		backgroundScripts: JSON.stringify(utils.getBackgroundScripts(configObj))
	});
});

// Export the router
module.exports = router;
