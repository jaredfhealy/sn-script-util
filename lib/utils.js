'use strict';

var fs = require('fs');
var path = require('path');

module.exports = {
	getInfoFromPath: function(filePath) {
		// Data object to return
		var pathInfo = {};
		// Determine the instance name from the filePath
		var splitChar = filePath.match(/\\|\//)[0];
		var pathArr = filePath.split(splitChar);
		for (var i = 0; i < pathArr.length; i++) {
			if (pathArr[i] === 'sync_files') {
				// Save the snInstance
				pathInfo.snInstance = pathArr[i + 1];

				// Set the table
				pathInfo.tableName = pathArr[i + 3];

				// Save the sys_id
				pathInfo.sys_id = pathArr[i + 4];

				// Save the field name
				pathInfo.fieldName = pathArr[i + 5];

				// Save the file name for messaging
				pathInfo.fileName = pathArr[i + 6];
			}
		}

		return pathInfo;
	},
	
	getInstances: function(configObj) {
		// Variables
		var instances = [];
		
		// Only proceed if we have a base directory for sync_files
		if (configObj.sync_files_path !== "") {
			// Loop through auth to get all instances
			var authArr = configObj.auth;
			for (var i = 0; i < authArr.length; i++) {
				// Make sure the file structure is in place
				// Should only happen if a file the config file is edited manually
				var instanceName = authArr[i].instance;
				var instancePath = path.join(configObj.sync_files_path, 'sync_files', instanceName);
				try {
					fs.accessSync(instancePath);
				}
				catch(err) {
					this.createNewInstanceDirectories(instancePath);
				}
				
				// Add the instance to the list
				instances.push(instanceName);
			}
		}
		
		// Get all the directories one level under the sync path
		return instances;
	},
	
	createNewInstanceDirectories: function(instancePath) {
		// Create new directory as well as synced and z_execute directories
		fs.mkdirSync(instancePath);
		fs.mkdirSync(path.join(instancePath, 'synced'));
		fs.mkdirSync(path.join(instancePath, 'z_execute'));
		
		// Also create the default Background Script.js file
		fs.writeFileSync(path.join(instancePath, 'z_execute', 'Background Script.js'), "", "utf8");
	},
	
	getSavedScripts: function(configObj, snInstance) {
		// Saved Scripts object
		var savedScripts = {};
		
		// Only proceed if we have a base directory for sync_files
		if (configObj.sync_files_path !== "") {
			// Save the sync_files path
			var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');
			
			// If the directory exists, proceed
			try {
				fs.accessSync(syncFilesPath);
				
				// Get all the directories one level under the sync path
				var instanceDir = fs.readdirSync(syncFilesPath);
				
				// Loop through the directories
				for (var i = 0; i < instanceDir.length; i++) {
					// Create the instance object within savedScripts
					savedScripts[instanceDir[i]] = {};
					
					// Get the table name directories for this instance
					var tableDir = fs.readdirSync(path.join(syncFilesPath, instanceDir[i], 'synced'));
					
					// Loop through each table name directory
					for (var j = 0; j < tableDir.length; j++) {
						// Parse the results JSON for this table directory
						var resultsPath = path.join(syncFilesPath, instanceDir[i], 'synced', tableDir[j], 'results.json');
						var resultsObj = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
						
						// Save the object to return
						savedScripts[instanceDir[i]][tableDir[j]] = resultsObj;
					}
				}
			}
			catch(err) {
				// Nothing to do, an empty object will be returned
			}
		}
		
		// Return the savedScripts object
		return savedScripts;
	},
	
	updateResultsFile: function(resultObj, jsonResultsPath, action, configObj) {
		// Shared variables
		var defaultFields = configObj.default_query_feilds.split(',');
		var results = [];
		var i = 0;
		
		if (action == "append" || action == "delete") {
			// Get the existing file
			results = JSON.parse(fs.readFileSync(jsonResultsPath, 'utf8'));
		}
		
		// If new, just create 1 new entry and write the file
		if (action == 'new') {
			results[0] = {};
			for (i = 0; i < defaultFields.length; i++) {
				// Only populate the default query fields, not the script fields
				results[0][defaultFields[i]] = resultObj[defaultFields[i]];
			}
		}
		else if (action == 'append' || action == 'delete') {
			// Loop through all the results in the existing file
			for (i = 0; i < results.length; i++) {
				// Check if the current result matches
				if (results[i].sys_id === resultObj.sys_id) {
					// Remove the result for delete, new, or append
					results.splice(i, 1);
				}
			}

			if (action == 'append') {
				// Add onto the results
				var addResultObj = {};
				for (i = 0; i < defaultFields.length; i++) {
					// Only populate the default query fields, not the script fields
					addResultObj[defaultFields[i]] = resultObj[defaultFields[i]];
				}
				
				// Push the new object onto results
				results.push(addResultObj);
			}
		}
		
		// Write the file
		fs.writeFileSync(jsonResultsPath, JSON.stringify(results), 'utf8');
	},
	
	getBackgroundScripts: function(configObj) {
		// Background script object
		var backgroundScripts = {};
		
		// Only proceed if we have a base directory for sync_files
		if (configObj.sync_files_path !== "") {
			// Save the sync_files path
			var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');
			
			// If the directory exists, proceed
			try {
				fs.accessSync(syncFilesPath);
				
				// Get the instance directories
				var instanceDirArr = this.getInstances(configObj);
				
				// Get all files in the z_execute directory
				for (var i = 0; i < instanceDirArr.length; i++) {
					// Create the instance array
					backgroundScripts[instanceDirArr[i]] = [];
					
					// Get the execute directory for this instance
					var executeDir = path.join(syncFilesPath, instanceDirArr[i], 'z_execute/');
					
					// Get the files in the execute directory for this instance
					backgroundScripts[instanceDirArr[i]] = fs.readdirSync(executeDir);
				}
			}
			catch(err) {
				// Nothing to do here, an empty object will be returned
			}
		}
		
		// Return the background scripts object
		return backgroundScripts;
	}
};
