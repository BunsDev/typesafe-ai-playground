import type { RunPayload } from '../lib/api';
export interface Question {id:string;label:string;type:'noul'|'choice'|'score';instructions:string;enabled:boolean;selected:boolean;criteria?:Record<string,string>|string[]}
export interface Example {id:string;title:string;category:string;collection:string;description:string;state:unknown;questions:Question[];tryThis:string;custom?:boolean;comparison?:{path:string[];value:unknown;labelA:string;labelB:string};test?:{kind:string;note:string;expectedA?:Record<string,string>;expectedB?:Record<string,string>}}
export interface Draft {stateText:string;stateMode:string;questions:Question[]}
export function catalogExamples(catalog:unknown):Example[];
export function draftFor(example:Example):Draft;
export function buildPayload(text:string,questions:Question[],model?:string,mode?:string):RunPayload;
export function comparisonState(state:unknown,comparison:Example['comparison']):unknown;
export function parseState(text:string,mode?:string):unknown;
export function importExamples(raw:string,ids?:string[]):Example[];
export function exportExamples(examples:Example[],drafts?:Record<string,Draft>):unknown;
