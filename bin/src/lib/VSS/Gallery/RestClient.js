/*
* ---------------------------------------------------------
* Copyright(C) Microsoft Corporation. All rights reserved.
* ---------------------------------------------------------
*
* ---------------------------------------------------------
* Generated file, DO NOT EDIT
* ---------------------------------------------------------
*
* See following wiki page for instructions on how to regenerate:
*   https://vsowiki.com/index.php?title=Rest_Client_Generation
*/
"use strict";
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Contracts = require("../Gallery/Contracts");
var VSS_WebApi = require("../WebApi/RestClient");
var GalleryHttpClient = (function (_super) {
    __extends(GalleryHttpClient, _super);
    function GalleryHttpClient(rootRequestPath) {
        _super.call(this, rootRequestPath);
    }
    GalleryHttpClient.prototype.shareExtensionById = function (extensionId, accountName) {
        return this._beginRequest({
            httpMethod: "POST",
            httpResponseType: "html",
            area: "gallery",
            locationId: "1f19631b-a0b4-4a03-89c2-d79785d24360",
            resource: "accounts",
            routeTemplate: "_apis/{area}/extensions/{extensionId}/{resource}/{accountName}",
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
                accountName: accountName,
            },
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.unshareExtensionById = function (extensionId, accountName) {
        return this._beginRequest({
            httpMethod: "DELETE",
            httpResponseType: "html",
            area: "gallery",
            locationId: "1f19631b-a0b4-4a03-89c2-d79785d24360",
            resource: "accounts",
            routeTemplate: "_apis/{area}/extensions/{extensionId}/{resource}/{accountName}",
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
                accountName: accountName,
            },
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.shareExtension = function (publisherName, extensionName, accountName) {
        return this._beginRequest({
            httpMethod: "POST",
            httpResponseType: "html",
            area: "gallery",
            locationId: "a1e66d8f-f5de-4d16-8309-91a4e015ee46",
            resource: "accounts",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/extensions/{extensionName}/{resource}/{accountName}",
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
                accountName: accountName,
            },
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.unshareExtension = function (publisherName, extensionName, accountName) {
        return this._beginRequest({
            httpMethod: "DELETE",
            httpResponseType: "html",
            area: "gallery",
            locationId: "a1e66d8f-f5de-4d16-8309-91a4e015ee46",
            resource: "accounts",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/extensions/{extensionName}/{resource}/{accountName}",
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
                accountName: accountName,
            },
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.getCategories = function (languages) {
        var queryValues = {
            languages: languages,
        };
        return this._beginRequest({
            httpMethod: "GET",
            area: "gallery",
            locationId: "e0a5a71e-3ac3-43a0-ae7d-0bb5c3046a2a",
            resource: "categories",
            routeTemplate: "_apis/public/{area}/{resource}",
            responseIsCollection: true,
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.queryExtensions = function (extensionQuery, accountToken) {
        var queryValues = {
            accountToken: accountToken,
        };
        return this._beginRequest({
            httpMethod: "POST",
            area: "gallery",
            locationId: "eb9d5ee1-6d43-456b-b80e-8a96fbc014b6",
            resource: "extensionquery",
            routeTemplate: "_apis/public/{area}/{resource}",
            requestType: Contracts.TypeInfo.ExtensionQuery,
            responseType: Contracts.TypeInfo.ExtensionQueryResult,
            responseIsCollection: false,
            queryParams: queryValues,
            apiVersion: "2.0-preview.1",
            data: extensionQuery
        });
    };
    GalleryHttpClient.prototype.createExtension = function (extensionPackage) {
        return this._beginRequest({
            httpMethod: "POST",
            area: "gallery",
            locationId: "a41192c8-9525-4b58-bc86-179fa549d80d",
            resource: "extensions",
            routeTemplate: "_apis/{area}/{resource}/{extensionId}",
            requestType: Contracts.TypeInfo.ExtensionPackage,
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            apiVersion: "2.0-preview.1",
            data: extensionPackage
        });
    };
    GalleryHttpClient.prototype.deleteExtensionById = function (extensionId, version) {
        var queryValues = {
            version: version,
        };
        return this._beginRequest({
            httpMethod: "DELETE",
            httpResponseType: "html",
            area: "gallery",
            locationId: "a41192c8-9525-4b58-bc86-179fa549d80d",
            resource: "extensions",
            routeTemplate: "_apis/{area}/{resource}/{extensionId}",
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.getExtensionById = function (extensionId, version, flags) {
        var queryValues = {
            version: version,
            flags: flags,
        };
        return this._beginRequest({
            httpMethod: "GET",
            area: "gallery",
            locationId: "a41192c8-9525-4b58-bc86-179fa549d80d",
            resource: "extensions",
            routeTemplate: "_apis/{area}/{resource}/{extensionId}",
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.updateExtensionById = function (extensionPackage, extensionId) {
        return this._beginRequest({
            httpMethod: "PUT",
            area: "gallery",
            locationId: "a41192c8-9525-4b58-bc86-179fa549d80d",
            resource: "extensions",
            routeTemplate: "_apis/{area}/{resource}/{extensionId}",
            requestType: Contracts.TypeInfo.ExtensionPackage,
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
            },
            apiVersion: "2.0-preview.1",
            data: extensionPackage
        });
    };
    GalleryHttpClient.prototype.createExtensionWithPublisher = function (extensionPackage, publisherName) {
        return this._beginRequest({
            httpMethod: "POST",
            area: "gallery",
            locationId: "e11ea35a-16fe-4b80-ab11-c4cab88a0966",
            resource: "extensions",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/{resource}/{extensionName}",
            requestType: Contracts.TypeInfo.ExtensionPackage,
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
            },
            apiVersion: "2.0-preview.1",
            data: extensionPackage
        });
    };
    GalleryHttpClient.prototype.deleteExtension = function (publisherName, extensionName, version) {
        var queryValues = {
            version: version,
        };
        return this._beginRequest({
            httpMethod: "DELETE",
            httpResponseType: "html",
            area: "gallery",
            locationId: "e11ea35a-16fe-4b80-ab11-c4cab88a0966",
            resource: "extensions",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/{resource}/{extensionName}",
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.getExtension = function (publisherName, extensionName, version, flags) {
        var queryValues = {
            version: version,
            flags: flags,
        };
        return this._beginRequest({
            httpMethod: "GET",
            area: "gallery",
            locationId: "e11ea35a-16fe-4b80-ab11-c4cab88a0966",
            resource: "extensions",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/{resource}/{extensionName}",
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.updateExtension = function (extensionPackage, publisherName, extensionName) {
        return this._beginRequest({
            httpMethod: "PUT",
            area: "gallery",
            locationId: "e11ea35a-16fe-4b80-ab11-c4cab88a0966",
            resource: "extensions",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/{resource}/{extensionName}",
            requestType: Contracts.TypeInfo.ExtensionPackage,
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
            },
            apiVersion: "2.0-preview.1",
            data: extensionPackage
        });
    };
    GalleryHttpClient.prototype.queryPublishers = function (publisherQuery) {
        return this._beginRequest({
            httpMethod: "POST",
            area: "gallery",
            locationId: "2ad6ee0a-b53f-4034-9d1d-d009fda1212e",
            resource: "publisherquery",
            routeTemplate: "_apis/public/{area}/{resource}",
            requestType: Contracts.TypeInfo.PublisherQuery,
            responseType: Contracts.TypeInfo.PublisherQueryResult,
            responseIsCollection: false,
            apiVersion: "2.0-preview.1",
            data: publisherQuery
        });
    };
    GalleryHttpClient.prototype.createPublisher = function (publisher) {
        return this._beginRequest({
            httpMethod: "POST",
            area: "gallery",
            locationId: "4ddec66a-e4f6-4f5d-999e-9e77710d7ff4",
            resource: "publishers",
            routeTemplate: "_apis/{area}/{resource}/{publisherName}",
            requestType: Contracts.TypeInfo.Publisher,
            responseType: Contracts.TypeInfo.Publisher,
            responseIsCollection: false,
            apiVersion: "2.0-preview.1",
            data: publisher
        });
    };
    GalleryHttpClient.prototype.deletePublisher = function (publisherName) {
        return this._beginRequest({
            httpMethod: "DELETE",
            httpResponseType: "html",
            area: "gallery",
            locationId: "4ddec66a-e4f6-4f5d-999e-9e77710d7ff4",
            resource: "publishers",
            routeTemplate: "_apis/{area}/{resource}/{publisherName}",
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
            },
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.getPublisher = function (publisherName, flags) {
        var queryValues = {
            flags: flags,
        };
        return this._beginRequest({
            httpMethod: "GET",
            area: "gallery",
            locationId: "4ddec66a-e4f6-4f5d-999e-9e77710d7ff4",
            resource: "publishers",
            routeTemplate: "_apis/{area}/{resource}/{publisherName}",
            responseType: Contracts.TypeInfo.Publisher,
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.prototype.updatePublisher = function (publisher, publisherName) {
        return this._beginRequest({
            httpMethod: "PUT",
            area: "gallery",
            locationId: "4ddec66a-e4f6-4f5d-999e-9e77710d7ff4",
            resource: "publishers",
            routeTemplate: "_apis/{area}/{resource}/{publisherName}",
            requestType: Contracts.TypeInfo.Publisher,
            responseType: Contracts.TypeInfo.Publisher,
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
            },
            apiVersion: "2.0-preview.1",
            data: publisher
        });
    };
    GalleryHttpClient.prototype.getSigningKey = function (keyType) {
        return this._beginRequest({
            httpMethod: "GET",
            area: "gallery",
            locationId: "92ed5cf4-c38b-465a-9059-2f2fb7c624b5",
            resource: "signingkey",
            routeTemplate: "_apis/{area}/{resource}/{keyType}",
            responseIsCollection: false,
            routeValues: {
                keyType: keyType,
            },
            apiVersion: "2.0-preview.1"
        });
    };
    GalleryHttpClient.serviceInstanceId = "00000029-0000-8888-8000-000000000000";
    return GalleryHttpClient;
})(VSS_WebApi.VssHttpClient);
exports.GalleryHttpClient = GalleryHttpClient;
