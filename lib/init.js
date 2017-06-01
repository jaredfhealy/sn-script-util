'use strict';

// Get dependencies
const fs = require("fs");
const path = require("path");

// Called during initial startup to validate things are configured properly
module.exports = {
	
	startupChecksPassed: function(rootDir) {
		// Check for the existence of a config.json file
		var configFile = path.join(rootDir, 'config.json');
		
		try {
			fs.accessSync(configFile);
			
			// Return true for startup check, we have a config file
			return true;
		}
		catch(err) {
			// The file doesn't exist, try getting the example config file
			var exConfigFile = path.join(rootDir, 'example.config.json');
			
			try {
				fs.accessSync(exConfigFile);
				
				// We do have an example file, parse it into an object
				var exConfigObj = JSON.parse(fs.readFileSync(exConfigFile, 'utf8'));
				
				// Set the default sync_files_path
				exConfigObj.sync_files_path = path.join(rootDir, '..');
				
				// Check if the 'sync_files' directory exists
				var syncFilesPath = path.join(rootDir, '..', 'sync_files');
				try {
					fs.accessSync(syncFilesPath);
				}
				catch(err) {
					fs.mkdirSync(syncFilesPath);
				}
				
				// Write the object to config.json which will be used going forward
				fs.writeFileSync(configFile, JSON.stringify(exConfigObj, null, '\t'), 'utf8');
				
				// Return true so app startup continues
				return true;
			}
			catch(err) {
				// If the example file doesn't exist either, exit the app
				console.error("No example.config.json file or config.json file exists.\nThere appears to be a problem with your installation.\nPlease install the application again, or restore the file manually from Github.");
				process.exitCode = 0;
				
				// Return false to terminate app startup
				return false;
			}
		}
	}
};