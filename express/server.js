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
const redisClient = redis.createClient({url: process.env.REDIS_URL, password: REDIS_PASS});
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
app.get('/oauth2/redirect', async (req, res, next) => {

    console.log("==================================");
    console.dir(req);
    console.log("==================================");
    const requestToken = req.query.code
    const CSRF_TOKEN_URL = process.env.MANDALA_URL + "/services/session/token";
    const OAUTH2_TOKEN_URL = process.env.MANDALA_URL + "/oauth2/token";

    let client = axios.create(
        {withCredentials: true}
    );

    let csrf = "";
    try {
        let resp = await client.get(CSRF_TOKEN_URL);
        csrf = resp.data;
        console.log("got CSRF = " + csrf);
        req.session["csrf_token"] = csrf;
    } catch (err) {
        const errorMsg = "Couldn't get CSRF token from " + CSRF_TOKEN_URL + " Error: " + err;
        console.error(errorMsg, err);
        next(err);
        return;
    }

    try {
        console.log("BEFORE THE POST");
        let response = await client.post(OAUTH2_TOKEN_URL,
            {
                // "grant_type": "client_credentials",
                "grant_type": "authorization_code",
                "client_id": OAuth_clientID,
                "client_secret": OAuth_clientSecret,
                "scope": "openid profile email basic",
                "code": requestToken
            },
            {
                headers: {
                    "accept": 'application/json',
                    "x-csrf-token": csrf
                }
            }
        )
        console.log("AFTER THE POST");
        let token_json = response.data;
        console.log("GOT token = " + token_json);
        console.dir(token_json);
        req.session["access_token"] = token_json;
        res.redirect(`/process`);

    } catch (err) {
        const errorMsg = "Couldn't get OAuth2 token from " + OAUTH2_TOKEN_URL + " Error: " + err;
        console.error(errorMsg, err);
        res.send("ERROR: " + errorMsg);
        next(err);
        return;
    }
})

// Login path.  Initiates the OAuth ping pong match...
app.get("/login", (req, res, next) => {
    res.redirect(process.env.MANDALA_URL + "/oauth2/authorize?client_id=test&response_type=code&state=guidothekillerpimp&scope=openid+profile+email+basic");
});

// Should be authorized now
app.get("/process", (req, res, next) => {
    // We should have authorization token now

    let access = req.session["access_token"].access_token;
    let xcsrf = req.session["csrf_token"];

    axios({
        method: 'get',
        // url: process.env.MANDALA_URL + "/oauthtest/usertest",
        url: process.env.MANDALA_URL + "/oauth2/UserInfo",
        headers: {
            accept: 'application/json',
            Authorization: "Bearer " + access,
            "X-CSRF-Token": xcsrf
        }
    }).then((response) => {
        // console.log("We got a response!");
        // console.log(response.data);
        const data = response.data;
        res.send("We got a response!<p>\n" +
            "<pre>" + JSON.stringify(data, undefined, 2) + "</pre>\n" +
            "<h2>TOKENS</h2>" +
            "<ul>" +
            "<li>access_token: " + JSON.stringify(req.session["access_token"]) + "</li>" +
            "<li>csrf_token: " + req.session["csrf_token"] + "</li>" +
            "</ul>");
    }).catch(error => {
        console.log(error);
        next(error);
    });

    console.log("PROCESSED: session:");
    console.dir(req.session);
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
console.log("express is listening on port " + PORT);

