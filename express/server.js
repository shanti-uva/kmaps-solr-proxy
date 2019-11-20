const express = require('express');
const proxy = require('express-http-proxy');
const axios = require('axios');

// Session
const session = require('express-session');
const redis = require('redis');
const redisClient = redis.createClient();

// Redis
const redisStore = require('connect-redis')(session);
const REDIS_PORT = 6379;
const REDIS_TTL = 86400;

// Constants
const PORT = 3000;

// App
const app = express();

// OAuth configs
const OAuth_clientID = "test";
const OAuth_clientSecret = "12345";

// Plainjane static pages
app.use(express.static('public'))
app.get('/', function (req, res) {
    res.sendFile("index.html");
});

// OAuth Redirect Route
app.get('/oauth2/redirect', (req, res, next) => {
    const requestToken = req.query.code
    axios({
        method: 'post',
        url: `https://mandala-dev.shanti.virginia.edu/oauth2/token`,
        data: {
            "grant_type": "client_credentials",
            "client_id": OAuth_clientID,
            "client_secret": OAuth_clientSecret,
            "code": requestToken
        },
        headers: {
            accept: 'application/json'
        }
    }).then((response) => {
        // console.log("We got a response!");
        // console.log(response.data);
        const token_json = JSON.stringify(response.data, undefined, 2);
        req.session["access_token"] = token_json;
        res.redirect(`/process`);
    }).catch(error => {
        console.log(error);
        next(error);
    });
})


// Should be authorized now
//

app.get("/process", (req, res, next) => {
    // We should have authorization token now
    const access = req.session["access_token"];  // should be done through session instead of parameter
    res.send("Hey we got authorization: <pre>" + access + "</pre>" +
        "<p>Your Session looks like: " +
        "<pre>" + JSON.stringify(req.session,undefined,2) + "</pre>" );
});

// Proxy
app.use('/solr', proxy('https://ss251856-us-east-1-aws.measuredsearch.com', {  // TODO: configurable base path


    proxyReqPathResolver: function (req) {
        return new Promise(function (resolve, reject) {

            var parts = req.url.split('?');
            var queryString = (parts[1] !== undefined && parts[1] !== 'undefined') ? parts[1] : "";
            if (queryString) {
                queryString += "&"
            }
            queryString += "wt=json";
            var updatedPath = '/solr' + parts[0];
            var resolvedPathValue = updatedPath + (queryString ? '?' + queryString : '');
            console.log("Resolving with " + resolvedPathValue);
            resolve(resolvedPathValue);


        });
    }
}));


// Wire up Redis sessionStore
app.use(
    session({
        secret: 'redissessionsecretshush',
        name: 'solrProxyApp',
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false},
        store: new redisStore({
            host: 'redis-cache',
            port: REDIS_PORT,
            client: redisClient,
            ttl: REDIS_TTL
        })
    }));


app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
