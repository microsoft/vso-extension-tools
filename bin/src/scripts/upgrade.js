/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var fs = require("fs");
var log = require("./logger");
var path = require("path");
var Q = require("q");
var ToM85 = (function () {
    function ToM85(srcPath, publisherName) {
        var _this = this;
        this.actions = {
            contributions: function (old, upgraded) {
                if (!upgraded.contributions) {
                    upgraded.contributions = [];
                }
                Object.keys(old.contributions).forEach(function (contributionPoint) {
                    var contributions = old.contributions[contributionPoint];
                    contributions.forEach(function (contribution) {
                        upgraded.contributions.push(ToM85.convertContribution(contributionPoint, contribution, old));
                    });
                });
            },
            contributionTypes: function (old, upgraded) {
                if (!upgraded.contributionTypes) {
                    upgraded.contributionTypes = [];
                }
                Object.keys(old.contributionTypes).forEach(function (contributionTypeId) {
                    upgraded.contributionTypes.push(ToM85.convertContributionType(contributionTypeId, old.contributionTypes[contributionTypeId]));
                });
            },
            contributionPoints: function (old, upgraded) {
            },
            provider: function (old, upgraded) {
            },
            namespace: function (old, upgraded) {
                upgraded.extensionId = old.namespace.replace(/\./g, "-");
            },
            icon: function (old, upgraded) {
                if (!upgraded.assets) {
                    upgraded.assets = [];
                }
                var iconPath = old.icon;
                if (old.baseUri) {
                    if (iconPath.indexOf(old.baseUri) === 0) {
                        iconPath = iconPath.substr(old.baseUri.length);
                    }
                }
                if (iconPath.charAt(0) === "/") {
                    iconPath = iconPath.substr(1);
                }
                var fullIconPath = path.resolve(path.dirname(_this.srcPath), iconPath);
                if (!fs.existsSync(fullIconPath)) {
                    log.warn("Warning: Could not find asset %s locally (we tried %s). Ensure that the path to this asset is correct relative to the location of this manifest before packaging.", old.icon, fullIconPath);
                }
                upgraded.assets.push({
                    type: "Microsoft.VSO.LargeIcon",
                    path: iconPath
                });
            }
        };
        this.srcPath = srcPath;
        this.publisherName = publisherName;
    }
    ToM85.getExtensionId = function (extId) {
        if (ToM85.idCounts[extId]) {
            return extId + "_" + (++ToM85.idCounts[extId]);
        }
        else {
            ToM85.idCounts[extId] = 1;
            return extId;
        }
    };
    ToM85.pointIdToTarget = function (pointId, contribution) {
        if (pointId === "vss.web#hubs") {
            var group = contribution.groupId || contribution.group;
            if (group && ToM85.hubGroupIdToTargetMap[group]) {
                return ToM85.hubGroupIdToTargetMap[group];
            }
        }
        else {
            if (pointId.charAt(0) === "#") {
                return "." + pointId.substr(1).replace(/\./g, "-");
            }
            if (ToM85.contributionIdMap[pointId]) {
                return ToM85.contributionIdMap[pointId];
            }
        }
        log.warn("Warning: Cannot find appropriate M85 target contribution for contribution point %s.", pointId);
        if (contribution.group || contribution.groupId) {
            log.warn("-- groupId: %s", (contribution.group || contribution.groupId));
        }
        return pointId;
    };
    ToM85.convertTypeIdentifier = function (oldTypeId) {
        var split = oldTypeId.split("#");
        if (_.startsWith(split[0], "vss.")) {
            return ["ms", split[0].replace(".", "-"), split[1]].join(".");
        }
        log.warn("Warning: Cannot determine the correct contribution type id for: %s.", oldTypeId);
    };
    ToM85.pointIdToType = function (pointId, contribution, oldManifest) {
        var type;
        if (pointId.charAt(0) === "#") {
            type = ToM85.convertTypeIdentifier(_.get(oldManifest, "contributionPoints." + pointId.substr(1) + ".type"));
        }
        if (ToM85.contributionTypeMap[pointId]) {
            type = ToM85.contributionTypeMap[pointId];
        }
        if (type === "ms.vss-web.menu") {
            if (contribution.title || contribution.text || contribution.icon) {
                type = "ms.vss-web.action";
            }
            else if (contribution.targetUri) {
                type = "ms.vss-web.hyperlink-action";
            }
            else {
                type = "ms.vss-web.action-provider";
            }
        }
        if (!type) {
            log.warn("Warning: Cannot find appropriate M85 contribution type for contribution point %s.", pointId);
        }
        return type;
    };
    ToM85.convertContribution = function (pointId, contribution, oldManifest) {
        var newContribution = { id: null, targets: [ToM85.pointIdToTarget(pointId, contribution)], type: ToM85.pointIdToType(pointId, contribution, oldManifest), properties: {} };
        Object.keys(contribution).forEach(function (oldContributionProperty) {
            switch (oldContributionProperty) {
                case "id":
                    newContribution.id = ToM85.getExtensionId(contribution.id);
                    break;
                case "usesSdk":
                case "fullPage":
                case "groupId":
                    break;
                default:
                    newContribution.properties[oldContributionProperty] = contribution[oldContributionProperty];
                    break;
            }
        });
        if (newContribution.type === "ms.vss-web.action" || newContribution.type === "ms.vss-web.action-provider") {
            if (newContribution.id !== contribution.id) {
                newContribution.properties["registeredObjectId"] = contribution.id;
            }
        }
        if (!newContribution.id) {
            log.warn("No ID for contribution made to %s.", pointId);
        }
        return newContribution;
    };
    ToM85.convertContributionType = function (typeId, contributionType) {
        return { id: typeId, name: contributionType.title, description: contributionType.description, properties: contributionType.properties };
    };
    ToM85.prototype.execute = function (outputPath) {
        var _this = this;
        return Q.nfcall(fs.readFile, this.srcPath, "utf8").then(function (contents) {
            var old;
            var jsonData = contents.replace(/^\uFEFF/, "");
            old = JSON.parse(jsonData);
            var upgraded = { manifestVersion: null, id: null, version: null, publisher: null };
            upgraded.publisher = _this.publisherName;
            if (_.isObject(old)) {
                if (_.isArray(old.contributions)) {
                    throw "This manifest appears to already be upgraded to M85!";
                }
                var oldKeys = Object.keys(old);
                oldKeys.forEach(function (oldKey) {
                    if (_this.actions[oldKey]) {
                        _this.actions[oldKey](old, upgraded);
                    }
                    else {
                        upgraded[oldKey] = old[oldKey];
                    }
                });
            }
            else {
                throw "Input is not a valid manifest";
            }
            if (!upgraded.manifestVersion) {
                upgraded.manifestVersion = 1.0;
            }
            return upgraded;
        }).then(function (upgraded) {
            log.debug("Writing to %s.", outputPath);
            var eol = require("os").EOL;
            return Q.nfcall(fs.writeFile, outputPath, JSON.stringify(upgraded, null, 4).replace(/\n/g, eol));
        });
    };
    ToM85.contributionIdMap = {
        "vss.work.web#workItemActions": "ms.vss-work-web.work-item-context-menu",
        "vss.work.web#workItemToolbarActions": "ms.vss-work-web.work-item-toolbar-menu",
        "vss.work.web#queryActions": "ms.vss-work.web.work-item-query-menu",
        "vss.work.web#sprintBoardPivotFilters": "ms.vss-work.web.sprint-board-pivot-filter-menu",
        "vss.work.web#backlogsBoardPivotFilters": "ms.vss-work.web.backlog-board-pivot-filter-menu",
        "vss.work.web#backlogItemActions": "ms.vss-work.web.backlog-item-menu",
        "vss.code.web#gitBranchesSummaryGrid": "ms.vss-code-web.git-branches-summary-grid-menu",
        "vss.code.web#gitBranchDiffActions": "ms.vss-code-web.git-branches-summary-grid-diff-menu",
        "vss.code.web#sourceItemActions": "ms.vss-code-web.source-item-menu",
        "vss.code.web#changeExplorerActions": "ms.vss-code-web.change-list-item-menu",
        "vss.code.web#changeListSummaryItemActions": "ms.vss-code-web.change-list-summary-item-menu",
        "vss.code.web#sourceGridItemActions": "ms.vss-code-web.source-grid-item-menu",
        "vss.code.web#sourceTreeItemActions": "ms.vss-code-web.source-tree-item-menu",
        "vss.code.web#gitBranchActions": "ms.vss-code-web.git-branches-tree-menu",
        "vss.build.web#buildDefinitionActions": "ms.vss-build-web.build-definition-menu",
        "vss.build.web#completedBuildActions": "ms.vss-build-web.completed-build-menu",
        "vss.test.web#testRunGridActions": "ms.vss-code-web.test-run-grid-menu",
        "vss.test.web#testRunActions": "ms.vss-code-web.test-run-toolbar-menu",
        "vss.web#hubGroups.project": "ms.vss-web.project-hub-groups-collection",
        "vss.web#hubGroups.application": "ms.vss-web.account-hub-groups-collection",
        "vss.web#hubGroups.admin.project": "ms.vss-web.project-admin-hub-groups-collection",
        "vss.web#hubGroups.admin.collection": "ms.vss-web.collection-admin-hub-groups-collection",
        "vss.web#hubGroups.admin.application": "ms.vss-web.account-admin-hub-groups-collection",
        "vss.dashboards.web#widget: ": "ms.vss-dashboards-web.dashboard-catalog"
    };
    ToM85.hubGroupIdToTargetMap = {
        "project.contribution": "ms.vss-web.project-hub-groups-collection",
        "application.contribution": "ms.vss-web.account-hub-groups-collection",
        "admin.project": "ms.vss-web.project-admin-hub-groups-collection",
        "admin.collection": "ms.vss-web.collection-admin-hub-groups-collection",
        "admin.application": "ms.vss-web.account-admin-hub-groups-collection",
        "home": "ms.vss-web.home-hub-group",
        "home.application": "ms.vss-web.account-home-hub-group",
        "source": "ms.vss-code-web.code-hub-group",
        "workitems": "ms.vss-work-web.work-hub-group",
        "build": "ms.vss-build-web.build-hub-group",
        "test": "ms.vss-test-web.test-hub-group"
    };
    ToM85.contributionTypeMap = {
        "vss.work.web#workItemActions": "ms.vss-web.menu",
        "vss.work.web#workItemToolbarActions": "ms.vss-web.menu",
        "vss.work.web#queryActions": "ms.vss-web.menu",
        "vss.work.web#sprintBoardPivotFilters": "ms.vss-web.menu",
        "vss.work.web#backlogsBoardPivotFilters": "ms.vss-web.menu",
        "vss.work.web#backlogItemActions": "ms.vss-web.menu",
        "vss.code.web#gitBranchesSummaryGrid": "ms.vss-web.menu",
        "vss.code.web#gitBranchDiffActions": "ms.vss-web.menu",
        "vss.code.web#sourceItemActions": "ms.vss-web.menu",
        "vss.code.web#changeExplorerActions": "ms.vss-web.menu",
        "vss.code.web#changeListSummaryItemActions": "ms.vss-web.menu",
        "vss.code.web#sourceGridItemActions": "ms.vss-web.menu",
        "vss.code.web#sourceTreeItemActions": "ms.vss-web.menu",
        "vss.code.web#gitBranchActions": "ms.vss-web.menu",
        "vss.build.web#buildDefinitionActions": "ms.vss-web.menu",
        "vss.build.web#completedBuildActions": "ms.vss-web.menu",
        "vss.test.web#testRunGridActions": "ms.vss-web.menu",
        "vss.test.web#testRunActions": "ms.vss-web.menu",
        "vss.web#hubGroups.project": "ms.vss-web.hub-group",
        "vss.web#hubGroups.application": "ms.vss-web.hub-group",
        "vss.web#hubGroups.admin.project": "ms.vss-web.hub-group",
        "vss.web#hubGroups.admin.collection": "ms.vss-web.hub-group",
        "vss.web#hubGroups.admin.application": "ms.vss-web.hub-group",
        "vss.web#hubs": "ms.vss-web.hub",
        "vss.web#control": "ms.vss-web.control",
        "vss.web#service": "ms.vss-web.service",
        "vss.dashboards.web#widget: ": "ms.vss-dashboards-web.dashboard-catalog"
    };
    ToM85.idCounts = {};
    return ToM85;
})();
exports.ToM85 = ToM85;
