const express = require('express');
const proxy = require('express-http-proxy');

// Constants
const PORT = 3000;

// App
const app = express();
app.get('/', function (req, res) {
   res.send("<h2>Ain't nothing but a thing.</h2>\nSolr proxy here: <a href='/solr'>/solr</a>");
});



// Proxy
app.use('/solr', proxy('https://ss251856-us-east-1-aws.measuredsearch.com', {
  proxyReqPathResolver: function(req) {
    return new Promise(function (resolve, reject) {
        var parts = req.url.split('?');
        var queryString = parts[1];
	if(queryString) { queryString += "&" }
        queryString += "wt=json";
        var updatedPath = '/solr' + parts[0];
        var resolvedPathValue = updatedPath + (queryString ? '?' + queryString : '');
	console.log("Resolving with " + resolvedPathValue );
        resolve(resolvedPathValue);
    });
  }
}));





app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
