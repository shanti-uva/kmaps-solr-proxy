const express = require('express');
const proxy = require('express-http-proxy');
const axios = require('axios');

// Session
const session = require('express-session');

// Redis
const REDIS_PORT = 6379;
const REDIS_TTL = 86400;
const REDIS_PASS = "W67lPiuZtb6V";
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL, password: REDIS_PASS });
const redisStore = require('connect-redis')(session);

// Constants
const PORT = 3000;

// App
const app = express();

// OAuth configs
const OAuth_clientID = "test";
const OAuth_clientSecret = "12345";

// Plainjane static pages
app.use(express.static('public'))

// Wire up Redis sessionStore
app.use(
    session({
        secret: 'redissessionsecretshush',
        name: 'solrProxySession',
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false},
        store: new redisStore({
            host: process.env.REDIS_URL,
            port: REDIS_PORT,
	    password: REDIS_PASS,
            client: redisClient,
            ttl: REDIS_TTL
        })
    }));

app.get('/', function (req, res) {
    res.sendFile("index.html");
});

// OAuth Redirect Route
app.get('/oauth2/redirect', (req, res, next) => {
    const requestToken = req.query.code
    axios({
        method: 'post',
        // url: `https://mandala-dev.shanti.virginia.edu/oauth2/token`,
        // url: "https://mandala.dd:8443/oauth2/token",
        url: process.env.MANDALA_URL + "/oauth2/token",
        data: {
            "grant_type": "client_credentials",
            "client_id": OAuth_clientID,
            "client_secret": OAuth_clientSecret,
	        "scope": "openid profile email basic",
            "code": requestToken
        },
        headers: {
            accept: 'application/json'
        }
    }).then((response) => {
        // console.log("We got a response!");
        // console.log(response.data);
        const token_json = response.data;

    	console.log( "Probably should do some validation / verification here!");
	    console.dir(token_json);
        req.session["access_token"] = token_json;
        res.redirect(`/process`);
    }).catch(error => {
        console.log(error);
        next(error);
    });
})

// Login path.  Initiates the OAuth ping pong match...
app.get("/login", (req, res, next) => {
	res.redirect(process.env.MANDALA_URL + "/oauth2/authorize?client_id=test");
});

// Should be authorized now
app.get("/process", (req, res, next) => {
    // We should have authorization token now
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
            queryString += "wt=json";
            var updatedPath = '/solr' + parts[0];
            var resolvedPathValue = updatedPath + (queryString ? '?' + queryString : '');
            console.log("Resolving with " + resolvedPathValue);
            resolve(resolvedPathValue);

        });
    }
}));



app.listen(PORT);
