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

import Contracts = require("../Gallery/Contracts");
import VSS_WebApi = require("../WebApi/RestClient");
import VSS_WebApi_Constants = require("../WebApi/Constants");

export class GalleryHttpClient3 extends VSS_WebApi.VssHttpClient {

    public static serviceInstanceId = "00000029-0000-8888-8000-000000000000";

    constructor(rootRequestPath: string) {
        super(rootRequestPath);
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public shareExtensionById(
        extensionId: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public unshareExtensionById(
        extensionId: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public shareExtension(
        publisherName: string,
        extensionName: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public unshareExtension(
        publisherName: string,
        extensionName: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} version
     * @param {string} assetType
     * @param {string} accountToken
     * @param {boolean} acceptDefault
     * @return Q.Promise<ArrayBuffer>
     */
    public getAsset(
        extensionId: string,
        version: string,
        assetType: string,
        accountToken?: string,
        acceptDefault?: boolean
        ): Q.Promise<ArrayBuffer> {

        var queryValues: any = {
            accountToken: accountToken,
            acceptDefault: acceptDefault,
        };

        return this._beginRequest<ArrayBuffer>({
            httpMethod: "GET",
            httpResponseType: "application/octet-stream",
            area: "gallery",
            locationId: "5d545f3d-ef47-488b-8be3-f5ee1517856c",
            resource: "assets",
            routeTemplate: "_apis/public/{area}/extensions/{extensionId}/{version}/{resource}/{assetType}",
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
                version: version,
                assetType: assetType,
            },
            queryParams: queryValues,
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} languages
     * @return Q.Promise<string[]>
     */
    public getCategories(
        languages?: string
        ): Q.Promise<string[]> {

        var queryValues: any = {
            languages: languages,
        };

        return this._beginRequest<string[]>({
            httpMethod: "GET",
            area: "gallery",
            locationId: "e0a5a71e-3ac3-43a0-ae7d-0bb5c3046a2a",
            resource: "categories",
            routeTemplate: "_apis/public/{area}/{resource}",
            responseIsCollection: true,
            queryParams: queryValues,
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} version
     * @return Q.Promise<ArrayBuffer>
     */
    public getCertificate(
        publisherName: string,
        extensionName: string,
        version?: string
        ): Q.Promise<ArrayBuffer> {

        return this._beginRequest<ArrayBuffer>({
            httpMethod: "GET",
            httpResponseType: "application/octet-stream",
            area: "gallery",
            locationId: "e905ad6a-3f1f-4d08-9f6d-7d357ff8b7d0",
            resource: "certificates",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/extensions/{extensionName}/{resource}/{version}",
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
                version: version,
            },
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionQuery} extensionQuery
     * @param {string} accountToken
     * @return Q.Promise<Contracts.ExtensionQueryResult>
     */
    public queryExtensions(
        extensionQuery: Contracts.ExtensionQuery,
        accountToken?: string
        ): Q.Promise<Contracts.ExtensionQueryResult> {

        var queryValues: any = {
            accountToken: accountToken,
        };

        return this._beginRequest<Contracts.ExtensionQueryResult>({
            httpMethod: "POST",
            area: "gallery",
            locationId: "eb9d5ee1-6d43-456b-b80e-8a96fbc014b6",
            resource: "extensionquery",
            routeTemplate: "_apis/public/{area}/{resource}",
            requestType: Contracts.TypeInfo.ExtensionQuery,
            responseType: Contracts.TypeInfo.ExtensionQueryResult,
            responseIsCollection: false,
            queryParams: queryValues,
            apiVersion: "3.0-preview.1",
            data: extensionQuery
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public createExtension(
        extensionPackage: Contracts.ExtensionPackage
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
            httpMethod: "POST",
            area: "gallery",
            locationId: "a41192c8-9525-4b58-bc86-179fa549d80d",
            resource: "extensions",
            routeTemplate: "_apis/{area}/{resource}/{extensionId}",
            requestType: Contracts.TypeInfo.ExtensionPackage,
            responseType: Contracts.TypeInfo.PublishedExtension,
            responseIsCollection: false,
            apiVersion: "3.0-preview.1",
            data: extensionPackage
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} version
     * @return Q.Promise<void>
     */
    public deleteExtensionById(
        extensionId: string,
        version?: string
        ): Q.Promise<void> {

        var queryValues: any = {
            version: version,
        };

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} version
     * @param {Contracts.ExtensionQueryFlags} flags
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public getExtensionById(
        extensionId: string,
        version?: string,
        flags?: Contracts.ExtensionQueryFlags
        ): Q.Promise<Contracts.PublishedExtension> {

        var queryValues: any = {
            version: version,
            flags: flags,
        };

        return this._beginRequest<Contracts.PublishedExtension>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @param {string} extensionId
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public updateExtensionById(
        extensionPackage: Contracts.ExtensionPackage,
        extensionId: string
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
            apiVersion: "3.0-preview.1",
            data: extensionPackage
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @param {string} publisherName
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public createExtensionWithPublisher(
        extensionPackage: Contracts.ExtensionPackage,
        publisherName: string
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
            apiVersion: "3.0-preview.1",
            data: extensionPackage
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} version
     * @return Q.Promise<void>
     */
    public deleteExtension(
        publisherName: string,
        extensionName: string,
        version?: string
        ): Q.Promise<void> {

        var queryValues: any = {
            version: version,
        };

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} version
     * @param {Contracts.ExtensionQueryFlags} flags
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public getExtension(
        publisherName: string,
        extensionName: string,
        version?: string,
        flags?: Contracts.ExtensionQueryFlags
        ): Q.Promise<Contracts.PublishedExtension> {

        var queryValues: any = {
            version: version,
            flags: flags,
        };

        return this._beginRequest<Contracts.PublishedExtension>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @param {string} publisherName
     * @param {string} extensionName
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public updateExtension(
        extensionPackage: Contracts.ExtensionPackage,
        publisherName: string,
        extensionName: string
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
            apiVersion: "3.0-preview.1",
            data: extensionPackage
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.PublisherQuery} publisherQuery
     * @return Q.Promise<Contracts.PublisherQueryResult>
     */
    public queryPublishers(
        publisherQuery: Contracts.PublisherQuery
        ): Q.Promise<Contracts.PublisherQueryResult> {

        return this._beginRequest<Contracts.PublisherQueryResult>({
            httpMethod: "POST",
            area: "gallery",
            locationId: "2ad6ee0a-b53f-4034-9d1d-d009fda1212e",
            resource: "publisherquery",
            routeTemplate: "_apis/public/{area}/{resource}",
            requestType: Contracts.TypeInfo.PublisherQuery,
            responseType: Contracts.TypeInfo.PublisherQueryResult,
            responseIsCollection: false,
            apiVersion: "3.0-preview.1",
            data: publisherQuery
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.Publisher} publisher
     * @return Q.Promise<Contracts.Publisher>
     */
    public createPublisher(
        publisher: Contracts.Publisher
        ): Q.Promise<Contracts.Publisher> {

        return this._beginRequest<Contracts.Publisher>({
            httpMethod: "POST",
            area: "gallery",
            locationId: "4ddec66a-e4f6-4f5d-999e-9e77710d7ff4",
            resource: "publishers",
            routeTemplate: "_apis/{area}/{resource}/{publisherName}",
            requestType: Contracts.TypeInfo.Publisher,
            responseType: Contracts.TypeInfo.Publisher,
            responseIsCollection: false,
            apiVersion: "3.0-preview.1",
            data: publisher
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @return Q.Promise<void>
     */
    public deletePublisher(
        publisherName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {number} flags
     * @return Q.Promise<Contracts.Publisher>
     */
    public getPublisher(
        publisherName: string,
        flags?: number
        ): Q.Promise<Contracts.Publisher> {

        var queryValues: any = {
            flags: flags,
        };

        return this._beginRequest<Contracts.Publisher>({
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
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.Publisher} publisher
     * @param {string} publisherName
     * @return Q.Promise<Contracts.Publisher>
     */
    public updatePublisher(
        publisher: Contracts.Publisher,
        publisherName: string
        ): Q.Promise<Contracts.Publisher> {

        return this._beginRequest<Contracts.Publisher>({
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
            apiVersion: "3.0-preview.1",
            data: publisher
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} keyType
     * @param {number} expireCurrentSeconds
     * @return Q.Promise<void>
     */
    public generateKey(
        keyType: string,
        expireCurrentSeconds?: number
        ): Q.Promise<void> {

        var queryValues: any = {
            expireCurrentSeconds: expireCurrentSeconds,
        };

        return this._beginRequest<void>({
            httpMethod: "POST",
            httpResponseType: "html",
            area: "gallery",
            locationId: "92ed5cf4-c38b-465a-9059-2f2fb7c624b5",
            resource: "signingkey",
            routeTemplate: "_apis/{area}/{resource}/{keyType}",
            responseIsCollection: false,
            routeValues: {
                keyType: keyType,
            },
            queryParams: queryValues,
            apiVersion: "3.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} keyType
     * @return Q.Promise<string>
     */
    public getSigningKey(
        keyType: string
        ): Q.Promise<string> {

        return this._beginRequest<string>({
            httpMethod: "GET",
            area: "gallery",
            locationId: "92ed5cf4-c38b-465a-9059-2f2fb7c624b5",
            resource: "signingkey",
            routeTemplate: "_apis/{area}/{resource}/{keyType}",
            responseIsCollection: false,
            routeValues: {
                keyType: keyType,
            },
            apiVersion: "3.0-preview.1"
        });
    }
}
export class GalleryHttpClient2 extends VSS_WebApi.VssHttpClient {

    public static serviceInstanceId = "00000029-0000-8888-8000-000000000000";

    constructor(rootRequestPath: string) {
        super(rootRequestPath);
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public shareExtensionById(
        extensionId: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public unshareExtensionById(
        extensionId: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public shareExtension(
        publisherName: string,
        extensionName: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} accountName
     * @return Q.Promise<void>
     */
    public unshareExtension(
        publisherName: string,
        extensionName: string,
        accountName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} version
     * @param {string} assetType
     * @param {string} accountToken
     * @param {boolean} acceptDefault
     * @return Q.Promise<ArrayBuffer>
     */
    public getAsset(
        extensionId: string,
        version: string,
        assetType: string,
        accountToken?: string,
        acceptDefault?: boolean
        ): Q.Promise<ArrayBuffer> {

        var queryValues: any = {
            accountToken: accountToken,
            acceptDefault: acceptDefault,
        };

        return this._beginRequest<ArrayBuffer>({
            httpMethod: "GET",
            httpResponseType: "application/octet-stream",
            area: "gallery",
            locationId: "5d545f3d-ef47-488b-8be3-f5ee1517856c",
            resource: "assets",
            routeTemplate: "_apis/public/{area}/extensions/{extensionId}/{version}/{resource}/{assetType}",
            responseIsCollection: false,
            routeValues: {
                extensionId: extensionId,
                version: version,
                assetType: assetType,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} languages
     * @return Q.Promise<string[]>
     */
    public getCategories(
        languages?: string
        ): Q.Promise<string[]> {

        var queryValues: any = {
            languages: languages,
        };

        return this._beginRequest<string[]>({
            httpMethod: "GET",
            area: "gallery",
            locationId: "e0a5a71e-3ac3-43a0-ae7d-0bb5c3046a2a",
            resource: "categories",
            routeTemplate: "_apis/public/{area}/{resource}",
            responseIsCollection: true,
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} version
     * @return Q.Promise<ArrayBuffer>
     */
    public getCertificate(
        publisherName: string,
        extensionName: string,
        version?: string
        ): Q.Promise<ArrayBuffer> {

        return this._beginRequest<ArrayBuffer>({
            httpMethod: "GET",
            httpResponseType: "application/octet-stream",
            area: "gallery",
            locationId: "e905ad6a-3f1f-4d08-9f6d-7d357ff8b7d0",
            resource: "certificates",
            routeTemplate: "_apis/{area}/publishers/{publisherName}/extensions/{extensionName}/{resource}/{version}",
            responseIsCollection: false,
            routeValues: {
                publisherName: publisherName,
                extensionName: extensionName,
                version: version,
            },
            apiVersion: "2.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionQuery} extensionQuery
     * @param {string} accountToken
     * @return Q.Promise<Contracts.ExtensionQueryResult>
     */
    public queryExtensions(
        extensionQuery: Contracts.ExtensionQuery,
        accountToken?: string
        ): Q.Promise<Contracts.ExtensionQueryResult> {

        var queryValues: any = {
            accountToken: accountToken,
        };

        return this._beginRequest<Contracts.ExtensionQueryResult>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public createExtension(
        extensionPackage: Contracts.ExtensionPackage
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} version
     * @return Q.Promise<void>
     */
    public deleteExtensionById(
        extensionId: string,
        version?: string
        ): Q.Promise<void> {

        var queryValues: any = {
            version: version,
        };

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} extensionId
     * @param {string} version
     * @param {Contracts.ExtensionQueryFlags} flags
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public getExtensionById(
        extensionId: string,
        version?: string,
        flags?: Contracts.ExtensionQueryFlags
        ): Q.Promise<Contracts.PublishedExtension> {

        var queryValues: any = {
            version: version,
            flags: flags,
        };

        return this._beginRequest<Contracts.PublishedExtension>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @param {string} extensionId
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public updateExtensionById(
        extensionPackage: Contracts.ExtensionPackage,
        extensionId: string
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @param {string} publisherName
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public createExtensionWithPublisher(
        extensionPackage: Contracts.ExtensionPackage,
        publisherName: string
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} version
     * @return Q.Promise<void>
     */
    public deleteExtension(
        publisherName: string,
        extensionName: string,
        version?: string
        ): Q.Promise<void> {

        var queryValues: any = {
            version: version,
        };

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {string} extensionName
     * @param {string} version
     * @param {Contracts.ExtensionQueryFlags} flags
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public getExtension(
        publisherName: string,
        extensionName: string,
        version?: string,
        flags?: Contracts.ExtensionQueryFlags
        ): Q.Promise<Contracts.PublishedExtension> {

        var queryValues: any = {
            version: version,
            flags: flags,
        };

        return this._beginRequest<Contracts.PublishedExtension>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.ExtensionPackage} extensionPackage
     * @param {string} publisherName
     * @param {string} extensionName
     * @return Q.Promise<Contracts.PublishedExtension>
     */
    public updateExtension(
        extensionPackage: Contracts.ExtensionPackage,
        publisherName: string,
        extensionName: string
        ): Q.Promise<Contracts.PublishedExtension> {

        return this._beginRequest<Contracts.PublishedExtension>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.PublisherQuery} publisherQuery
     * @return Q.Promise<Contracts.PublisherQueryResult>
     */
    public queryPublishers(
        publisherQuery: Contracts.PublisherQuery
        ): Q.Promise<Contracts.PublisherQueryResult> {

        return this._beginRequest<Contracts.PublisherQueryResult>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.Publisher} publisher
     * @return Q.Promise<Contracts.Publisher>
     */
    public createPublisher(
        publisher: Contracts.Publisher
        ): Q.Promise<Contracts.Publisher> {

        return this._beginRequest<Contracts.Publisher>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @return Q.Promise<void>
     */
    public deletePublisher(
        publisherName: string
        ): Q.Promise<void> {

        return this._beginRequest<void>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} publisherName
     * @param {number} flags
     * @return Q.Promise<Contracts.Publisher>
     */
    public getPublisher(
        publisherName: string,
        flags?: number
        ): Q.Promise<Contracts.Publisher> {

        var queryValues: any = {
            flags: flags,
        };

        return this._beginRequest<Contracts.Publisher>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {Contracts.Publisher} publisher
     * @param {string} publisherName
     * @return Q.Promise<Contracts.Publisher>
     */
    public updatePublisher(
        publisher: Contracts.Publisher,
        publisherName: string
        ): Q.Promise<Contracts.Publisher> {

        return this._beginRequest<Contracts.Publisher>({
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
    }

    /**
     * [Preview API]
     * 
     * @param {string} keyType
     * @param {number} expireCurrentSeconds
     * @return Q.Promise<void>
     */
    public generateKey(
        keyType: string,
        expireCurrentSeconds?: number
        ): Q.Promise<void> {

        var queryValues: any = {
            expireCurrentSeconds: expireCurrentSeconds,
        };

        return this._beginRequest<void>({
            httpMethod: "POST",
            httpResponseType: "html",
            area: "gallery",
            locationId: "92ed5cf4-c38b-465a-9059-2f2fb7c624b5",
            resource: "signingkey",
            routeTemplate: "_apis/{area}/{resource}/{keyType}",
            responseIsCollection: false,
            routeValues: {
                keyType: keyType,
            },
            queryParams: queryValues,
            apiVersion: "2.0-preview.1"
        });
    }

    /**
     * [Preview API]
     * 
     * @param {string} keyType
     * @return Q.Promise<string>
     */
    public getSigningKey(
        keyType: string
        ): Q.Promise<string> {

        return this._beginRequest<string>({
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
    }
}

export class GalleryHttpClient extends GalleryHttpClient3 {
    constructor(rootRequestPath: string) {
        super(rootRequestPath);
    }
}