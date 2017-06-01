'use strict';

var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var utils = require('../lib/utils');

module.exports = (req, res) => {
	// Get main global config
	var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
	var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');

	// Parse the body JSON and delete the specified result
	var resultObj = {
		name: req.query.name,
		sys_id: req.query.sys_id,
		sys_class_name: req.query.table
	};
	var sysIdPath = path.join(syncFilesPath, req.query.snInstance, 'synced', req.query.table, req.query.sys_id);
	
	// Use rimraf to delete the sys_id directory and everything below it
	rimraf(sysIdPath, function(err) {
		// Check for and thow any error
		if (err) {
			console.error(err.stack);
		}
		
		// Update the results.json
		var jsonResultsPath = path.join(syncFilesPath, req.query.snInstance, 'synced', req.query.table, 'results.json');
		utils.updateResultsFile(resultObj, jsonResultsPath, 'delete', configObj);
		
		// Send the updated savedScripts as the response
		res.json(utils.getSavedScripts(configObj, req.query.snInstance));
	});
};