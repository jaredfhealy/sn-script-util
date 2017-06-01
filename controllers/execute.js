'use strict';

var request = require('request');
var auth = require('../lib/auth');
var fs = require('fs');
var path = require('path');

module.exports = (req, res) => {
	// Get main global config
	var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
	var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');
	
	// Get instance authentication
	var instanceAuth = auth.getInstanceAuth(req.query.snInstance, configObj);

	// Start the endpoint URL
	var url = "https://" + req.query.snInstance + ".service-now.com/sys.scripts.do";
	var options = {};
	
	// If csrfRefresh was not passed in, execute the script
	if (typeof(req.query.refreshCSRF) != 'undefined') {
		if (req.query.refreshCSRF == "true") {
			// Get the user profile form (could be any form) from ServiceNow
			// Set some custom headers and form data
			options = {
				method: "GET",
				url: url,
				headers: {
					Cookie: instanceAuth.cookieString,
					Authorization: ""
				}
			};
			
			// Make the put request
			request(options, function(error, response, body) {
				// If there was an error, output it
				if (error) {
					res.json({
						success: false,
						status: "error",
						message: error
					});
				}
		
				// Check the response code was 200
				if (!error && (response.statusCode == 200) && body.toLowerCase().indexOf("sysparm_ck") != -1) {
					// Get the csrf value
					var sysparm_ck = body.match(/sysparm_ck.*?value="(.*?)"/i)[1];
					
					if (sysparm_ck.length === 72 && sysparm_ck.indexOf('"') == -1) {
						res.json({
							success: true,
							status: 'success',
							message: 'CSRF was successfully refreshed.',
							csrf: sysparm_ck
						});
					}
					else {
						res.json({
							success: false,
							status: "error",
							message: "Unable to find the sysparm_ck input field."
						});
					}
				}
				else {
					res.json({
						success: false,
						status: "error",
						message: body
					});
				}
			});
		}
		else {
			res.json({
				success: false,
				status: "error",
				message: "Unable to determine action needed."
			});
		}
	}
	else if (typeof(req.query.scriptName) != 'undefined') {
		// Get the filepath to the passed in script
		var filePath = path.join(syncFilesPath, req.query.snInstance, 'z_execute', req.query.scriptName);
	
		// Get the file content
		var fileContent = fs.readFileSync(filePath, 'utf8').trim();
	
		// Set some custom headers and form data
		options = {
			method: "POST",
			url: url,
			headers: {
				Cookie: instanceAuth.cookieString,
				Authorization: ""
			},
			form: {
				script: fileContent,
				sysparm_ck: instanceAuth.csrf,
				sys_scope: "global",
				runscript: "Run script",
			}
		};
	
		// Make the put request
		request(options, function(error, response, body) {
			// If there was an error, output it
			if (error) {
				res.json({
					success: false,
					status: "error",
					message: error
				});
			}
	
			// Check the response code was 200
			if (!error && (response.statusCode == 200) && body.toLowerCase().indexOf("<pre>") != -1) {
				// Parse the results with simple splits
				var bodySplit = body.split('<HR/>');
				var timing = bodySplit[0].replace('[','').split(']')[0];

				// Send the response
				res.json({
					success: true,
					status: 'success',
					message: "Executed background script successfully.",
					output: bodySplit[1],
					timing: timing
				});
			}
			else {
				res.json({
					success: false,
					status: "error",
					message: body
				});
			}
		});
	}
	else {
		res.json({
			success: false,
			status: "error",
			message: "No scriptName provided and csrfRefresh is not defined or is false."
		});
	}
};