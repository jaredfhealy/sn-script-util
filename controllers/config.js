'use strict';

var fs = require("fs");
var path = require("path");
var auth = require("../lib/auth");
var utils = require("../lib/utils");

module.exports = (req, res) => {
	// Config.json path
	var configPath = path.join(__dirname, '..', 'config.json');
	var configObj = {};
	
	// If this is a "GET" just return the current config
	if (req.method == "GET") {
		configObj = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		res.json({
			success: true,
			status: 'success',
			config: configObj
		});
	}
	else if (req.method == "POST") {
		if (typeof(req.body.activeInstance) != 'undefined') {
			// Pass the configuration to auth for encoding
			configObj = auth.processConfigChanges(req.body);
			var instances = utils.getInstances(configObj);
			
			// Validate data accuracy and required fields
			var formErrors = {};
			var hasFormErrors = false;
			
			// First check for the directory if sync_files_path is updated
			if (configObj.sync_files_path != "") {
				var basePath = path.join(configObj.sync_files_path);
				try {
					fs.accessSync(basePath);
					
					// Check if the sync_files exists
					var syncPath = path.join(basePath, 'sync_files');
					try {
						fs.accessSync(syncPath);
					}
					catch(err) {
						fs.mkdirSync(syncPath);
						console.log("Creating sync_files: " + syncPath);
					}
				}
				catch(err) {
					formErrors.sync_files_path = "Unable to access specified path.";
					hasFormErrors = true;
				}
			}
			
			// Write the new file contents
			if (!hasFormErrors) {
				fs.writeFileSync(configPath, JSON.stringify(configObj, null, '\t'), 'utf8');
				
				// Send success response
				res.json({
					success: true,
					status: 'success',
					message: "Configuration updated successfully",
					config: configObj,
					instances: instances,
					formErrors: formErrors
				});
			}
			else if (hasFormErrors) {
				// Send success response
				res.json({
					success: false,
					status: 'error',
					message: "Form errors encountered. Please correct.",
					formErrors: formErrors
				});
			}
		}
		else {
			res.json({
				success: false,
				status: 'error',
				message: "Unable to parse the new configuration."
			});
		}
	}
	else {
		res.json({
			success: false,
			status: 'error',
			message: "Unable to determine action based on query parameters."
		});
	}
};