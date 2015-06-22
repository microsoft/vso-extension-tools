
import _ = require("lodash");
import http = require("http");
import Q = require("q");
import Querystring = require("querystring");
import request = require("request");
import Serialization = require("../Serialization");
import WebApi_Contracts = require("./Contracts");

/**
 * Metadata for deserializing an enum field on a contract/type
 */
interface ContractEnumMetadata {
    enumValues?: { [name: string]: number; };
}

/**
 * Metadata for deserializing a particular field on a contract/type
 */
interface ContractFieldMetadata {
    isArray?: boolean;
    isDate?: boolean;
    enumType?: ContractEnumMetadata;
    typeInfo?: ContractMetadata;

    isDictionary?: boolean;
    dictionaryKeyIsDate?: boolean;
    dictionaryValueIsDate?: boolean;
    dictionaryKeyEnumType?: ContractEnumMetadata;
    dictionaryValueEnumType?: ContractEnumMetadata;
    dictionaryValueTypeInfo?: ContractMetadata;
    dictionaryValueFieldInfo?: ContractFieldMetadata;
}

/**
 * Metadata required for deserializing a given type
 */
interface ContractMetadata {
    fields?: { [fieldName: string]: ContractFieldMetadata; };
}

/**
* Parameters for sending a WebApi request
*/
export interface VssApiResourceRequestParams {
    
    /**
    * Name of the area for the resource
    */
    area: string;

    /**
    * Unique identifier for the resource's route to issue a request to. Used to lookup the route template
    * for this request if the routeTemplate parameter is not supplied.
    */
    locationId?: string;

    /**
    * Route template that is used to form the request path. This can be used in place of locationId. If
    * routeTemplate is NOT specified, then locationId is used to lookup the template via an OPTIONS request.
    */
    routeTemplate?: string;

    /**
    * Name of the resource to use in route template replacements. Only used if routeTemplate is provided instead of
    * locationId.
    */
    resource?: string;

    /**
    * Dictionary of route template replacement values
    */
    routeValues?: { [key: string]: any; };

    /**
    * Data to post. In this case of a GET, this indicates query parameters.
    * For other requests, this is the request body object (which will be serialized
    * into a JSON string unless isRawData is set to true).
    */
    data?: any;

    /**
    * Query parameters to add to the url. In the case of a GET, query parameters can
    * be supplied via 'data' or 'queryParams'. For other verbs such as POST, the
    * data object specifies the POST body, so queryParams is needed to indicate
    * parameters to add to the query string of the url (not included in the post body).
    */
    queryParams?: {[key: string]: any};

    /**
    * HTTP verb (GET by default if not specified)
    */
    httpMethod?: string;

    /**
    * The http response (Accept) type. This is "json" (corresponds to application/json Accept header) 
    * unless otherwise specified. Other possible values are "html" or "text".
    */
    httpResponseType?: string;

    /**
    * Contract metadata for the request body. This allows us to do the necessary serialization
    * for the provided 'data' object using VSS serialization settings.
    */
    requestType?: ContractMetadata;
    
    /**
    * Contract metadata for the response. This allows us to do the necessary deserialization
    * for the response object using VSS serialization settings.
    */
    responseType?: ContractMetadata;
    
    /**
    * Indicates that the response is expected to be a wrapped array, so unwrap the response to
    * a regular array.
    */
    responseIsCollection?: boolean;

    /**
    * Allows the caller to specify custom request headers.
    */
    customHeaders?: { [headerName: string]: any; };
    
    /**
    * Request timeout in milliseconds. The default is 5 minutes.
    */
    timeout?: number;

    /**
    * The api version string to send in the request (e.g. "1.0" or "2.0-preview.2")
    */
    apiVersion?: string;

    /**
    * If true, this indicates that no processing should be done on the 'data' object
    * before it is sent in the request. *This is rarely needed*. One case is when posting
    * an HTML5 File object. 
    */
    isRawData?: boolean;
}

interface VssApiResourceLocationLookup {
    [locationId: string]: WebApi_Contracts.ApiResourceLocation;
}

/**
* Base class that should be used (derived from) to make requests to VSS REST apis
*/
export class VssHttpClient {

    private static APIS_RELATIVE_PATH = "_apis";
    private static DEFAULT_REQUEST_TIMEOUT = 300000; // 5 minutes
    private static _legacyDateRegExp: RegExp;

    private _locationsByAreaPromises: { [areaName: string]: Q.Promise<VssApiResourceLocationLookup>; };

    protected rootRequestPath: string;
    private auth: {user?: string, pass?: string, sendImmediately?: boolean, bearer?: string};

    constructor(rootRequestPath: string) {
        this.rootRequestPath = rootRequestPath;
        this._locationsByAreaPromises = {};
    }
    
    public static getClient<T extends VssHttpClient>(type: new (baseUrl: string) => T, baseUrl: string, authToken?: string): T {
        let client = new type(baseUrl);
        if (authToken) {
            client.auth = {
                user: authToken,
                pass: "",
                sendImmediately: true
            };
        }
        return client;
    }

    /**
    * Issue a request to a VSS REST endpoint.
    *
    * @param requestParams request options
    * @param useAjaxResult If true, textStatus and jqXHR are added to the success callback. In this case, spread (instead of then) needs to be used
    * @returns Q Promise for the response
    */
    public _beginRequest<T>(requestParams: VssApiResourceRequestParams, useAjaxResult: boolean = false): Q.Promise<T> {

        let deferred = Q.defer<T>();
        
        // Remove any query params whose value is undefined
        if (_.isObject(requestParams.queryParams)) {
            requestParams.queryParams = _.omit<{[key: string]: any}, {[key: string]: any}>(requestParams.queryParams, key => requestParams.queryParams[key] === undefined);
        }

        if (requestParams.routeTemplate) {
            let requestUrl = this.getRequestUrl(requestParams.routeTemplate, requestParams.area, requestParams.resource, requestParams.routeValues, requestParams.queryParams);
            this._beginRequestToResolvedUrl(requestUrl, requestParams.apiVersion, requestParams, deferred, useAjaxResult);
        }
        else {
            this._beginGetLocation(requestParams.area, requestParams.locationId).then((location: WebApi_Contracts.ApiResourceLocation) => {

                let requestUrl = this.getRequestUrl(location.routeTemplate, location.area, location.resourceName, requestParams.routeValues, requestParams.queryParams);

                let apiVersion = requestParams.apiVersion;
                if (!apiVersion) {
                    // Use the latest version of the resource if the api version was not specified in the request.
                    apiVersion = location.maxVersion + "-preview." + location.resourceVersion;
                }

                this._beginRequestToResolvedUrl(requestUrl, apiVersion, requestParams, deferred, useAjaxResult);
            });
        }

        return deferred.promise;
    }

    private _beginRequestToResolvedUrl<T>(requestUrl: string, apiVersion: string, requestParams: VssApiResourceRequestParams, deferred: Q.Deferred<T>, useAjaxResult: boolean) {

        let requestOptions: request.Options = {
            url: requestUrl,
            auth: this.auth,
            proxy: "http://127.0.0.1:8888"
        };

        let acceptType: string;

        requestOptions.method = requestParams.httpMethod || "GET";

        let requestData = requestParams.data;
        if (!requestParams.isRawData && requestData && requestParams.requestType) {
            requestData = Serialization.ContractSerializer.serialize(requestData, requestParams.requestType, true);
        }

        if (!requestParams.httpResponseType || requestParams.httpResponseType.toLowerCase() === "json") {
            acceptType = "application/json";
        }
        else {
            acceptType = "*/*";
        }

        requestOptions.headers = <any>_.assign({
            "Accept": acceptType + (apiVersion ? (";api-version=" + apiVersion) : ""),
            "Content-Type": "application/json"
        }, requestParams.customHeaders);
        
        requestOptions["json"] = requestData;

        let promise = <Q.Promise<T>>this._issueRequest(requestOptions);
        promise.spread((response, body) => {
            let resolvedData = Serialization.ContractSerializer.deserialize(body, requestParams.responseType, false, requestParams.responseIsCollection);
            deferred.resolve(resolvedData);
        }, deferred.reject);
    }

    /**
    * Issue a request to a VSS REST endpoint and makes sure the result contains jqXHR. Use spread to access jqXHR.
    *
    * @param requestParams request options
    * @returns Q Promise for the response
    */
    public _beginRequestWithAjaxResult<T>(requestParams: VssApiResourceRequestParams): Q.Promise<T> {
        return <Q.Promise<T>>this._beginRequest(requestParams, true);
    }

    /**
     * Issue an AJAX request. This is a wrapper around jquery's ajax method that handles VSS authentication
     * and triggers events that can be listened to by other modules.
     *
     * @param requestUrl Url to send the request to
     * @param ajaxOptions jQuery.ajax options
     * @param useAjaxResult If true, textStatus and jqXHR are added to the success callback. In this case, spread (instead of then) needs to be used.
     */
    public _issueRequest(requestOptions: request.Options): Q.Promise<any> {
        // console.log("Issuing an ajax request with the following options: \n" + JSON.stringify(requestOptions, null, 4));
        return Q.Promise<[http.IncomingMessage, string]>((resolve, reject, notify) => {
            request(requestOptions, (error, response, body) => {
                if (error) {
                    reject(error);
                }
                // console.log("Got response (" + response.statusCode + "): \n" + JSON.stringify(response.headers, null, 4));
                if (Math.floor(response.statusCode / 100) !== 2) {
                    reject(response);
                } else {
                    resolve([response, body]);
                }
            });
        });
    }

    /**
     * Gets information about an API resource location (route template, supported versions, etc.)
     * 
     * @param area resource area name
     * @param locationId Guid of the location to get
     */
    public _beginGetLocation(area: string, locationId: string): Q.Promise<WebApi_Contracts.ApiResourceLocation> {
        return this.beginGetAreaLocations(area).then((areaLocations: VssApiResourceLocationLookup) => {
            let location = areaLocations[(locationId || "").toLowerCase()];
            if (!location) {
                throw new Error("Failed to find api location for area: " + area + " id: " + locationId);
            }
            return location;
        });
    }

    private beginGetAreaLocations(area: string): Q.Promise<VssApiResourceLocationLookup> {
        let areaLocationsPromise = this._locationsByAreaPromises[area];
        if (!areaLocationsPromise) {

            let deferred = Q.defer<VssApiResourceLocationLookup>();
            areaLocationsPromise = deferred.promise;

            let requestUrl = this.rootRequestPath + VssHttpClient.APIS_RELATIVE_PATH + "/" + area;

            this._issueRequest({uri: requestUrl, type: "OPTIONS" }).spread((response, body) => {
                let locationsResult = JSON.parse(body);
                let locationsLookup: VssApiResourceLocationLookup = {};
                locationsResult.value.forEach((index: number, location: WebApi_Contracts.ApiResourceLocation) => {
                    locationsLookup[location.id.toLowerCase()] = location;
                });
                deferred.resolve(locationsLookup);
            },
            deferred.reject);

            this._locationsByAreaPromises[area] = areaLocationsPromise;
        }

        return areaLocationsPromise;
    }

    private getRequestUrl(routeTemplate: string, area: string, resource: string, routeValues: any, queryParams?: {[key: string]: any}): string {

        // Add area/resource route values (based on the location)
        routeValues = routeValues || {};
        if (!routeValues.area) {
            routeValues.area = area;
        }
        if (!routeValues.resource) {
            routeValues.resource = resource;
        }

        // Replace templated route values
        let url = this.rootRequestPath + this.replaceRouteValues(routeTemplate, routeValues);

        if (queryParams) {
            let urlHasQueryParams = url.indexOf("?") !== -1;
            let queryString = Querystring.stringify(_.assign({}, queryParams));

            if (queryString) {
                url += (urlHasQueryParams ? "&" : "?") + queryString;
            }
        }

        return url;
    }

    private replaceRouteValues(routeTemplate: string, routeValues: any): string {

        let result = "",
            currentPathPart = "",
            paramName = "",
            insideParam = false,
            charIndex: number,
            routeTemplateLength = routeTemplate.length,
            c: string;

        for (charIndex = 0; charIndex < routeTemplateLength; charIndex++) {
            c = routeTemplate[charIndex];

            if (insideParam) {
                if (c == "}") {
                    insideParam = false;
                    if (routeValues[paramName]) {
                        currentPathPart += encodeURIComponent(routeValues[paramName]);
                    } else {
                        // Normalize param name in order to capture wild-card routes
                        let strippedParamName = paramName.replace(/[^a-z0-9]/ig, '');
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
                        // Escaped '{'
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
                        // Escaped '}'
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
    }

    public _getLinkResponseHeaders(xhr: XMLHttpRequest): { [relName: string]: string; } {
        let results: { [relName: string]: string; } = {},
            responseHeadersString = xhr.getAllResponseHeaders(), // cannot use xhr.getResponseHeader('Link') because jquery/IE bug
            rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, // IE leaves an \r character at EOL
            linkRegExp = /\<(.*?)\>;rel=\"(.*?)\"/g,
            headerMatch: any,
            linkMatch: any;

        // In IE, the Link headers will be distinct, where as in Chrome, the Link headers will be comma delimited
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
    }
}
