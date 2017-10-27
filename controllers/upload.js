'use strict';

var request = require('request');
var auth = require('../lib/auth');
var fs = require('fs');
var path = require('path');

module.exports = (req, res) => {
	// Get main global config
	var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
	var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');
	
	// Get the sysId directory
	var sysIdPath = path.join(syncFilesPath, req.query.snInstance, 'synced', req.query.table, req.query.sys_id);
	
	// Get all directories underneath wich are the fields
	var fieldDir = fs.readdirSync(sysIdPath);

	// Setup bodyObj
	var putBodyObj = {};
	
	// Add each feild as a parameter and value on the body
	for (var key in fieldDir) {
		// Get the extension
		var extension = configObj.extension[fieldDir[key]] || ".js";
		
		// Get the filepath
		var filePath = path.join(sysIdPath, fieldDir[key], req.query.name + extension);
		
		try {
			fs.accessSync(filePath);
			putBodyObj[fieldDir[key]] = fs.readFileSync(filePath, 'utf8');
		}
		catch (e) {
			// Do nothing: That field doesn't have any content so no file exists
		}
	}

	// Convert the file contents to JSON
	var bodyString = JSON.stringify(putBodyObj);
	
	// Build the API endpoint url
	var url = "https://" + req.query.snInstance + ".service-now.com/api/now/table/";
	url += req.query.table + '/' + req.query.sys_id;

	// Set some custom headers to suppress returned data
	var instanceAuth = auth.getInstanceAuth(req.query.snInstance, configObj);
	var options = {
		method: "PUT",
		url: url,
		headers: {
			"X-no-response-body": "true",
			Authorization: instanceAuth.encoded
		},
		body: bodyString
	};

	// Make the put request
	request(options, function(error, response, body) {
		// If there was an error, output it
		if (error) {
			console.log("Request PUT: " + error);
		}

		// Check the response code was 200
		if (!error && (response.statusCode == 200 || response.statusCode == 204)) {
			res.json({
				success: true,
				status: 'success',
				message: "Updated Successfully: " + req.query.name
			});
		}
		else {
			res.json({
				success: false,
				status: 'error',
				message: "Unknown error: " + body
			});
		}
	});
};