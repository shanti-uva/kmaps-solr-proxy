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
// const OAuth_clientID = "z45bh4bk9wggJjRhdzJ2K2vKEJXKZwxe";
// const OAuth_clientSecret = "D2UZz6nbGi6ULtyBZyyeAxbKpvcpZY5u";

// Plainjane static pages
app.use(express.static('public'))

// Wire up Redis sessionStore
app.use(
    session({
        secret: 'redissessionsecretshush',
        name: 'solrProxySession',
        resave: false,
        saveUninitialized: true,
        cookie: {secure: true},
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
    const requestToken = req.query.code;
    const client = axios.create({
	withCredentials: true;
    });

    client.get('https://mandala-dev.shanti.virginia.edu/session/token').then(csrf) => {
    client.post('https://mandala-dev.shanti.virginia.edu/oauth2/token',
        {
            "grant_type": "client_credentials",
            "client_id": OAuth_clientID,
            "client_secret": OAuth_clientSecret,
	    "scope": "openid profile email basic",
            "code": requestToken
        },
        {    
            headers: {
                 accept: 'application/json'
            }
         }
    }).then((response) => {
        console.log("We got a response!");
        console.log(response);
        const token_json = response.data;

	console.log( "Probably should do some validation / verification here!");
        req.session["access_token"] = token_json;
	console.dir(req.session);

    const access = req.session["access_token"].access_token; 
    axios({
        method: 'get',
        url: `https://mandala-dev.shanti.virginia.edu/oauthtest/usertest`,
        headers: {
            accept: 'application/json',
	    Authorization: "Bearer " + access
	    "X-CSRF-Token": xcsrf
        }
    }).then((response) => {
        // console.log("We got a response!");
        // console.log(response.data);
        const data = response.data;
    	res.send( "We got a response!<p>\n" +
        "<pre>" + JSON.stringify(data,undefined,2) + "</pre>" );
    }).catch(error => {
        console.log(error);
        next(error);
    });

	
	res.end();
    }).catch(error => {
        console.log(error);
        next(error);
    });
});

// Login path.  Initiates the OAuth ping pong match...
app.get("/login", (req, res, next) => {
	res.redirect("https://mandala-dev.shanti.virginia.edu/oauth2/authorize?client_id=" + OAuth_clientID);
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
