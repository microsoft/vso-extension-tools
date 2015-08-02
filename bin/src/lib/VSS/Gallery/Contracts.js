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
(function (ExtensionQueryFilterType) {
    ExtensionQueryFilterType[ExtensionQueryFilterType["Tag"] = 1] = "Tag";
    ExtensionQueryFilterType[ExtensionQueryFilterType["DisplayName"] = 2] = "DisplayName";
    ExtensionQueryFilterType[ExtensionQueryFilterType["Private"] = 3] = "Private";
    ExtensionQueryFilterType[ExtensionQueryFilterType["Id"] = 4] = "Id";
    ExtensionQueryFilterType[ExtensionQueryFilterType["Category"] = 5] = "Category";
    ExtensionQueryFilterType[ExtensionQueryFilterType["ContributionType"] = 6] = "ContributionType";
})(exports.ExtensionQueryFilterType || (exports.ExtensionQueryFilterType = {}));
var ExtensionQueryFilterType = exports.ExtensionQueryFilterType;
(function (ExtensionQueryFlags) {
    ExtensionQueryFlags[ExtensionQueryFlags["None"] = 0] = "None";
    ExtensionQueryFlags[ExtensionQueryFlags["IncludeVersions"] = 1] = "IncludeVersions";
    ExtensionQueryFlags[ExtensionQueryFlags["IncludeFiles"] = 2] = "IncludeFiles";
    ExtensionQueryFlags[ExtensionQueryFlags["IncludeCategoryAndTags"] = 4] = "IncludeCategoryAndTags";
    ExtensionQueryFlags[ExtensionQueryFlags["IncludeSharedAccounts"] = 8] = "IncludeSharedAccounts";
    ExtensionQueryFlags[ExtensionQueryFlags["IncludeVersionProperties"] = 16] = "IncludeVersionProperties";
    ExtensionQueryFlags[ExtensionQueryFlags["ExcludeNonValidated"] = 32] = "ExcludeNonValidated";
    ExtensionQueryFlags[ExtensionQueryFlags["AllAttributes"] = 31] = "AllAttributes";
})(exports.ExtensionQueryFlags || (exports.ExtensionQueryFlags = {}));
var ExtensionQueryFlags = exports.ExtensionQueryFlags;
(function (ExtensionVersionFlags) {
    ExtensionVersionFlags[ExtensionVersionFlags["None"] = 0] = "None";
    ExtensionVersionFlags[ExtensionVersionFlags["Validated"] = 1] = "Validated";
})(exports.ExtensionVersionFlags || (exports.ExtensionVersionFlags = {}));
var ExtensionVersionFlags = exports.ExtensionVersionFlags;
(function (PagingDirection) {
    PagingDirection[PagingDirection["Backward"] = 1] = "Backward";
    PagingDirection[PagingDirection["Forward"] = 2] = "Forward";
})(exports.PagingDirection || (exports.PagingDirection = {}));
var PagingDirection = exports.PagingDirection;
(function (PublishedExtensionFlags) {
    PublishedExtensionFlags[PublishedExtensionFlags["UnChanged"] = 1073741824] = "UnChanged";
    PublishedExtensionFlags[PublishedExtensionFlags["None"] = 0] = "None";
    PublishedExtensionFlags[PublishedExtensionFlags["Disabled"] = 1] = "Disabled";
    PublishedExtensionFlags[PublishedExtensionFlags["BuiltIn"] = 2] = "BuiltIn";
    PublishedExtensionFlags[PublishedExtensionFlags["Validated"] = 4] = "Validated";
    PublishedExtensionFlags[PublishedExtensionFlags["Public"] = 256] = "Public";
    PublishedExtensionFlags[PublishedExtensionFlags["MultiVersion"] = 512] = "MultiVersion";
    PublishedExtensionFlags[PublishedExtensionFlags["System"] = 1024] = "System";
    PublishedExtensionFlags[PublishedExtensionFlags["ServiceFlags"] = 1029] = "ServiceFlags";
})(exports.PublishedExtensionFlags || (exports.PublishedExtensionFlags = {}));
var PublishedExtensionFlags = exports.PublishedExtensionFlags;
(function (PublisherFlags) {
    PublisherFlags[PublisherFlags["UnChanged"] = 1073741824] = "UnChanged";
    PublisherFlags[PublisherFlags["None"] = 0] = "None";
    PublisherFlags[PublisherFlags["Disabled"] = 1] = "Disabled";
    PublisherFlags[PublisherFlags["ServiceFlags"] = 1] = "ServiceFlags";
})(exports.PublisherFlags || (exports.PublisherFlags = {}));
var PublisherFlags = exports.PublisherFlags;
(function (PublisherPermissions) {
    PublisherPermissions[PublisherPermissions["Read"] = 1] = "Read";
    PublisherPermissions[PublisherPermissions["Write"] = 2] = "Write";
    PublisherPermissions[PublisherPermissions["Create"] = 4] = "Create";
    PublisherPermissions[PublisherPermissions["Publish"] = 8] = "Publish";
    PublisherPermissions[PublisherPermissions["Admin"] = 16] = "Admin";
    PublisherPermissions[PublisherPermissions["TrustedPartner"] = 32] = "TrustedPartner";
    PublisherPermissions[PublisherPermissions["PrivateRead"] = 64] = "PrivateRead";
})(exports.PublisherPermissions || (exports.PublisherPermissions = {}));
var PublisherPermissions = exports.PublisherPermissions;
(function (PublisherQueryFilterType) {
    PublisherQueryFilterType[PublisherQueryFilterType["Tag"] = 1] = "Tag";
    PublisherQueryFilterType[PublisherQueryFilterType["DisplayName"] = 2] = "DisplayName";
    PublisherQueryFilterType[PublisherQueryFilterType["My"] = 3] = "My";
})(exports.PublisherQueryFilterType || (exports.PublisherQueryFilterType = {}));
var PublisherQueryFilterType = exports.PublisherQueryFilterType;
(function (PublisherQueryFlags) {
    PublisherQueryFlags[PublisherQueryFlags["None"] = 0] = "None";
    PublisherQueryFlags[PublisherQueryFlags["IncludeExtensions"] = 1] = "IncludeExtensions";
})(exports.PublisherQueryFlags || (exports.PublisherQueryFlags = {}));
var PublisherQueryFlags = exports.PublisherQueryFlags;
(function (SigningKeyPermissions) {
    SigningKeyPermissions[SigningKeyPermissions["Read"] = 1] = "Read";
    SigningKeyPermissions[SigningKeyPermissions["Write"] = 2] = "Write";
})(exports.SigningKeyPermissions || (exports.SigningKeyPermissions = {}));
var SigningKeyPermissions = exports.SigningKeyPermissions;
exports.TypeInfo = {
    ExtensionAccount: {
        fields: null
    },
    ExtensionFile: {
        fields: null
    },
    ExtensionFilterResult: {
        fields: null
    },
    ExtensionPackage: {
        fields: null
    },
    ExtensionQuery: {
        fields: null
    },
    ExtensionQueryFilterType: {
        enumValues: {
            "tag": 1,
            "displayName": 2,
            "private": 3,
            "id": 4,
            "category": 5,
            "contributionType": 6,
        }
    },
    ExtensionQueryFlags: {
        enumValues: {
            "none": 0,
            "includeVersions": 1,
            "includeFiles": 2,
            "includeCategoryAndTags": 4,
            "includeSharedAccounts": 8,
            "includeVersionProperties": 16,
            "excludeNonValidated": 32,
            "allAttributes": 31,
        }
    },
    ExtensionQueryResult: {
        fields: null
    },
    ExtensionVersion: {
        fields: null
    },
    ExtensionVersionFlags: {
        enumValues: {
            "none": 0,
            "validated": 1,
        }
    },
    FilterCriteria: {
        fields: null
    },
    PagingDirection: {
        enumValues: {
            "backward": 1,
            "forward": 2,
        }
    },
    PublishedExtension: {
        fields: null
    },
    PublishedExtensionFlags: {
        enumValues: {
            "unChanged": 1073741824,
            "none": 0,
            "disabled": 1,
            "builtIn": 2,
            "validated": 4,
            "public": 256,
            "multiVersion": 512,
            "system": 1024,
            "serviceFlags": 1029,
        }
    },
    Publisher: {
        fields: null
    },
    PublisherFacts: {
        fields: null
    },
    PublisherFilterResult: {
        fields: null
    },
    PublisherFlags: {
        enumValues: {
            "unChanged": 1073741824,
            "none": 0,
            "disabled": 1,
            "serviceFlags": 1,
        }
    },
    PublisherPermissions: {
        enumValues: {
            "read": 1,
            "write": 2,
            "create": 4,
            "publish": 8,
            "admin": 16,
            "trustedPartner": 32,
            "privateRead": 64,
        }
    },
    PublisherQuery: {
        fields: null
    },
    PublisherQueryFilterType: {
        enumValues: {
            "tag": 1,
            "displayName": 2,
            "my": 3,
        }
    },
    PublisherQueryFlags: {
        enumValues: {
            "none": 0,
            "includeExtensions": 1,
        }
    },
    PublisherQueryResult: {
        fields: null
    },
    QueryFilter: {
        fields: null
    },
    SigningKeyPermissions: {
        enumValues: {
            "read": 1,
            "write": 2,
        }
    },
};
exports.TypeInfo.ExtensionAccount.fields = {};
exports.TypeInfo.ExtensionFile.fields = {};
exports.TypeInfo.ExtensionFilterResult.fields = {
    extensions: {
        isArray: true,
        typeInfo: exports.TypeInfo.PublishedExtension
    },
};
exports.TypeInfo.ExtensionPackage.fields = {};
exports.TypeInfo.ExtensionQuery.fields = {
    filters: {
        isArray: true,
        typeInfo: exports.TypeInfo.QueryFilter
    },
    flags: {
        enumType: exports.TypeInfo.ExtensionQueryFlags
    },
};
exports.TypeInfo.ExtensionQueryResult.fields = {
    results: {
        isArray: true,
        typeInfo: exports.TypeInfo.ExtensionFilterResult
    },
};
exports.TypeInfo.ExtensionVersion.fields = {
    files: {
        isArray: true,
        typeInfo: exports.TypeInfo.ExtensionFile
    },
    flags: {
        enumType: exports.TypeInfo.ExtensionVersionFlags
    },
    lastUpdated: {
        isDate: true,
    },
};
exports.TypeInfo.FilterCriteria.fields = {};
exports.TypeInfo.PublishedExtension.fields = {
    allowedAccounts: {
        isArray: true,
        typeInfo: exports.TypeInfo.ExtensionAccount
    },
    flags: {
        enumType: exports.TypeInfo.PublishedExtensionFlags
    },
    lastUpdated: {
        isDate: true,
    },
    publisher: {
        typeInfo: exports.TypeInfo.PublisherFacts
    },
    versions: {
        isArray: true,
        typeInfo: exports.TypeInfo.ExtensionVersion
    },
};
exports.TypeInfo.Publisher.fields = {
    extensions: {
        isArray: true,
        typeInfo: exports.TypeInfo.PublishedExtension
    },
    flags: {
        enumType: exports.TypeInfo.PublisherFlags
    },
    lastUpdated: {
        isDate: true,
    },
};
exports.TypeInfo.PublisherFacts.fields = {};
exports.TypeInfo.PublisherFilterResult.fields = {
    publishers: {
        isArray: true,
        typeInfo: exports.TypeInfo.Publisher
    },
};
exports.TypeInfo.PublisherQuery.fields = {
    filters: {
        isArray: true,
        typeInfo: exports.TypeInfo.QueryFilter
    },
    flags: {
        enumType: exports.TypeInfo.PublisherQueryFlags
    },
};
exports.TypeInfo.PublisherQueryResult.fields = {
    results: {
        isArray: true,
        typeInfo: exports.TypeInfo.PublisherFilterResult
    },
};
exports.TypeInfo.QueryFilter.fields = {
    criteria: {
        isArray: true,
        typeInfo: exports.TypeInfo.FilterCriteria
    },
    direction: {
        enumType: exports.TypeInfo.PagingDirection
    },
};
