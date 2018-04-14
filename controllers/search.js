'use strict';

var request = require('request');
var auth = require('../lib/auth');
var fs = require('fs');
var path = require('path');
var utils = require('../lib/utils');

module.exports = (req, res) => {
	// Get configuration and paths
	var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
	var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');
	
	// Variables to set
	var url = "https://" + req.query.snInstance + ".service-now.com/api/now/table/" + req.query.table;
	var qs = {};
	
	// Check for optional parameters
	var save = false;
	if (typeof(req.query.save) != 'undefined') {
		if (req.query.save === 'true') {
			url += "/" + req.query.sys_id;
			qs.sysparm_fields = configObj.default_query_feilds + "," + configObj.fields.toString();
			save = true;
		}
	}
	else {
		qs.sysparm_query = req.query.sysparm_query;
		qs.sysparm_limit = req.query.sysparm_limit;
		qs.sysparm_fields = configObj.default_query_feilds;
	}
	
	// Query ServiceNow
	var instanceAuth = auth.getInstanceAuth(req.query.snInstance, configObj);
	var options = {
		url: url,
		method: "GET",
		headers: {
			Authorization: instanceAuth.encoded
		},
		qs: qs
	};
	
	request(options, function(err, response, body) {
		if (err) {
			console.log(err);
			res.status(500).json({
				error: 'Query to ServiceNow failed'
			});
		}
		else {
			// Parse the body to an object
			var bodyObj = JSON.parse(body);
			
			if (!save) {
				// Make sure there is a result key
				if (typeof(bodyObj.result) !== 'undefined') {
					// Loop through the results from SN
					for (var i = 0; i < bodyObj.result; i++) {
						var classKeyFound = false;
						for (var key in bodyObj.result[i]) {
							// Check for a class key (May not exist on a custom table)
							if (key == 'sys_class_name') {
								classKeyFound = true;
							}
						}
						
						// If no class key was found, add the table name
						// If it's blank, set it to the passed in table
						if (!classKeyFound) {
							bodyObj.result[i]['sys_class_name'] = req.query.table;
						}
					}
					
					// Send the result back to the client
					res.json({
						success: true,
						status: 'success',
						result: bodyObj.result
					});
				}
				else if (typeof(bodyObj.error.detail) != 'undefined') {
					res.json({
						success: false,
						status: "error",
						message: bodyObj.error.detail + ". Double check your password."
					});
				}
				else {
					res.json({
						success: false,
						status: "error",
						message: "Unknown error: " + body
					});
				}
			}
			else if (save) {
				// If save is passed in, it means there is only one script result in the body
				if (typeof(bodyObj.result) !== 'undefined') {
					// Create the result
					createSearchResult(req.query.snInstance, req.query.table, bodyObj.result, syncFilesPath, configObj);
						
					// Send saved scripts as the response
					res.json({
						success: true,
						status: "success",
						message: "File downloaded successfully.",
						savedScripts: utils.getSavedScripts(configObj, req.query.snInstance)
					});
				}
			}
		}
	});
};

function createSearchResult(snInstance, table, resultObj, syncFilesPath, configObj) {
	// Get the synced directory
	var syncedPath = path.join(syncFilesPath, snInstance, 'synced');

	// Create the main result directory
	var resultPath = path.join(syncedPath, table);
	var jsonResultsPath = path.join(resultPath, 'results.json');
	try {
		fs.accessSync(resultPath);
		
		// Since the directory exists, check for a results JSON file
		try {
			fs.accessSync(path.join(jsonResultsPath));
			utils.updateResultsFile(resultObj, jsonResultsPath, 'append', configObj);
		}
		catch (err) {
			utils.updateResultsFile(resultObj, jsonResultsPath, 'new', configObj);
		}
	}
	catch (err) {
		fs.mkdirSync(resultPath);
		utils.updateResultsFile(resultObj, jsonResultsPath, 'new', configObj);
	}

	// For each field create a separate folder under the named directory
	var fields = configObj.fields;
	var sysIdDir;

	// Determine if "name" or "u_name" is present, else default to a generic file name
	var entryName = 'content';
	for (var key in resultObj) {
		if (key === 'name' || key === 'u_name') {
			entryName = resultObj[key];
		}
	}

	for (var i = 0; i < fields.length; i++) {
		if (typeof(resultObj[fields[i]]) !== 'undefined') {
			// Create the sys_id directory
			sysIdDir = path.join(resultPath, resultObj.sys_id);
			try {
				fs.accessSync(sysIdDir);
			}
			catch (err) {
				fs.mkdirSync(sysIdDir);
			}

			// Create a directory for the field
			var fieldDir = path.join(sysIdDir, fields[i]);
			try {
				fs.accessSync(fieldDir);
			}
			catch (err) {
				fs.mkdirSync(fieldDir);
			}

			// Also create a named file with the extension and content returned from the API call
			var extension = configObj.extension[fields[i]] || ".js";
			var content = typeof(resultObj[fields[i]]) !== 'undefined' ? resultObj[fields[i]] : "";

			// Only create for fields that aren't empty
			if (content) {
				fs.writeFileSync(path.join(fieldDir, entryName + extension), content, 'utf8');
			}
		}
	}
}