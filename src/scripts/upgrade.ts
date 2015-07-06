/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
import path = require("path");
import Q = require("q");

export class ToM85 {	
	private static contributionIdMap = {
		// Menus
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
		
		// Hubs
		"vss.web#hubGroups.project": "ms.vss-web.project-hub-groups-collection", 
		"vss.web#hubGroups.application": "ms.vss-web.account-hub-groups-collection", 
		"vss.web#hubGroups.admin.project": "ms.vss-web.project-admin-hub-groups-collection", 
		"vss.web#hubGroups.admin.collection": "ms.vss-web.collection-admin-hub-groups-collection", 
		"vss.web#hubGroups.admin.application": "ms.vss-web.account-admin-hub-groups-collection", 
		// "vss.web#hubs": "ms.vss-web.hub", // special cased
		
		// Dashboards
		"vss.dashboards.web#widget: ": "ms.vss-dashboards-web.dashboard-catalog"
	};
	
	private static hubGroupIdToTargetMap = {
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
	
	private static contributionTypeMap = {
		// Special case... action, hyperlink-action, or action-provider
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
		
		// Hubs
		"vss.web#hubGroups.project": "ms.vss-web.hub-group", 
		"vss.web#hubGroups.application": "ms.vss-web.hub-group", 
		"vss.web#hubGroups.admin.project": "ms.vss-web.hub-group", 
		"vss.web#hubGroups.admin.collection": "ms.vss-web.hub-group", 
		"vss.web#hubGroups.admin.application": "ms.vss-web.hub-group", 
		"vss.web#hubs": "ms.vss-web.hub",
		
		// Other
		"vss.web#control": "ms.vss-web.control",
		"vss.web#service": "ms.vss-web.service",
		
		// Dashboards
		"vss.dashboards.web#widget: ": "ms.vss-dashboards-web.dashboard-catalog"
	};
	
	private srcPath;
	private publisherName;
	
	constructor(srcPath: string, publisherName: string) {
		this.srcPath = srcPath;
		this.publisherName = publisherName;
	}
	
	private actions: {[key: string]: (old: any, upgraded: any) => void} = {
		contributions: (old: any, upgraded: any) => {
			if (!upgraded.contributions) {
				upgraded.contributions = [];
			}
			Object.keys(old.contributions).forEach((contributionPoint: string) => {
				let contributions: any[] = old.contributions[contributionPoint];
				contributions.forEach((contribution) => {
					upgraded.contributions.push(ToM85.convertContribution(contributionPoint, contribution));
				});
			});
		},
		contributionTypes: (old: any, upgraded: any) => {
			if (!upgraded.contributionTypes) {
				upgraded.contributionTypes = [];
			}
			Object.keys(old.contributionTypes).forEach((contributionTypeId: string) => {
				upgraded.contributionTypes.push(ToM85.convertContributionType(contributionTypeId, old.contributionTypes[contributionTypeId]));
			});
		},
		contributionPoints: (old: any, upgraded: any) => {
			// do nothing
		},
		provider: (old: any, upgraded: any) => {
			// do nothing
		},
		namespace: (old: any, upgraded: any) => {
			upgraded.extensionId = old.namespace.replace(/\./g, "-");
		},
		icon: (old: any, upgraded: any) => {
			if (!upgraded.assets) {
				upgraded.assets = [];
			}
			let iconPath = old.icon;
			if (old.baseUri) {
				if (iconPath.indexOf(old.baseUri) === 0) {
					iconPath = iconPath.substr(old.baseUri.length);
				}
			}
			if (iconPath.charAt(0) === "/") {
				iconPath = iconPath.substr(1);
			}
			let fullIconPath = path.resolve(path.dirname(this.srcPath), iconPath);
			if (!fs.existsSync(fullIconPath)) {
				console.log("Warning: Could not find asset " + old.icon + " locally (we tried " + fullIconPath + "). Ensure that the path to this asset is correct relative to the location of this manifest before packaging.");
			}
			upgraded.assets.push({
				type: "Microsoft.VSO.LargeIcon",
				path: iconPath
			});
		}
	};
	
	private static idCounts: {[key: string]: number} = {};
	private static getExtensionId(extId: string): string {
		if (ToM85.idCounts[extId]) {
			return extId + "_" + (++ToM85.idCounts[extId]);
		} else {
			ToM85.idCounts[extId] = 1;
			return extId;
		}
	}
	
	private static pointIdToTarget(pointId: string, contribution: any): string {
		if (pointId === "vss.web#hubs") {
			let group = contribution.groupId || contribution.group;
			if (group && ToM85.hubGroupIdToTargetMap[group]) {
				return ToM85.hubGroupIdToTargetMap[group];
			}
		} else {
			if (pointId.charAt(0) === "#") {
				return "." + pointId.substr(1).replace(/\./g, "-");
			}
			if (ToM85.contributionIdMap[pointId]) {
				return ToM85.contributionIdMap[pointId];
			}
		}
		console.log("Warning: Cannot find appropriate M85 target contribution for contribution point " + pointId + ".");
		if (contribution.group || contribution.groupId) {
			console.log("-- groupId: " + (contribution.group || contribution.groupId));
		}
		return pointId;
	}
	
	private static pointIdToType(pointId: string, contribution: any): string {
		let type;
		if (pointId.charAt(0) === "#") {
			type = "." + pointId.substr(1).replace(/\./g, "-");
		}
		if (ToM85.contributionTypeMap[pointId]) {
			type = ToM85.contributionTypeMap[pointId];
		}
		
		if (type === "ms.vss-web.menu") {
			if (contribution.title || contribution.text || contribution.icon ) {
				type = "ms.vss-web.action";
			} else if (contribution.targetUri) {
				type = "ms.vss-web.hyperlink-action";
			} else {
				type = "ms.vss-web.action-provider";
			}
		}
		
		if (!type) {
			console.log("Warning: Cannot find appropriate M85 contribution type for contribution point " + pointId + ".");
		}
		return type;
	}
	
	private static convertContribution(pointId: string, contribution: any): any {
		let newContribution = <any>{id: null, targets: [ToM85.pointIdToTarget(pointId, contribution)], type: ToM85.pointIdToType(pointId, contribution), properties: {}};
		Object.keys(contribution).forEach((oldContributionProperty: string) => {
			switch (oldContributionProperty) {
				case "id":
					newContribution.id = ToM85.getExtensionId(contribution.id);
					break;
				case "usesSdk":
				case "fullPage":
				case "groupId":
					// these are no longer used.
					break;
				default:
					newContribution.properties[oldContributionProperty] = contribution[oldContributionProperty];
					break;
			}
		});
		if (newContribution.type === "ms.vss-web.action" || newContribution.type === "ms.vss-web.action-provider") {
			if (newContribution.id !== contribution.id) {
				// If this is an action contribution and we had to number the contribution id, add a registeredObjectId property
				newContribution.properties["registeredObjectId"] = contribution.id; 
			}
		}
		if (!newContribution.id) {
			console.log("Warning: No ID for contribution made to " + pointId + ".");
		}
		return newContribution;
	}
	
	private static convertContributionType(typeId: string, contributionType: any): any {
		return <any>{id: typeId, name: contributionType.title, description: contributionType.description, properties: contributionType.properties}
	}
	
	public execute(outputPath: string): Q.Promise<any> {
		return Q.nfcall(fs.readFile, this.srcPath, "utf8").then((contents: string) => {
			let old: any;
			
			// BOM check
			let jsonData = contents.replace(/^\uFEFF/, "");
			old = JSON.parse(jsonData);
			
			// Set some properties to null to force a property order
			let upgraded = <any>{manifestVersion: null, id: null, version: null, publisher: null};
			upgraded.publisher = this.publisherName;
			
			if (_.isObject(old)) {
				if (_.isArray(old.contributions)) {
					throw "This manifest appears to already be upgraded to M85!";
				}
				var oldKeys = Object.keys(old);
				oldKeys.forEach((oldKey: string) => {
					if (this.actions[oldKey]) {
						this.actions[oldKey](old, upgraded);
					} else {
						upgraded[oldKey] = old[oldKey];
					}
				});
			} else {
				throw "Input is not a valid manifest";
			}
			if (!upgraded.manifestVersion) {
				upgraded.manifestVersion = 1.0;
			}
			return upgraded;
		}).then((upgraded) => {
			console.log("Writing to " + outputPath + "...");
			var eol = require("os").EOL;
			return Q.nfcall(fs.writeFile, outputPath, JSON.stringify(upgraded, null, 4).replace(/\n/g, eol));
		});
	}
}