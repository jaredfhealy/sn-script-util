// Base app requirements
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var init = require('./lib/init');

// First make sure that startup checks pass
if (init.startupChecksPassed(__dirname)) {
	// Declare route files
	var web = require('./routes/web');
	var api = require('./routes/api');
	
	// Declare express instance variable
	var app = express();
	
	// Setup the view engine
	app.set('views', path.join(__dirname, 'views'));
	app.set('view engine', 'hbs');
	
	// Declare all middleware to use
	// uncomment after placing your favicon in /public
	//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
	app.use(logger('dev'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(cookieParser());
	app.use(express.static(path.join(__dirname, 'public')));
	
	// Map URI to route files
	app.use('/', web);
	app.use('/api', api);
	
	// Catch 404 and forward to error handler
	app.use(function(req, res, next) {
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});
	
	// Error handler
	app.use(function(err, req, res, next) {
		// set locals, only providing error in development
		res.locals.message = err.message;
		res.locals.error = req.app.get('env') === 'development' ? err : {};
		
		// render the error page
		res.status(err.status || 500);
		res.render('error');
	});

	module.exports = app;
}
else {
	module.exports = false;
}