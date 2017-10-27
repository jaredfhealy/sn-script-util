'use strict';

var fs = require("fs");
var path = require("path");
var utils = require("../lib/utils");

module.exports = (req, res) => {
    // Get main global config
	var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
	var syncFilesPath = path.join(configObj.sync_files_path, 'sync_files');

    if (req.query.target == 'backgroundScripts') {
        // Get the current background script object
        res.json({
            success: true,
            status: 'success',
            backgroundScriptsObj: utils.getBackgroundScripts(configObj)
        });
    }
};