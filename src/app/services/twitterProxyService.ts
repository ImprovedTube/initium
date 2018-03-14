export class TwitterProxyService {
    requestToken: string = "";
    requestTokenSecret: string = "";
    proxyUrl: string = process.env.PROXY_URL;
    oauth: any = JSON.parse(localStorage.getItem("oauth")) || {};

    isLoggedIn() {
        return this.oauth.token && this.oauth.tokenSecret;
    }

    getLoginUrl(retry = true) {
        return fetch(`${this.proxyUrl}/request_token`)
            .then(response => response.json())
            .then(json => {
                if (json.statusCode === 200) {
                    this.requestToken = json.data.token;
                    this.requestTokenSecret = json.data.tokenSecret;

                    return {
                        statusCode: json.statusCode,
                        url: json.data.url
                    };
                }
                return json;
            })
            .catch(error => {
                console.log(error);

                if (retry) {
                    return this.getLoginUrl(false);
                }
            });
    }

    getAccessToken(pinCode, retry = true) {
        return fetch(`${this.proxyUrl}/access_token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                pinCode,
                token: this.requestToken,
                tokenSecret: this.requestTokenSecret
            })
        })
        .then(response => response.json())
        .then(json => {
            if (json.statusCode === 200) {
                this.oauth = json.data;
                localStorage.setItem("oauth", JSON.stringify(json.data));

                return {
                    statusCode: json.statusCode
                };
            }
            return json;
        })
        .catch(error => {
            console.log(error);

            if (retry) {
                return this.getAccessToken(pinCode, false);
            }
        });

    }

    getUser(retry = true) {
        return fetch(`${this.proxyUrl}/user`, {
            method: "GET",
            headers: this.getAuthorizationHeaders()
        })
        .then(response => response.json())
        .catch(error => {
            console.log(error);

            if (retry) {
                return this.getUser(false);
            }
        });
    }

    getTimeline(params = {}, retry = true) {
        return fetch(`${this.proxyUrl}/timeline${this.buildParams(params)}`, {
            method: "GET",
            headers: this.getAuthorizationHeaders()
        })
        .then(response => response.json())
        .catch(error => {
            console.log(error);

            if (retry) {
                return this.getTimeline(params, false);
            }
        });
    }

    getAuthorizationHeaders() {
        return {
            "x-authorization": `OAuth oauth_token=${this.oauth.token} oauth_token_secret=${this.oauth.tokenSecret}`
        };
    }

    buildParams(params) {
        const arr = Object.keys(params);

        if (!arr.length) {
            return "";
        }
        return "?" + arr.map(param => `${param}=${params[param]}`).join("&");
    }
}