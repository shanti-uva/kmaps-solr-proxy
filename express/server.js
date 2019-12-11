const express = require('express');
const proxy = require('express-http-proxy');
const axios = require('axios');

// Session
const session = require('express-session');

// Redis
const REDIS_PORT = (process.env.REDIS_PASS) ? process.env.REDIS_PORT : 6379;
const REDIS_TTL = (process.env.REDIS_PASS) ? process.env.REDIS_TTL : 86400;
const REDIS_PASS = (process.env.REDIS_PASS) ? process.env.REDIS_PASS : "W67lPiuZtb6V";
const REDIS_URL = process.env.REDIS_URL;

const redis = require('redis');
const redisClient = redis.createClient({url: REDIS_URL, password: REDIS_PASS});
const redisStore = require('connect-redis')(session);

// Constants
const EXPRESS_PORT = (process.env.EXPRESS_PORT) ? process.env.EXPRESS_PORT : 3000;

// Express App
const app = express();

// Session settings
//
const SESSION_SECRET = (process.env.SESSION_SECRET)?process.env.SESSION_SECRET:'redissessionsecretshush';
const SESSION_COOKIE = (process.env.SESSION_COOKIE)?process.env.SESSION_COOKIE:'solrProxySession';

// OAuth client configs 
// We'll use the same client id and client secret for all OAuth servers/providers
const OAUTH_CLIENTID = (process.env.OAUTH_CLIENTID) ? process.env.OAUTH_CLIENTID : "test";
const OAUTH_CLIENTSECRET = (process.env.OAUTH_CLIENTSECRET) ? process.env.OAUTH_CLIENTSECRET : "12345";

// Config Array
const DEFAULT_OAUTH_SCOPE = "openid profile email basic";
const AV_BASE = "https://audio-video-dev.shanti.virginia.edu";
const TEXTS_BASE = "https://texts-dev.shanti.virginia.edu";
const IMAGES_BASE = "https://images-dev.shanti.virginia.edu";
const VISUALS_BASE = "https://visuals-dev.shanti.virginia.edu";
const SOURCES_BASE = "https://sources-dev.shanti.virginia.edu";
const MANAGER_CONFIGS = {
    "audio-video": {
        BASE_URL: AV_BASE,
        CSRF_URL: AV_BASE + "/services/session/token",
        OAUTH_AUTHORIZE_URL: AV_BASE + "/oauth2/authorize",
        OAUTH_TOKEN_URL: AV_BASE + "/oauth2/token",
        OAUTH_SCOPE: DEFAULT_OAUTH_SCOPE,
        OAUTH_CLIENTID: OAUTH_CLIENTID,
        OAUTH_CLIENTSECRET: OAUTH_CLIENTSECRET
    },
    "texts": {
        BASE_URL: TEXTS_BASE,
        CSRF_URL: TEXTS_BASE + "/services/session/token",
        OAUTH_AUTHORIZE_URL: TEXTS_BASE + "/oauth2/authorize",
        OAUTH_TOKEN_URL: TEXTS_BASE + "/oauth2/token",
        OAUTH_SCOPE: DEFAULT_OAUTH_SCOPE,
        OAUTH_CLIENTID: OAUTH_CLIENTID,
        OAUTH_CLIENTSECRET: OAUTH_CLIENTSECRET
    },
    "images": {
        BASE_URL: IMAGES_BASE,
        CSRF_URL: IMAGES_BASE + "/services/session/token",
        OAUTH_AUTHORIZE_URL: IMAGES_BASE + "/oauth2/authorize",
        OAUTH_TOKEN_URL: IMAGES_BASE + "/oauth2/token",
        OAUTH_SCOPE: DEFAULT_OAUTH_SCOPE,
        OAUTH_CLIENTID: OAUTH_CLIENTID,
        OAUTH_CLIENTSECRET: OAUTH_CLIENTSECRET
    },
    "visuals": {
        BASE_URL: VISUALS_BASE,
        CSRF_URL: VISUALS_BASE + "/services/session/token",
        OAUTH_AUTHORIZE_URL: VISUALS_BASE + "/oauth2/authorize",
        OAUTH_TOKEN_URL: VISUALS_BASE + "/oauth2/token",
        OAUTH_SCOPE: DEFAULT_OAUTH_SCOPE,
        OAUTH_CLIENTID: OAUTH_CLIENTID,
        OAUTH_CLIENTSECRET: OAUTH_CLIENTSECRET
    },
    "sources": {
        BASE_URL: SOURCES_BASE,
        CSRF_URL: SOURCES_BASE + "/services/session/token",
        OAUTH_AUTHORIZE_URL: SOURCES_BASE + "/oauth2/authorize",
        OAUTH_TOKEN_URL: SOURCES_BASE + "/oauth2/token",
        OAUTH_SCOPE: DEFAULT_OAUTH_SCOPE,
        OAUTH_CLIENTID: OAUTH_CLIENTID,
        OAUTH_CLIENTSECRET: OAUTH_CLIENTSECRET
    }
}

// Plainjane static pages
app.use(express.static('public'))

// Wire up Redis sessionStore
app.use(
    session({
        secret: SESSION_SECRET,
        name: SESSION_COOKIE,
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false},
        store: new redisStore({
            host: REDIS_URL,
            port: REDIS_PORT,
            password: REDIS_PASS,
            client: redisClient,
            ttl: REDIS_TTL
        })
    }));

// Default Static Route
app.get('/', function (req, res) {
    res.sendFile("index.html");
});

// OAuth Redirect Route - OAuth Server Authorize request should redirect here.
app.get('/oauth2/redirect', async (req, res, next) => {
    console.log("==================================");
    console.dir(req.query);
    console.log("==================================");
    const requestToken = req.query.code
    const state = JSON.parse(req.query.state);
    console.log("We got state = " + JSON.stringify(state, undefined, 2));

    if (!req.session.csrf_token) {
        req.session.csrf_token = {};
    }
    if (!req.session.access_token) {
        req.session.access_token = {};
    }
    const mgr = state.asset_manager || "unknown";
    const mgr_cfg = MANAGER_CONFIGS[mgr];

    console.log("USING mgr = " + mgr);
    console.log("USING mgr_cfg = " + JSON.stringify(mgr_cfg, undefined, 2));


    let client = axios.create(
        {withCredentials: true}
    );

    let csrf = "";
    try {
        let resp = await client.get(mgr_cfg.CSRF_URL);
        csrf = resp.data;
        console.log("got CSRF for " + mgr + " = " + csrf);
        req.session["csrf_token"][mgr] = csrf;
    } catch (err) {
        const errorMsg = "Couldn't get CSRF token from " + mgr_cfg.CSRF_URL + " Error: " + err;
        console.error(errorMsg, err);
        next(err);
        return;
    }

    let request_data =
        {
            // "grant_type": "client_credentials",
            "grant_type": "authorization_code",
            "client_id": mgr_cfg.OAUTH_CLIENTID,
            "client_secret": mgr_cfg.OAUTH_CLIENTSECRET,
            "scope": mgr_cfg.OAUTH_SCOPE,
            "code": requestToken
        };
    let request_config =
        {
            headers: {
                "accept": 'application/json',
                "x-csrf-token": req.session["csrf_token"][mgr]
            }
        };
    try {
        console.log("BEFORE THE POST");
        let response = await client.post(mgr_cfg.OAUTH_TOKEN_URL,
            request_data,
            request_config
        )
        console.log("AFTER THE POST");
        let token_json = response.data;
        console.log("GOT token = " + token_json);
        console.dir(token_json);
        req.session["access_token"][mgr] = token_json;
        res.redirect('/process?asset_mgr=' + mgr);

    } catch (err) {
        let debug = JSON.stringify(err.response.data, undefined, 2) + "\n" + JSON.stringify(request_data, undefined, 2) + "\n" + JSON.stringify(request_config, undefined, 2);
        const errorMsg = "Couldn't get OAuth2 token from " + mgr_cfg.OAUTH_TOKEN_URL + " Error: " + err.message;
        console.error(errorMsg);
        console.error("ERROR DATA: " + debug);
        res.send("ERROR: " + errorMsg + "<p><pre>" + debug + "</pre>");
        // next(err);
        return;
    }
})

// Login path.  Initiates the OAuth ping pong match...
app.get("/login", (req, res, next) => {
    // TODO: need validation of request parameter
    let mgr = req.query.asset_manager || "autologin";


    if (mgr === "autologin") {
    	res.sendFile(__dirname + "/public/autologin.html");
    } else {
    	const mgr_cfg = MANAGER_CONFIGS[mgr];
   	let error = req.query.error || "";
    	let state = {
   	   asset_manager: mgr,
   	   previous_error: error
  	}
        // TODO: maybe we should hex-encode this?
        // TODO: These params should be configurable!
        let statejson = encodeURI(JSON.stringify(state));
	let client_id = mgr_cfg.OAUTH_CLIENTID;
	let scope = mgr_cfg.OAUTH_SCOPE.replace(/\s/,"+");
        res.redirect(mgr_cfg.OAUTH_AUTHORIZE_URL + "?client_id=" + client_id + "&response_type=code&state=" + statejson + "&scope=" + scope);
    }
});

// Should be authorized now
app.get("/process", (req, res, next) => {
    // Check the session
    const mgr = req.query.asset_mgr || "unknown";
    const mgr_cfg = MANAGER_CONFIGS[mgr];

    if (!req.session["access_token"] || !req.session["access_token"][mgr]) {
        console.log("Missing access_token. mgr = " + mgr + ". Redirecting to /login");
        console.dir(req.session.access_token);

        // prevent error loop?

        if (req.query.error === "no_access_token") {
            const errmsg = "Couldn't obtain an access token!";
            console.error(errmsg);
            next(errmsg);
        }

        res.redirect("/login?asset_manager=" + mgr + "&error=no_access_token");
        return;
    }

    // We should have authorization token now
    console.log("session.access_token=" + JSON.stringify(req.session["access_token"]));
    let access = req.session["access_token"][mgr].access_token;
    let xcsrf = req.session["csrf_token"][mgr];

    axios({
        method: 'get',
        //url: process.env.MANDALA_URL + "/oauthtest/usertest",
        // url: process.env.MANDALA_URL + "/oauth2/UserInfo",
        // url: process.env.MANDALA_URL + "/ogauth/ogmembership",
        // url: process.env.MANDALA_URL + "/ogauth/ogusergroups?callback=myFunction",
        url: mgr_cfg.BASE_URL + "/ogauth/ogusergroups",
        // url: "https://audio-video-dev.shanti.virginia.edu/oauth2/UserInfo",
        headers: {
            // accept: 'application/javascript',
            accept: 'application/json',
            Authorization: "Bearer " + access,
            "X-CSRF-Token": xcsrf
        }
    }).then((response) => {
        const data = response.data;

	// Update the cache with the response data.
	    // Should this get written to solr or redis?

	let newdata = [];
	for (let i=0; i < data.length; i++) {
		let guid = mgr + "-" + data[i].gid;
		let access = "";
		switch(Number(data[i].group_access)) {
			case 0:
				access = "public";
				break;
			case 1:
				access = "private";
				break;
			case 2:
				access = "uva";
				break;
		}
		newdata.push({ "guid": guid, "title": data[i].title, "access": access });
	
	
	
	}







        res.send("We got a response from " + mgr + " (" + mgr_cfg.BASE_URL + ")!<p>\n" +
            "<h2>Processed</h2><pre>" + JSON.stringify(newdata, undefined, 2) + "</pre>\n" +
            "<h2>Raw</h2><pre>" + JSON.stringify(data, undefined, 2) + "</pre>\n" +
            "<h2>TOKENS</h2>" +
            "<ul>" +
            "<li>access_token: <pre>" + JSON.stringify(req.session["access_token"], undefined, 2) + "</pre></li>" +
            "<li>csrf_token: <pre>" + JSON.stringify(req.session["csrf_token"], undefined, 2) + "</pre></li>" +
            "</ul>");
    }).catch(error => {
        if (error.response) {
            console.log("Error status code = " + error.response.status);
            if (error.response.status === 401) {
                if (error.response.data && error.response.data.error === "invalid_token") {
                    console.log("The token is invalid.  Probably expired.");
                }
            }

        }
        console.log("===== BEGIN ENDPOINT CALL ERROR =====");
        console.log(error.response);
        console.log("===== END ENDPOINT CALL ERROR =====");
        res.send("We got an error!<p>\n" +
            "<pre>" + error + " </pre>\n" +
            "<p><a href=\"/login\">LOGIN AGAIN</a></p>" +
            "<h2>RESPONSE DATA</H2>" +
            "<pre>" + JSON.stringify(error.response.data, undefined, 2) + "</pre>" +
            "<h2>TOKENS</h2>" +
            "<ul>" +
            "<li>access_token: " + JSON.stringify(req.session["access_token"]) + "</li>" +
            "<li>csrf_token: " + JSON.stringify(req.session["csrf_token"]) + "</li>" +
            "</ul>"
        );

    });

    console.log("PROCESSED: session");
    // console.dir(req.session);
});

// Solr Proxy
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

app.listen(EXPRESS_PORT);
console.log("express is listening on port " + EXPRESS_PORT);
