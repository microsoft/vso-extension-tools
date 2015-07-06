declare module "inquirer" {
	
	module I {
		export interface Question {
			type: string;
			name: string;
			message: string|((answers: Answers) => string);
			default: string|number|string[]|number[]|((answers: Answers) => string|number|string[]|number[]|void);
			choices: string[]|((answers: Answers) => string[]);
			validate: (input: number|string) => boolean|void;
			filter: <T extends number|string>(input: T) => T|void; 
			when: (answers: Answers) => boolean|void;
		}
		export interface Answers {
			[questionName: string]: boolean|string;
		}
		export interface AnswerCallback {
			
		}
		export interface Separator {
			new (str: string): string;
		}
		
		export function prompt(questions: Question[], callback: AnswerCallback);
		export var Separator: Separator;
	}

	export = I;
}
