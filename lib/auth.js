'use strict';

// Get dependencies
const fs = require("fs");
const path = require("path");
const utils = require("./utils");

module.exports = {
	
	processConfigChanges: function(configObj) {
		// Look specifically at the auth array and encode any passwords
		var authArr = configObj.auth;
		for (var i = 0; i < authArr.length; i++) {
			// If we have a password, encode it
			if (authArr[i].pass != "") {
				// Encode the values and then clear the plain text
				var basicAuthString = authArr[i].user + ":" + authArr[i].pass;
				
				// Set the encoded value
				authArr[i].encoded = "Basic " + new Buffer(basicAuthString, 'utf8').toString('base64');
				
				// Clear the plain text
				authArr[i].pass = "";
				
				// Make sure the instance directory exists
				var instancePath = path.join(configObj.sync_files_path, 'sync_files', authArr[i].instance);
				try {
					fs.accessSync(instancePath);
				}
				catch(err) {
					utils.createNewInstanceDirectories(instancePath);
				}
			}
		}
		
		// Return the modified config object
		return configObj;
	},
	
	getInstanceAuth: function(snInstance, configObj) {
		// Variables used
		var instanceAuth = {};
		var changesToWrite = false;

		// Read and parse the config file
		var configPath = path.join(__dirname, '..', 'config.json');
		
		// Loop through the auth entries
		var authArr = configObj.auth;
		for (var i = 0; i < authArr.length; i++) {
			// If we have a plain text password, encode it
			// This should only happen if the config file was edited directly
			if (authArr[i].pass) {
				// Encode the values and then clear the plain text
				var basicAuthString = authArr[i].user + ":" + authArr[i].pass;
				authArr[i].encoded = "Basic " + new Buffer(basicAuthString, 'utf8').toString('base64');
	
				// Clear the plain text pass
				authArr[i].pass = '';
				
				// Save auth to variable for requests if the instance matches
				if (authArr[i].instance = snInstance) {
					instanceAuth = authArr[i].encoded;
				}
				
				// Flag that we have changes to write
				changesToWrite = true;
			}
			else if (authArr[i].encoded && authArr[i].instance == snInstance) {
				// Store the auth for this instance
				instanceAuth = authArr[i];
			}
		}
		
		if (changesToWrite) {
			// Write the updated config
			fs.writeFileSync(configPath, JSON.stringify(configObj, null, '\t'));
		}

		// Return the string
		return instanceAuth;
	}
};
