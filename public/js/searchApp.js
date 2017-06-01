var searchApp = new Vue({
	el: '#searchApp',
	data: {
		mainConfig: window.grv.mainConfig,
		instances: window.grv.instances,
		savedScripts: window.grv.savedScripts,
		
		configChanged: false,
		settingsFormErrors: {},
		
		searchString: '',
		results: [],
		selectedTable: "",
		selectedInstance: window.grv.mainConfig.activeInstance,
		searching: false,
		searchComplete: true,
		availableModes: ["search", "edit", "pinned", "execute", "settings"],
		appMode: "search",
		alertType: "success",
		alertMsg: "",
		pinnedList: {},
		showNav: false,
		markedDelete: -1,
		
		backgroundScripts: window.grv.backgroundScripts,
		selectedBS: "Background Script.js",
		bsResult: {},
		showCookieWindow: false,
		selectedInstanceCookie: "",
		
		showSettingsWelcome: false
	},
	computed: {
		backgroundScriptURL: function() {
			return "https://" + this.selectedInstance + ".service-now.com/sys.scripts.do";
		},
		savedScriptIds: function() {
			// Change the format of the savedScripts for easier searching in templates
			var scriptObj = {};
			var savedScripts = this.savedScripts;
			
			// Loop through the savedScripts instances
			for (var key in savedScripts) {
				// Object for the instance
				scriptObj[key] = {};
				
				// If there is a table entry
				if (typeof(savedScripts[key]) != 'undefined') {
					// Loop through the tableObj
					var tableObj = savedScripts[key];
					for (var key2 in tableObj) {
						// Create the array for the sys_ids
						scriptObj[key][key2] = [];
						
						// If there is a sys_id entry
						if (typeof(savedScripts[key][key2]) != 'undefined'){
							// Loop through the table object array
							var entryArr = savedScripts[key][key2];
							for (var i = 0; i < entryArr.length; i++) {
								// Extract the sys_id and push it to the array
								scriptObj[key][key2].push(entryArr[i].sys_id);
							}
						}
					}
				}
			}
			
			// Return the computed object
			return scriptObj;
		},
		
		searchMode: function() {
			return this.appMode === 'search';
		},
		
		editMode: function() {
			return this.appMode === 'edit';
		},
		
		pinnedMode: function() {
			return this.appMode === 'pinned';
		},
		
		executeMode: function() {
			return this.appMode === 'execute';
		},
		
		settingsMode: function() {
			return this.appMode === 'settings';
		},
		
		pinnedIds: function() {
			// Simple array to return
			var ids = [];
			
			// Convert the pinned list to a simple array of IDs
			var listObj = this.pinnedList;
			
			for (var key in listObj) {
				// Get the instance array
				var listArr = listObj[key];
				
				// Loop through the array
				for (var i = 0; i < listArr.length; i++) {
					ids.push(listArr[i].sys_id);
				}
			}
			
			// Return the array result
			return ids;
		},
		
		instanceCSRF: function() {
			// Transform the config auth to a basic hash object by instance
			var csrfObj = {};
			
			if (typeof(this.mainConfig.auth) != 'undefined') {
				// Get the auth array and loop through
				var authArr = this.mainConfig.auth;
				for (var i = 0; i < authArr.length; i++) {
					// Create a new instance object if it doesn't already exist
					if (typeof(csrfObj[authArr[i].instance]) == 'undefined') {
						csrfObj[authArr[i].instance] = {};
					}
					csrfObj[authArr[i].instance].refreshedToday = authArr[i].csrfRefreshedToday;
					csrfObj[authArr[i].instance].csrf = authArr[i].csrf;
				}
			}
			
			return csrfObj;
		},
		
		bsCookie: {
			get: function() {
				// Return the cookie for the selected instance
				if (typeof(this.mainConfig.auth) != 'undefined') {
					var authArr = this.mainConfig.auth;
					for (var i = 0; i < authArr.length; i++) {
						if (authArr[i].instance == this.selectedInstance) {
							return authArr[i].cookieString;
						}
					}
				}
				return "";
			},
			
			set: function(newValue) {
				// Get the auth for the selected instance
				var authArr = this.mainConfig.auth;
				for (var i = 0; i < authArr.length; i++) {
					if (authArr[i].instance == this.selectedInstance) {
						// Parse the new cookie string and only save the ones we need
						var rawCookieArr = newValue.split('; ');
						var newCookieArr = [];
						var cookiesWeNeed = [
							"JSESSIONID",
							"glide_user",
							"glide_user_session",
							"glide_session_store"
						];
						
						// Loop through the array
						for (var j = 0; j < rawCookieArr.length; j++) {
							// Get just the name of the cookie
							var cookieName = rawCookieArr[j].split('=')[0].trim();
							console.error("cookieName: " + cookieName);
							
							// If this cookie is in the list we want, save it
							if (cookiesWeNeed.indexOf(cookieName) != -1) {
								newCookieArr.push(rawCookieArr[j]);
							}
						}
						
						// Save the processed cookie to the instance auth cookie
						console.dir(newCookieArr);
						authArr[i].cookieArr = newCookieArr;
						authArr[i].cookieString = newCookieArr.join('; ');
					}
				}
			}
		}
	},
	watch: {
		selectedInstance: function() {
			// Only if this isn't the settings page
			if (!this.settingsMode) {
				// Set mode to reload data
				this.setAppMode(this.appMode);
			}
		},
		
		selectedTable: function() {
			// Table changes in "pinned" mode don't require a reload of data set
			if (this.appMode != 'pinned') {
				// All other modes, set the mode to handle data
				this.setAppMode(this.appMode);
			}
		},
		
		searching: function() {
			// Try and handle timeouts
			setTimeout(this.handleLikelyTimeout, 5000);
		},
		
		mainConfig: {
			handler: function() {
				if (!this.configChanged) {
					this.configChanged = true;
				}
			},
			deep: true
		},
	},
	methods: {
		executeSearch: function() {
			// Store reference to vue instance
			var self = this;
			
			// Check if a search string was entered
			if (self.searchString) {
				// Track the search progress
				self.searching = true;
				self.searchComplete = false;
				
				// Determine the correct sysparm_query format
				var tableArr = this.mainConfig.tables;
				var nameKey = "name";
				for (var i = 0; i < tableArr.length; i++) {
					if (tableArr[i].name === this.selectedTable && tableArr[i].alternate_name_field != "") {
						nameKey = tableArr[i].alternate_name_field;
					}
				}
				
				// Execute the request
				$.ajax({
					url: "/api/search",
					method: "GET",
					dataType: "json",
					contentType: "application/json",
					data: {
						sysparm_query: nameKey + "CONTAINS" + self.searchString,
						table: self.selectedTable,
						snInstance: self.selectedInstance,
						sysparm_limit: 50
					},
					cache: false,
					success: function(data) {
						self.searching = false;
						self.searchComplete = true;
						$('#progress-bar').removeClass('complete');
						
						if (data.success) {
							self.results = data.result;
						}
						else if (!data.success) {
							self.showAlert(data.message, data.status)
						}
					},
					error: function(jqXHR) {
						console.log("Error encountered: " + jqXHR.responseText);
					}
				});
				
				// Set progress bar width to 100%
				setTimeout(function(){
					$('#progress-bar').addClass('complete');
				}, 500);
			}
		},
		
		downloadScript: function(snInstance, result) {
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Execute the request
			$.ajax({
				url: "/api/search",
				method: "GET",
				dataType: "json",
				contentType: "application/json",
				data: {
					sys_id: result.sys_id,
					table: result.sys_class_name,
					snInstance: snInstance,
					save: 'true'
				},
				cache: false,
				success: function(data) {
					// Reset search
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');

					// Handle success
					if (data.success) {
						self.showAlert(data.message, data.status);
						self.savedScripts = data.savedScripts;
					}
					else {
						self.searching = false;
						self.searchComplete = true;
						$('#progress-bar').removeClass('complete');
						self.showAlert(data.message, data.status);
					}
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		deleteScript: function(snInstance, result, index) {
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Execute the request
			$.ajax({
				url: "/api/delete",
				method: "GET",
				dataType: "json",
				contentType: "application/json",
				data: {
					snInstance: snInstance,
					table: this.selectedTable,
					sys_id: result.sys_id,
					name: result.name
				},
				cache: false,
				success: function(data) {
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');
					self.savedScripts = data;
					self.results.splice(index, 1);
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		uploadToServiceNow: function(snInstance, result) {
			// Upload the script fields for this record to ServiceNow
			console.log("Uploading...");
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Execute the request
			$.ajax({
				url: "/api/upload",
				method: "GET",
				dataType: "json",
				contentType: "application/json",
				data: {
					snInstance: snInstance,
					table: this.selectedTable,
					sys_id: result.sys_id,
					name: result.name
				},
				cache: false,
				success: function(data) {
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');
					
					// Alert success
					if (data.success) {
						self.showAlert("Script: " + result.name + " - Saved Successfully", data.status);
					}
					else {
						self.showAlert("ERROR: Script: " + result.name + " - Failed to Save", data.status);
					}
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		executeBackgroundScript: function(snInstance, scriptName) {
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Initiate the post to trigger the execute
			// Execute the request
			$.ajax({
				url: "/api/execute",
				method: "GET",
				dataType: "json",
				contentType: "application/json",
				data: {
					snInstance: snInstance,
					scriptName: scriptName
				},
				cache: false,
				success: function(data) {
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');
					
					if (data.success) {
						// Update the results
						self.bsResult = data;
					}
					else {
						self.bsResult = data;
						self.showAlert(data.message, data.status);
					}
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		refreshCSRF: function(snInstance) {
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Initiate the post to trigger the execute
			// Execute the request
			$.ajax({
				url: "/api/execute",
				method: "GET",
				dataType: "json",
				contentType: "application/json",
				data: {
					snInstance: snInstance,
					cookieString: self.instanceCSRF[snInstance].cookie,
					refreshCSRF: "true"
				},
				cache: false,
				success: function(data) {
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');
					
					if (data.success) {
						// Update the results
						self.instanceCSRF[snInstance].csrf = data.csrf;
						self.instanceCSRF[snInstance].refreshedToday = true;
						self.showAlert(data.message, data.status);
						
						// Update the mainConfig and save the changes
						var authArr = self.mainConfig.auth;
						for (var i = 0; i < authArr.length; i++) {
							if (authArr[i].instance == snInstance) {
								authArr[i].csrf = data.csrf;
								authArr[i].csrfRefreshedToday = true;
							}
						}
						
						// Save the current configuration
						self.saveConfigChanges();
					}
					else {
						self.showAlert(data.message, data.status, 4000);
					}
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		alertCSRF: function(csrf) {
			// Use a standard javascript alert
			alert("Current CSRF Token (sysparm_ck):\n\n" + csrf);
		},
		
		handleLikelyTimeout: function() {
			// If searching hasn't completed yet
			if (!this.searchComplete) {
				// Set search complete and clear the status bar
				this.searchComplete = true;
				this.searching = false;
				$('#progress-bar').removeClass('complete');
				
				this.showAlert("Long running query. Continue to wait or try again.", 'warning', 5000);
			}
		},
		
		setAppMode: function(mode) {
			// Make sure navigation is closed
			this.showNav = false;
			
			// Reset any delete index
			this.markedDelete = -1;
			
			// If there are configuration changes, warn
			if (this.settingsMode && this.configChanged && !this.showSettingsWelcome) {
				var msg = "You have unsaved configuration changes!";
				msg += "\nClick 'Cancel' and save your config changes.";
				msg += "\nOr click on 'OK' and any unsaved changes will be reverted.";
				if (confirm(msg)) {
					this.undoAllConfigChanges();
				}
				else {
					// Return without doing anything
					return;
				}
			}
			
			// If there is no instance auth or sync_files_path, alert and stay
			if ((this.mainConfig.sync_files_path == "" || this.mainConfig.auth.length === 0) && !this.showSettingsWelcome) {
				var msg2 = "You must add at least 1 instance auth entry. Click the '+' sign above the table.";
				this.showAlert(msg2, 'warning', 3000);
				return;
			}
			
			// Check and apply the mode
			switch (mode) {
				case "search":
					// Clear any results
					this.results = [];
					
					// Set the mode property
					this.appMode = 'search';
					break;
				
				case "edit":
					// Clear the results in case there are any
					this.results = [];
					
					// Set the mode property
					this.appMode = 'edit';
					
					// If we have an instance & table, set the contents based on savedScripts
					if (this.selectedInstance != "" && this.selectedTable != "") {
						// Determine if there are entries for this instance and table combination
						var hasScripts = typeof(this.savedScripts[this.selectedInstance]) != 'undefined';
						var hasScriptType = typeof(this.savedScripts[this.selectedInstance][this.selectedTable]) != 'undefined';
						
						// Update the results if we have data
						if (hasScripts && hasScriptType) {
							this.results = this.savedScripts[this.selectedInstance][this.selectedTable];
						}
					}
					
					break;
					
				case "pinned":
					// Set results to the pinned scripts
					if (this.pinnedIds.length === 0) {
						this.showAlert("You have no pinned scripts. Click 'Edit' and pin a script.", 'warning', 3000);
					}
					else {
						// Set the result set to the current pinned list for this instance
						this.results = this.pinnedList[this.selectedInstance];
						
						// Set the mode property
						this.appMode = 'pinned';
					}
					
					break;
					
				case "execute":
					// Set the mode property
					this.appMode = 'execute';
					
					break;
				
				case "settings":
					// Set the mode property
					this.appMode = 'settings';
					
					break;
					
				case "default":
					// Make sure search mode is set, something wierd happened
					this.appMode = 'search';
					this.results = [];
					this.searchString = '';
					break;
			}
				
		},
		
		getResultValue: function(result, fieldName, selectedTable) {
			// Loop through the tables config
			var tableArr = this.mainConfig.tables;
			var key = fieldName;
			for (var i = 0; i < tableArr.length; i++) {
				if (tableArr[i].name === selectedTable && tableArr[i].alternate_name_field != "" && fieldName === "name") {
					key = tableArr[i].alternate_name_field;
				}
				else if (tableArr[i].name === selectedTable && tableArr[i].alternate_name_field != "" && fieldName === "description") {
					key = tableArr[i].alternate_description_field;
				}
			}
			
			// Return the value based on the defined namekey for this table
			return result[key];
		},
		
		pinScript: function(snInstance, result) {
			// Save the current object
			var pinnedList = this.pinnedList;
			
			// Create or update the array specific to the SN Instance
			if (typeof(pinnedList[snInstance]) == 'undefined') {
				pinnedList[snInstance] = [];
			}
			
			// Add the result
			pinnedList[snInstance].push(result);
			
			// Overwrite the pinned list so that the computed property is triggered
			this.pinnedList = {};
			this.pinnedList = pinnedList;
		},
		
		unpinScript: function(snInstance, result) {
			// Loop through the results for this instance
			var instanceResultArr = this.pinnedList[snInstance];
			for (var i = 0; i < instanceResultArr.length; i++) {
				if (instanceResultArr[i].sys_id === result.sys_id) {
					this.pinnedList[snInstance].splice(i, 1);
				}
			}
		},
		
		showDownloadScriptButton: function(result) {
			if (this.searchMode) {
				if (Object.keys(this.savedScriptIds).indexOf(this.selectedInstance) != -1) {
					if (typeof(this.savedScriptIds[this.selectedInstance][this.selectedTable]) != 'undefined') {
						if (this.savedScriptIds[this.selectedInstance][this.selectedTable].indexOf(result.sys_id) == -1) {
							return true;
						}
						else {
							return false;
						}
					}
				}
				
				return true;
			}
			
			return false;
		},
		
		showDownloadedButton: function(result) {
			if (this.searchMode) {
				// Check if the current record exists in the savedScriptIds object
				if (Object.keys(this.savedScriptIds).indexOf(this.selectedInstance) != -1) {
					if (typeof(this.savedScriptIds[this.selectedInstance][this.selectedTable]) != 'undefined') {
						if (this.savedScriptIds[this.selectedInstance][this.selectedTable].indexOf(result.sys_id) != -1) {
							return true;
						}
						else {
							return false;
						}
					}
				}
			}
			
			return false;
		},
		
		showDeleteButton: function(result) {
			if (this.editMode) {
				if (Object.keys(this.savedScriptIds).indexOf(this.selectedInstance) != -1) {
					if (typeof(this.savedScriptIds[this.selectedInstance][this.selectedTable]) != 'undefined') {
						if (this.savedScriptIds[this.selectedInstance][this.selectedTable].indexOf(result.sys_id) != -1) {
							return true;
						}
						else {
							return false;
						}
					}
				}
			}
			
			return false;
		},
		
		showPinButton: function(result) {
			// Return value
			var show = false;
			
			// Show if searchMode and the script is downloaded
			if (this.searchMode && this.showDownloadedButton(result) && !this.isPinned(result)) {
				show = true;
			}
			
			// If this edit mode, show as well
			if (this.editMode && !this.isPinned(result)) {
				show = true;
			}
			
			
			
			// Return the show value
			return show;
		},
		
		showAlert: function(msg, type, ms) {
			this.alertMsg = msg;
			this.alertType = type;
			ms = ms || 2000;
			// $('#alert').slideToggle().delay(2000).slideToggle();
			$('#alert').animate({ right: "0" }).delay(ms).animate({ right: "-345px" });
		},
		
		getAlertClass: function(type) {
			return "alert-" + type;
		},
		
		isPinned: function(result) {
			return this.pinnedIds.indexOf(result.sys_id) != -1;
		},
		
		getPinnedCountForMenu: function(mode) {
			if (mode == 'pinned' && this.pinnedIds.length > 0) {
				return "(" + this.pinnedIds.length + ")";
			}
		},
		
		deleteConfigTableRow: function(entry, i) {
			// First remove the item
			this.mainConfig.tables.splice(i,1);
			
			// Also update the alternate field entry
			if (typeof(this.mainConfig.alternate_name_field[entry.name]) != 'undefined') {
				delete this.mainConfig.alternate_name_field[entry.name];
			}
		},
		
		deleteConfigAuthRow: function(auth, i) {
			// Remove the item
			this.mainConfig.auth.splice(i,1);
		},
		
		undoAllConfigChanges: function() {
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Initiate the post to trigger the execute
			// Execute the request
			$.ajax({
				url: "/api/config",
				method: "GET",
				dataType: "json",
				contentType: "application/json",
				cache: false,
				success: function(data) {
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');
					
					// Update the results
					if (data.success) {
						self.mainConfig = data.config;
						self.settingsFormErrors = {};
						self.$nextTick(function(){
							self.configChanged = false;
							self.showAlert("Config changes reverted and reloaded.", data.status);
						});
					}
					else if (!data.success) {
						self.showAlert(data.message, data.status);
					}
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		saveConfigChanges: function() {
			// Store reference to vue instance
			var self = this;
			
			// Track the search progress
			self.searching = true;
			self.searchComplete = false;
			
			// Initiate the post to trigger the execute
			// Execute the request
			$.ajax({
				url: "/api/config",
				method: "POST",
				dataType: "json",
				contentType: "application/json",
				cache: false,
				data: JSON.stringify(self.mainConfig),
				processData: false,
				success: function(data) {
					self.searching = false;
					self.searchComplete = true;
					$('#progress-bar').removeClass('complete');
					
					if (data.success) {
						// Update the results
						self.mainConfig = data.config;
						self.instances = data.instances;
						self.settingsFormErrors = {}; // clear any previous errors
						self.$nextTick(function(){
							self.configChanged = false;
							self.showAlert("Configuration updated successfully.", data.status);
						});
					}
					else if (!data.success) {
						self.settingsFormErrors = data.formErrors;
						self.showAlert(data.message, data.status);
					}
				},
				error: function(jqXHR) {
					console.log("Error encountered: " + jqXHR.responseText);
				}
			});
			
			// Set progress bar width to 100%
			setTimeout(function(){
				$('#progress-bar').addClass('complete');
			}, 500);
		},
		
		addNewAuthRow: function() {
			// Create an empty row object
			var rowObj = {};
			rowObj.instance = "";
			rowObj.user = "";
			rowObj.pass = "";
			rowObj.encoded = "";
			rowObj.csrf = "";
			rowObj.cookieString = "";
			rowObj.cookieArr = [];
			rowObj.csrfRefreshedToday = false;
			
			// Push the empty object on to the auth array
			this.mainConfig.auth.push(rowObj);
		}
	},
	mounted: function() {
		// Set preloaded data values from the global window.grv values
		// this.mainConfig = window.grv.mainConfig;
		// this.backgroundScripts = window.grv.backgroundScripts;
		// this.instances = window.grv.instances;
		// this.savedScripts = window.grv.savedScripts;
		
		// Set default instance if there is only one
		if (this.instances.length === 1) {
			this.selectedInstance = this.instances[0];
		}
		else if (this.mainConfig.activeInstance != "") {
			this.selectedInstance = this.mainConfig.activeInstance;
		}
		
		// If no sync_files_path, and no auth, redirect to settings
		if (this.mainConfig.sync_files_path == "" || this.mainConfig.auth.length === 0) {
			this.showSettingsWelcome = true;
			this.setAppMode('settings');
		}
		
		// Anything we need to run after all subsequent mutations process
		// that may be triggered by actions in the mounted function
		this.$nextTick(function(){
			// Reset config changed now that it's loaded
			this.configChanged = false;
		});
	}
});
