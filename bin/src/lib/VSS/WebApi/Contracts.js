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
(function (ConnectOptions) {
    ConnectOptions[ConnectOptions["None"] = 0] = "None";
    ConnectOptions[ConnectOptions["IncludeServices"] = 1] = "IncludeServices";
})(exports.ConnectOptions || (exports.ConnectOptions = {}));
var ConnectOptions = exports.ConnectOptions;
(function (JWTAlgorithm) {
    JWTAlgorithm[JWTAlgorithm["None"] = 0] = "None";
    JWTAlgorithm[JWTAlgorithm["HS256"] = 1] = "HS256";
    JWTAlgorithm[JWTAlgorithm["RS256"] = 2] = "RS256";
})(exports.JWTAlgorithm || (exports.JWTAlgorithm = {}));
var JWTAlgorithm = exports.JWTAlgorithm;
(function (Operation) {
    Operation[Operation["Add"] = 0] = "Add";
    Operation[Operation["Remove"] = 1] = "Remove";
    Operation[Operation["Replace"] = 2] = "Replace";
    Operation[Operation["Move"] = 3] = "Move";
    Operation[Operation["Copy"] = 4] = "Copy";
    Operation[Operation["Test"] = 5] = "Test";
})(exports.Operation || (exports.Operation = {}));
var Operation = exports.Operation;
exports.TypeInfo = {
    ApiResourceLocation: {
        fields: null
    },
    ApiResourceVersion: {
        fields: null
    },
    ConnectOptions: {
        enumValues: {
            "none": 0,
            "includeServices": 1,
        }
    },
    IdentityRef: {
        fields: null
    },
    JsonPatchDocument: {
        fields: null
    },
    JsonPatchOperation: {
        fields: null
    },
    JsonWebToken: {
        fields: null
    },
    JWTAlgorithm: {
        enumValues: {
            "none": 0,
            "hS256": 1,
            "rS256": 2,
        }
    },
    Operation: {
        enumValues: {
            "add": 0,
            "remove": 1,
            "replace": 2,
            "move": 3,
            "copy": 4,
            "test": 5,
        }
    },
    Publisher: {
        fields: null
    },
    ReferenceLink: {
        fields: null
    },
    ResourceRef: {
        fields: null
    },
    ServiceEvent: {
        fields: null
    },
    VssJsonCollectionWrapper: {
        fields: null
    },
    VssJsonCollectionWrapperV: {
        fields: null
    },
    VssJsonCollectionWrapperBase: {
        fields: null
    },
    WrappedException: {
        fields: null
    },
};
exports.TypeInfo.ApiResourceLocation.fields = {};
exports.TypeInfo.ApiResourceVersion.fields = {};
exports.TypeInfo.IdentityRef.fields = {};
exports.TypeInfo.JsonPatchDocument.fields = {};
exports.TypeInfo.JsonPatchOperation.fields = {
    op: {
        enumType: exports.TypeInfo.Operation
    },
};
exports.TypeInfo.JsonWebToken.fields = {};
exports.TypeInfo.Publisher.fields = {};
exports.TypeInfo.ReferenceLink.fields = {};
exports.TypeInfo.ResourceRef.fields = {};
exports.TypeInfo.ServiceEvent.fields = {
    publisher: {
        typeInfo: exports.TypeInfo.Publisher
    },
};
exports.TypeInfo.VssJsonCollectionWrapper.fields = {};
exports.TypeInfo.VssJsonCollectionWrapperV.fields = {};
exports.TypeInfo.VssJsonCollectionWrapperBase.fields = {};
exports.TypeInfo.WrappedException.fields = {
    innerException: {
        typeInfo: exports.TypeInfo.WrappedException
    },
};
