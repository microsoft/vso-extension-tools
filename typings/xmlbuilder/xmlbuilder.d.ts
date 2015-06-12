// Type definitions for xmlbuilder 2.6.4
// Definitions by: Trevor Gau <http://github.com/trevorsg>

declare module "xmlbuilder" {
	interface Builder {
		create: (root: string | {[key: string]: any}) => Node;
	}
	
	interface EndOptions {
		pretty: boolean;
		indent: string;
		newLine: string;
	}
	
	interface Node {
		element: (name: string | {[key: string]: any}, attributes?: {[attrName: string]: string}, value?: string) => Node;
		ele: (name: string | {[key: string]: any}, attributes?: {[attrName: string]: string}, value?: string) => Node;
		e: (name: string | {[key: string]: any}, attributes?: {[attrName: string]: string}, value?: string) => Node;
		
		remove: () => Node;
		
		insertBefore: (name: string | {[key: string]: any}, attributes?: {[attrName: string]: string}, value?: string) => Node;
		insertAfter: (name: string | {[key: string]: any}, attributes?: {[attrName: string]: string}, value?: string) => Node;
		
		attribute: (attrName: string, attrValue: string) => Node;
		att: (attrName: string, attrValue: string) => Node;
		removeAttribute: (attrName: string) => Node;
		
		text: (textValue: string) => Node;
		txt: (textValue: string) => Node;
		t: (textValue: string) => Node;
		
		raw: (textValue: string) => Node;
		r: (textValue: string) => Node;
		
		cdata: (data: string) => Node;
		dat: (data: string) => Node;
		
		comment: (comment: string) => Node;
		com: (comment: string) => Node;
		
		instruction: (elem: string, attrs: string) => Node;
		ins: (elem: string, attrs: string) => Node;
		
		up: () => Node;
		prev: () => Node;
		next: () => Node;
		root: () => Node;
		doc: () => Node;
		
		end: (options: EndOptions) => string;
	}
}
