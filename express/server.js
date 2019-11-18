const express = require('express');
const proxy = require('express-http-proxy');
const axios = require('axios');

// Constants
const PORT = 3000;

// App
const app = express();
const clientID = "test";
const clientSecret = "12345";

// Plainjane static pages
app.use(express.static('public'))
app.get('/', function (req, res) {
   res.sendFile("index.html");
});

// OAuth Redirect Route
app.get('/oauth2/redirect', (req, res) => {
    const requestToken = req.query.code
    axios({
        method: 'post',
        url: `https://mandala.dd:8443/oauth2/token?client_id=${clientID}&client_secret=${clientSecret}&code=${requestToken}`,
        headers: {
            accept: 'application/json'
        }
    }).then((response) => {
        const accessToken = response.data.access_token
        res.redirect(`/welcome.html?access_token=${accessToken}`)
    }).catch(error => {
        console.log(error)
    })
})


// Proxy
app.use('/solr', proxy('https://ss251856-us-east-1-aws.measuredsearch.com', {  // TODO: configurable base path


    proxyReqPathResolver: function(req) {
        return new Promise(function (resolve, reject) {

            var parts = req.url.split('?');
            var queryString = (parts[1] !== undefined && parts[1] !== 'undefined')?parts[1]:"";
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
