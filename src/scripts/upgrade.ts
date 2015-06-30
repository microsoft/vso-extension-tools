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
		"vss.web#hubs": "ms.vss-web.hub",
		
		// Dashboards
		"vss.dashboards.web#widget: ": "ms.vss-dashboards-web.dashboard-catalog"
	}
	
	private static contributionTypeMap = {
		"vss.work.web#workItemActions": "ms.vs-web.menu",
		"vss.work.web#workItemToolbarActions": "ms.vs-web.menu",
		"vss.work.web#queryActions": "ms.vs-web.menu",
		"vss.work.web#sprintBoardPivotFilters": "ms.vs-web.menu",
		"vss.work.web#backlogsBoardPivotFilters": "ms.vs-web.menu",
		"vss.work.web#backlogItemActions": "ms.vs-web.menu",
		"vss.code.web#gitBranchesSummaryGrid": "ms.vs-web.menu",
		"vss.code.web#gitBranchDiffActions": "ms.vs-web.menu",
		"vss.code.web#sourceItemActions": "ms.vs-web.menu",
		"vss.code.web#changeExplorerActions": "ms.vs-web.menu",
		"vss.code.web#changeListSummaryItemActions": "ms.vs-web.menu",
		"vss.code.web#sourceGridItemActions": "ms.vs-web.menu",
		"vss.code.web#sourceTreeItemActions": "ms.vs-web.menu",
		"vss.code.web#gitBranchActions": "ms.vs-web.menu",
		"vss.build.web#buildDefinitionActions": "ms.vs-web.menu",
		"vss.build.web#completedBuildActions": "ms.vs-web.menu",
		"vss.test.web#testRunGridActions": "ms.vs-web.menu",
		"vss.test.web#testRunActions": "ms.vs-web.menu",
		
		// Hubs
		"vss.web#hubGroups.project": "ms.vs-web.hubgroup", 
		"vss.web#hubGroups.application": "ms.vs-web.hubgroup", 
		"vss.web#hubGroups.admin.project": "ms.vs-web.hubgroup", 
		"vss.web#hubGroups.admin.collection": "ms.vs-web.hubgroup", 
		"vss.web#hubGroups.admin.application": "ms.vs-web.hubgroup", 
		"vss.web#hubs": "ms.vss-web.hub",
		
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
				let contributionType: any = old.contributionTypes[contributionTypeId];
				contributionType.id = contributionTypeId;
				upgraded.contributionTypes.push(contributionType);
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
	
	private static pointIdToTarget(pointId: string): string {
		if (pointId.charAt(0) === "#") {
			return "." + pointId.substr(1).replace(/\./g, "-");
		}
		if (ToM85.contributionIdMap[pointId]) {
			return ToM85.contributionIdMap[pointId];
		}
		console.log("Warning: Cannot find appropriate M85 target contribution for contribution point " + pointId + ".");
		return pointId;
	}
	
	private static pointIdToType(pointId: string): string {
		if (pointId.charAt(0) === "#") {
			return "." + pointId.substr(1).replace(/\./g, "-");
		}
		if (ToM85.contributionTypeMap[pointId]) {
			return ToM85.contributionTypeMap[pointId];
		}
		console.log("Warning: Cannot find appropriate M85 contribution type for contribution point " + pointId + ".");
	}
	
	private static convertContribution(pointId: string, contribution: any): any {
		let newContribution = <any>{id: null, targets: [ToM85.pointIdToTarget(pointId)], type: ToM85.pointIdToType(pointId), properties: {}};
		Object.keys(contribution).forEach((oldContributionProperty: string) => {
			switch (oldContributionProperty) {
				case "id":
					newContribution.id = contribution.id;
					break;
				default:
					newContribution.properties[oldContributionProperty] = contribution[oldContributionProperty];
					break;
			}
		});
		if (!newContribution.id) {
			console.log("Warning: No ID for contribution made to " + pointId + ".");
		}
		return newContribution;
	}
	
	public execute(outputPath: string): Q.Promise<any> {
		return Q.nfcall(fs.readFile, this.srcPath, "utf8").then((contents: string) => {
			let old: any;
			
			// BOM check
			if (contents[0] !== "{") {
				old = JSON.parse(contents.substr(1));
			} else {
				old = JSON.parse(contents);
			}
			let upgraded = <any>{};
			if (_.isObject(old)) {
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
			upgraded.publisher = this.publisherName;
			if (!upgraded.manifestVersion) {
				upgraded.manifestVersion = "1.0";
			}
			return upgraded;
		}).then((upgraded) => {
			console.log("Writing to " + outputPath + "...");
			return Q.nfcall(fs.writeFile, outputPath, JSON.stringify(upgraded, null, 4));
		});
	}
}