import {z} from 'zod';
import contracts from '../../contracts/contact-schemas.json' with {type:'json'};
export type Field='name'|'email'|'company'|'joined_at'|'phone';
export type FieldDefinition={key:Field;label:string;type:string;required:boolean;description:string;maxLength:number};
export const schemaVersions=contracts.schemas as {version:number;name:string;fields:FieldDefinition[]}[];
export const fields=schemaVersions[0].fields;
export const fieldsFor=(version:number)=>{const schema=schemaVersions.find(s=>s.version===version);if(!schema)throw Error('Unsupported schema version.');return schema.fields;};
export const mappingSchema=z.object({name:z.string().min(1),email:z.string().min(1),company:z.string().optional(),joined_at:z.string().optional(),phone:z.string().optional()}).strict().refine(m=>{const v=Object.values(m).filter(Boolean);return new Set(v).size===v.length;},'Each source column can be mapped only once.');
export const transformsSchema=z.object({name:z.enum(['none','collapse_spaces']).optional(),company:z.enum(['none','collapse_spaces']).optional(),phone:z.enum(['none','strip_phone_formatting']).optional()}).strict();
export type Mapping=z.infer<typeof mappingSchema>;
export type Counts=Record<string,number>;
export type Job={id:string;file_name:string;file_bytes:string;file_hash:string;file_format:string;status:string;headers:string[];mapping:Partial<Mapping>;mapping_version:number;schema_version:number;schema_hash:string;destination:'local'|'test-api';transformations:Record<string,string>;total_rows:number;parse_checkpoint:number;validation_checkpoint:number;commit_checkpoint:number;counts:Counts;created_at:string;updated_at:string;approved_at:string|null;last_error:string|null;attempts:number;delivery_counts?:Counts};
export type ImportRow={row_no:number;raw:Record<string,string>;normalized:Record<string,string>|null;disposition:string;errors:string[];committed:boolean};
export type Session={user:{id:string;name:string;email:string};organizations:{id:string;name:string;slug:string;role:string}[];demo:boolean};
export type JobEvent={id:string;kind:string;message:string;created_at:string};
export const stateLabels:Record<string,string>={parsing:'Reading file',mapping:'Needs mapping',validating:'Validating',review:'Ready for review',queued:'Queued',running:'Importing',paused:'Paused',completed:'Completed',cancelled:'Cancelled',failed:'Needs attention'};
export function csvCell(value:unknown){let s=value==null?'':String(value);if(/^[\s]*[=+\-@]|^[\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
