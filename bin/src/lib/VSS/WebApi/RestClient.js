var _ = require("lodash");
var program = require("commander");
var Q = require("q");
var Querystring = require("querystring");
var request = require("request");
var Serialization = require("../Serialization");
var VssHttpClient = (function () {
    function VssHttpClient(rootRequestPath) {
        this.rootRequestPath = rootRequestPath;
        this._locationsByAreaPromises = {};
    }
    VssHttpClient.getClient = function (type, baseUrl, authToken) {
        var client = new type(baseUrl);
        if (authToken) {
            client.auth = {
                user: authToken,
                pass: "",
                sendImmediately: true
            };
        }
        return client;
    };
    VssHttpClient.prototype._beginRequest = function (requestParams, useAjaxResult) {
        var _this = this;
        if (useAjaxResult === void 0) { useAjaxResult = false; }
        var deferred = Q.defer();
        if (_.isObject(requestParams.queryParams)) {
            requestParams.queryParams = _.omit(requestParams.queryParams, function (key) { return requestParams.queryParams[key] === undefined; });
        }
        if (requestParams.routeTemplate) {
            var requestUrl = this.getRequestUrl(requestParams.routeTemplate, requestParams.area, requestParams.resource, requestParams.routeValues, requestParams.queryParams);
            this._beginRequestToResolvedUrl(requestUrl, requestParams.apiVersion, requestParams, deferred, useAjaxResult);
        }
        else {
            this._beginGetLocation(requestParams.area, requestParams.locationId).then(function (location) {
                var requestUrl = _this.getRequestUrl(location.routeTemplate, location.area, location.resourceName, requestParams.routeValues, requestParams.queryParams);
                var apiVersion = requestParams.apiVersion;
                if (!apiVersion) {
                    apiVersion = location.maxVersion + "-preview." + location.resourceVersion;
                }
                _this._beginRequestToResolvedUrl(requestUrl, apiVersion, requestParams, deferred, useAjaxResult);
            });
        }
        return deferred.promise;
    };
    VssHttpClient.prototype._beginRequestToResolvedUrl = function (requestUrl, apiVersion, requestParams, deferred, useAjaxResult) {
        var requestOptions = {
            url: requestUrl,
            auth: this.auth
        };
        if (program["fiddler"]) {
            requestOptions.proxy = "http://127.0.0.1:8888";
        }
        var acceptType;
        requestOptions.method = requestParams.httpMethod || "GET";
        var requestData = requestParams.data;
        if (!requestParams.isRawData && requestData && requestParams.requestType) {
            requestData = Serialization.ContractSerializer.serialize(requestData, requestParams.requestType, true);
        }
        if (!requestParams.httpResponseType || requestParams.httpResponseType.toLowerCase() === "json") {
            acceptType = "application/json";
        }
        else {
            acceptType = "*/*";
        }
        requestOptions.headers = _.assign({
            "Accept": acceptType + (apiVersion ? (";api-version=" + apiVersion) : ""),
            "Content-Type": "application/json"
        }, requestParams.customHeaders);
        requestOptions["json"] = requestData;
        var promise = this._issueRequest(requestOptions);
        promise.spread(function (response, body) {
            var resolvedData = Serialization.ContractSerializer.deserialize(body, requestParams.responseType, false, requestParams.responseIsCollection);
            deferred.resolve(resolvedData);
        }, deferred.reject);
    };
    VssHttpClient.prototype._beginRequestWithAjaxResult = function (requestParams) {
        return this._beginRequest(requestParams, true);
    };
    VssHttpClient.prototype._issueRequest = function (requestOptions) {
        return Q.Promise(function (resolve, reject, notify) {
            request(requestOptions, function (error, response, body) {
                if (error) {
                    reject(error);
                }
                if (Math.floor(response.statusCode / 100) !== 2) {
                    reject(response);
                }
                else {
                    resolve([response, body]);
                }
            });
        });
    };
    VssHttpClient.prototype._beginGetLocation = function (area, locationId) {
        return this.beginGetAreaLocations(area).then(function (areaLocations) {
            var location = areaLocations[(locationId || "").toLowerCase()];
            if (!location) {
                throw new Error("Failed to find api location for area: " + area + " id: " + locationId);
            }
            return location;
        });
    };
    VssHttpClient.prototype.beginGetAreaLocations = function (area) {
        var areaLocationsPromise = this._locationsByAreaPromises[area];
        if (!areaLocationsPromise) {
            var deferred = Q.defer();
            areaLocationsPromise = deferred.promise;
            var requestUrl = this.rootRequestPath + VssHttpClient.APIS_RELATIVE_PATH + "/" + area;
            this._issueRequest({ uri: requestUrl, type: "OPTIONS" }).spread(function (response, body) {
                var locationsResult = JSON.parse(body);
                var locationsLookup = {};
                locationsResult.value.forEach(function (index, location) {
                    locationsLookup[location.id.toLowerCase()] = location;
                });
                deferred.resolve(locationsLookup);
            }, deferred.reject);
            this._locationsByAreaPromises[area] = areaLocationsPromise;
        }
        return areaLocationsPromise;
    };
    VssHttpClient.prototype.getRequestUrl = function (routeTemplate, area, resource, routeValues, queryParams) {
        routeValues = routeValues || {};
        if (!routeValues.area) {
            routeValues.area = area;
        }
        if (!routeValues.resource) {
            routeValues.resource = resource;
        }
        var url = this.rootRequestPath + this.replaceRouteValues(routeTemplate, routeValues);
        if (queryParams) {
            var urlHasQueryParams = url.indexOf("?") !== -1;
            var queryString = Querystring.stringify(_.assign({}, queryParams));
            if (queryString) {
                url += (urlHasQueryParams ? "&" : "?") + queryString;
            }
        }
        return url;
    };
    VssHttpClient.prototype.replaceRouteValues = function (routeTemplate, routeValues) {
        var result = "", currentPathPart = "", paramName = "", insideParam = false, charIndex, routeTemplateLength = routeTemplate.length, c;
        for (charIndex = 0; charIndex < routeTemplateLength; charIndex++) {
            c = routeTemplate[charIndex];
            if (insideParam) {
                if (c == "}") {
                    insideParam = false;
                    if (routeValues[paramName]) {
                        currentPathPart += encodeURIComponent(routeValues[paramName]);
                    }
                    else {
                        var strippedParamName = paramName.replace(/[^a-z0-9]/ig, '');
                        if (routeValues[strippedParamName]) {
                            currentPathPart += encodeURIComponent(routeValues[strippedParamName]);
                        }
                    }
                    paramName = "";
                }
                else {
                    paramName += c;
                }
            }
            else {
                if (c == "/") {
                    if (currentPathPart) {
                        if (result) {
                            result += "/";
                        }
                        result += currentPathPart;
                        currentPathPart = "";
                    }
                }
                else if (c == "{") {
                    if ((charIndex + 1) < routeTemplateLength && routeTemplate[charIndex + 1] == "{") {
                        currentPathPart += c;
                        charIndex++;
                    }
                    else {
                        insideParam = true;
                    }
                }
                else if (c == '}') {
                    currentPathPart += c;
                    if ((charIndex + 1) < routeTemplateLength && routeTemplate[charIndex + 1] == "}") {
                        charIndex++;
                    }
                }
                else {
                    currentPathPart += c;
                }
            }
        }
        if (currentPathPart) {
            if (result) {
                result += "/";
            }
            result += currentPathPart;
        }
        return result;
    };
    VssHttpClient.prototype._getLinkResponseHeaders = function (xhr) {
        var results = {}, responseHeadersString = xhr.getAllResponseHeaders(), rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, linkRegExp = /\<(.*?)\>;rel=\"(.*?)\"/g, headerMatch, linkMatch;
        if (responseHeadersString) {
            while (headerMatch = rheaders.exec(responseHeadersString)) {
                if (headerMatch[1].toLowerCase() === 'link') {
                    while (linkMatch = linkRegExp.exec(headerMatch[2])) {
                        results[linkMatch[2]] = linkMatch[1];
                    }
                }
            }
        }
        return results;
    };
    VssHttpClient.APIS_RELATIVE_PATH = "_apis";
    VssHttpClient.DEFAULT_REQUEST_TIMEOUT = 300000;
    return VssHttpClient;
})();
exports.VssHttpClient = VssHttpClient;
