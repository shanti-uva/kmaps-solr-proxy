// TODO: Collect the data and record it in Solr or in Redis
// We'll need to handle:
//  Asynchronous refreshes of this data
//  Some sense of the freshness of this data
//  How will we know when the data has been updated?
//  Use of refresh token
// What will the solr proxy need to know to filter the solr query?
// How much data should be in solr / just in redis / session
// How do we handle non-logged-in cases?
// how will we know the differences?
// how ill know if that status changes?
// use redis? for asynchronous notification?

const express = require('express');
const proxy = require('express-http-proxy');
const axios = require('axios');
const async = require('async');

const DEBUG = true;

// Session
const session = require('express-session');


// Redis

const REDIS_PORT = (process.env && process.env.REDIS_PASS) ? process.env.REDIS_PORT : 6379;
const REDIS_TTL = (process.env && process.env.REDIS_PASS) ? process.env.REDIS_TTL : 86400;
const REDIS_PASS = (process.env && process.env.REDIS_PASS) ? process.env.REDIS_PASS : "W67lPiuZtb6V";
const REDIS_URL = (process.env && process.env.REDIS_URL) ? process.env.REDIS_URL : "redis://localhost"

const redis = require('redis');
// const redisClient = redis.createClient({url: REDIS_URL, password: REDIS_PASS});
const redisStore = require('connect-redis')(session);

// Constants
const EXPRESS_PORT = (process.env && process.env.EXPRESS_PORT) ? process.env.EXPRESS_PORT : 3000;

// Express App
const app = express();

// Session settings
//
const SESSION_SECRET = (process.env && process.env.SESSION_SECRET) ? process.env.SESSION_SECRET : 'redissessionsecretshush';
const SESSION_COOKIE = (process.env && process.env.SESSION_COOKIE) ? process.env.SESSION_COOKIE : 'solrProxySession';

// OAuth client configs 
// We'll use the same client id and client secret for all OAuth servers/providers
const OAUTH_CLIENTID = (process.env && process.env.OAUTH_CLIENTID) ? process.env.OAUTH_CLIENTID : "test";
const OAUTH_CLIENTSECRET = (process.env && process.env.OAUTH_CLIENTSECRET) ? process.env.OAUTH_CLIENTSECRET : "12345";

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

// Wire up sessionStore
// Don't use redis because of race condition problems!
app.use(
    session({
        secret: SESSION_SECRET,
        name: SESSION_COOKIE,
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false},
        // store: new redisStore({
        // host: REDIS_URL,
        // port: REDIS_PORT,
        // password: REDIS_PASS,
        // client: redisClient,
        // ttl: REDIS_TTL
        //})
    }));

// Default Static Route
app.get('/', function (req, res) {
    res.sendFile("index.html");
});

// OAuth Redirect Route - OAuth Server Authorize request should redirect here.
app.get('/oauth2/redirect', async (req, res, next) => {

    const DEBUG = false; // local scope DEBUG
    if (DEBUG) {
        console.log("==================================");
        console.dir(req.query);
        console.log("==================================");
    }
    const requestToken = req.query.code
    const state = JSON.parse(req.query.state);

    let debug_request = state.debug;

    // format = "json" or "html" currently.  Defaults to html.
    let format = state.format || "html";
    if (DEBUG) console.log("We got state = " + JSON.stringify(state, undefined, 2));

    // initialize csrf_token, access_token, memberships
    // NB: this is threadsafe for the default in-memory session, but not for a redis-based session (experience shows).
    if (!req.session.csrf_token) {
        if (DEBUG) console.log("init csrf_token: " + JSON.stringify(state));
        req.session.csrf_token = {};
        req.session.save();
    }
    if (!req.session.access_token) {
        if (DEBUG) console.log("init access_token: " + JSON.stringify(state));
        req.session.access_token = {};
        req.session.save();
    }
    if (!req.session.memberships) {
        if (DEBUG) console.log("init membership: " + JSON.stringify(state));
        req.session.memberships = {};
        req.session.save();
    }

    const mgr = state.asset_manager || "unknown";
    const mgr_cfg = MANAGER_CONFIGS[mgr];

    if (DEBUG) {
        console.log("USING mgr = " + mgr);
        console.log("USING mgr_cfg = " + JSON.stringify(mgr_cfg, undefined, 2));
    }

    let client = axios.create(
        {withCredentials: true}
    );

    let csrf = "x";
    try {
        let resp = await client.get(mgr_cfg.CSRF_URL);
        console.log("getting csrf");
        csrf = resp.data;
        console.log("got CSRF for " + mgr + " = " + csrf);
        await req.session.reload(() => {
            req.session["csrf_token"][mgr] = csrf;
            req.session.save();
        });
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
                "x-csrf-token": csrf
            }
        };
    try {
        // console.log("BEFORE THE POST " + mgr);
        let response = await client.post(mgr_cfg.OAUTH_TOKEN_URL,
            request_data,
            request_config
        )
        // console.log("AFTER THE POST " + mgr);
        let token_json = response.data;
        console.log("GOT OAuth token from server (" + mgr_cfg.OAUTH_TOKEN_URL + ") = " + token_json);
        console.dir(token_json);

        // update access_token in session.  Do the reload dance to make sure the session is current.
        // Race conditions do not seem to be a problem for the in-memory session
        // However, the redis-based one showed race conditions.
        //
        req.session.reload(() => {
            req.session["access_token"][mgr] = token_json;
            req.session.save();
        });

        let statejson = encodeURI(JSON.stringify(state));
        // let's post-process.  All data should be in the session now.
        res.redirect('/process?format=' + format + '&asset_mgr=' + mgr + '&state=' + statejson + ((debug_request) ? "&debug=true" : ""));

    } catch (err) {
        console.log("ERROR retrieving OAuth token: " + err);
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
    let debug_request = false;
    if (req.query.debug) {
        debug_request = true;
    }
    let format = req.query.format || "html";

    if (mgr === "autologin") {
        req.session.debug = debug_request;
        res.sendFile(__dirname + "/public/autologin.html");
    } else {
        const mgr_cfg = MANAGER_CONFIGS[mgr];
        let error = req.query.error || "";
        let state = {
            asset_manager: mgr,
            previous_error: error,
            debug: debug_request,
            format: format
        }
        // TODO: maybe we should hex-encode this?
        // TODO: These params should be configurable!
        let statejson = encodeURI(JSON.stringify(state));
        let client_id = mgr_cfg.OAUTH_CLIENTID;
        let scope = mgr_cfg.OAUTH_SCOPE.replace(/\s/, "+");
        res.redirect(mgr_cfg.OAUTH_AUTHORIZE_URL + "?client_id=" + client_id + "&response_type=code&state=" + statejson + "&scope=" + scope);
    }
});

function postProcess(req, res, newdata) {
    const state = JSON.parse(req.query.state);
    let debug_request = state.debug;
    let format = state.format || "html";
    const mgr = state.asset_manager || "unknown";
    const mgr_cfg = MANAGER_CONFIGS[mgr];

    // POST PROCESSING //
    // reload then save the session (in case another request has updated the session)
    req.session.reload(() => {
        req.session.memberships[mgr] = newdata;
        req.session.save(() => {
            // Check whether all memberships are available...
            if (DEBUG) {
                console.log("++++++++++++++++++++++++++++++");
                console.dir(req.session.memberships);
                console.log("++++++++++++++++++++++++++++++");
            }
            // memberships, access_tokens should match and should number 5.

            if (Object.keys(req.session.memberships).length === 5) {
                console.log("WE GOT ALL 5 MEMBERSHIPS: " + JSON.stringify(req.session.memberships, undefined, 2));
                // write the acl's to the session
                let acl = [];
                Object.keys(req.session.memberships).forEach((service) => {
                    console.log("SERVICE: " + service);
                    req.session.memberships[service].forEach((membership) => {
                        let memb = membership.guid + ":" + membership.access;
                        console.log("MEMBERSHIP: " + memb);
                        acl.push(memb);
                    });
                });
                console.log("Got " + acl.length + " memberships");
                // console.dir(acl);
                req.session.acl = acl;
                req.session.save();
            }
            if (format === "html") {
                var debugBody = "";
                if (debug_request) {
                    debugBody = "We got a response from " + mgr + " (" + mgr_cfg.BASE_URL + ")!<p>\n" +
                        "<h2>Processed</h2><pre>" + JSON.stringify(newdata, undefined, 2) + "</pre>\n" +
                        "<h2>TOKENS</h2>" +
                        "<ul>" +
                        "<li>access_token: <pre>" + JSON.stringify(req.session["access_token"], undefined, 2) + "</pre></li>" +
                        "<li>csrf_token: <pre>" + JSON.stringify(req.session["csrf_token"], undefined, 2) + "</pre></li>" +
                        "<li>debug request = " + debug_request + "</li>" +
                        "</ul>";
                }
                res.send("<html><header><title>loaded:" + mgr + "</title>" +
                    "<link href='process.css' rel='stylesheet' type='text/css'>" +
                    "</header><body class='success'>" +
                    debugBody +
                    "<pre>" +
                    JSON.stringify(req.session.memberships, undefined, 2) +
                    "</pre>" +
                    "</body></html>"
                );
            } else if (format === "json") {
                res.setHeader("Content-Type", 'application/json');
                res.send(JSON.stringify(req.session.memberships, undefined, 2));
            }
        });
    });
}

function process(req, res, state, mgr_cfg, access_token) {
    // DATA COLLECTION
    let debug_request = state.debug;
    let format = state.format || "html";
    const mgr = state.asset_manager || "unknown";

    axios({
        method: 'get',
        url: mgr_cfg.BASE_URL + "/ogauth/ogusergroups",
        headers: {
            accept: 'application/json',
            Authorization: "Bearer " + access_token,
        }
    }).then((response) => {
        const data = response.data;
        let newdata = [];
        for (let i = 0; i < data.length; i++) {
            let guid = mgr + "-" + data[i].gid;
            let access = "";
            switch (Number(data[i].group_access)) {
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
            newdata.push({
                "guid": guid,
                "title": data[i].title,
                "access": access
            });
        }
        postProcess(req, res, newdata);

    }).catch(error => {
        if (error.response) {
            console.log("Error status code = " + error.response.status);
            if (error.response.status === 401) {
                if (error.response.data && error.response.data.error === "invalid_token") {
                    console.log("The token is invalid.  Probably expired.");
                    // TODO:  what do we do about the expired/invalid token?
                }
            }
        }
        console.error("Error during processing " + mgr + " callback");
        console.error("===== BEGIN ENDPOINT CALL ERROR =====");
        console.error(error);
        console.error("===== END ENDPOINT CALL ERROR =====");
        if (format === "html") {
            res.send("<html>" +
                "<header><title>error:" + mgr + "</title>" +
                "<link href='process.css' rel='stylesheet' type='text/css'>" +
                "</header><body class='error'>" +
                "We got an error!<p>\n" +
                "<pre>" + error + " </pre>\n" +
                "<p><a href=\"/login?asset_manager=" + mgr + "\">LOGIN AGAIN</a></p>" +
                "<h2>RESPONSE DATA</H2>" +
                // "<pre>" + (error.response)?JSON.stringify(error.response.data, undefined, 2):"No response" + "</pre>" +
                "<h2>TOKENS</h2>" +
                "<ul>" +
                "<li>access_token: <pre>" + JSON.stringify(req.session["access_token"], undefined, 2) + "</pre></li>" +
                "<li>csrf_token: <pre>" + JSON.stringify(req.session["csrf_token"], undefined, 2) + "</pre></li>" +
                "<li>debug request = " + debug_request + "</li>" +
                "</ul></body></html>"
            );
        } else if (format === "json") {
            res.setHeader("Content-Type", 'application/json');
            res.send("{   \"error\":  \"" + error + "\" }");
        }
    });
}

// Should be authorized now
app.get("/process", (req, res, next) => {

    // Check the session
    const state = (req.query.state)?JSON.parse(req.query.state):{};
    const mgr = req.query.asset_mgr || "unknown";
    const format = req.query.format || "html";
    const mgr_cfg = MANAGER_CONFIGS[mgr];
    let debug_request = false;
    if (req.session.debug === "true") {
        debug_request = true;
        delete req.session.debug_request;
    }

    // no access_token, so try to login
    // TODO: if in json mode: just return error. Or skip.
    var access_token = req.session["access_token"][mgr];
    if (format === "html" && (!req.session["access_token"] || !access_token)) {
        console.log("Missing access_token. mgr = " + mgr + ". Redirecting to /login");
        console.dir(req.session.access_token);

        // prevent error loop?
        if (req.query.error === "no_access_token") {
            const errmsg = "Couldn't obtain an access token!";
            console.error(errmsg);
            next(errmsg);
        }

        res.redirect("/login?asset_manager=" + mgr + "&error=no_access_token" + (debug_request) ? "&debug=true" : "");
        return;
    }

    // TODO: allow this to check multiple services in one call.  This will make json mode more efficient and useful.

    // We should have authorization token now
    console.log("session.access_token=" + JSON.stringify(req.session["access_token"]));

    process(req, res, state, mgr_cfg, access_token);

    console.log("PROCESSED: session");
    // console.dir(req.session);
});

app.get("/status\.?(json|html)?", (req, res, next) => {
    let mode = req.params[0] || "html";
    let status = req.session;
    if (mode == "json") {
        res.setHeader("Content-Type", 'application/json');
        res.send(JSON.stringify(status, undefined, 2));
    } else if (mode == "html") {
        res.setHeader("Content-Type", 'text/html');
        res.send("<html><head><title>Status</title></head><body>" +
            "<div>Try <a href='status.json'>JSON</a> mode</div>" +
            "<pre>" +
            JSON.stringify(status, undefined, 2) +
            "</pre></body></html>");
    }
});

app.get("/acl\.?(json|html)?", (req, res, next) => {
    let mode = req.params[0] || "json";
    let acl = req.session.acl || [];
    if (mode == "json") {
        res.setHeader("Content-Type", 'application/json');
        res.send(JSON.stringify(acl, undefined, 2));
    } else if (mode == "html") {
        res.setHeader("Content-Type", 'text/html');
        res.send("<html><head><title>Status</title></head><body>" +
            "<div>Try <a href='status.json'>JSON</a> mode</div>" +
            "<pre>" +
            JSON.stringify(acl, undefined, 2) +
            "</pre></body></html>");
    }
});

// Solr Proxy Handler
app.use('/solr', proxy('https://ss251856-us-east-1-aws.measuredsearch.com', {  // TODO: configurable base path
    proxyReqPathResolver: function (req) {
        return new Promise(function (resolve, reject) {
            var resolvedPathValue = addFilterQueryParams(req);
            resolve(resolvedPathValue);
        });
    }
}));

// 404 handler at the bottom of the "use" stack
app.use(function (req, res, next) {
    res.status(404).send("Sorry can't find that!")
})

app.listen(EXPRESS_PORT);
console.log("express is listening on port " + EXPRESS_PORT);

function addFilterQueryParams(req) {

    var parts = req.url.split('?');
    var queryString = (parts[1] !== undefined && parts[1] !== 'undefined') ? parts[1] : "";
    if (queryString) {
        queryString += "&"
    }

    // currently just mock data
    queryString += "wt=json";  // just a testing example currently
    //

    // Build filter query from memberships

    var updatedPath = '/solr' + parts[0];
    var resolvedPathValue = updatedPath + (queryString ? '?' + queryString : '');
    console.log("Resolving with " + resolvedPathValue);
    return resolvedPathValue;
}
