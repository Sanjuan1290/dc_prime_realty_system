import {problem,phpCents,pesos} from './domain.js';
import {sha256} from './importContract.js';

export const categoryName=row=>{
  const name=String(row.category??'').trim();
  if(!name||name.length>200)throw problem('INVALID_CATEGORY','The file contains an empty or oversized category.',422);
  return name;
};
export const categoryKey=(kind,name)=>`${kind}\u0000${name.trim().toLowerCase()}`;
export const importDecision=(row,existing)=>{
  if(!existing)return 'new';
  if(existing.source_revision_sha256!==row.source_revision_sha256)return 'conflict';
  if(existing.status==='void')return String(existing.void_reason||'').startsWith('Import undone:')?'restore':'conflict';
  return 'duplicate';
};
export function summarizeUndo(batch,rows){
  let income=0n,expense=0n,removed=0,kept=0,alreadyRemoved=0;
  for(const row of rows){
    if(Number(row.other_imports)>0){kept++;continue;}
    if(row.status!=='posted'){alreadyRemoved++;continue;}
    removed++;
    if(row.kind==='income')income+=phpCents(row.amount);else expense+=phpCents(row.amount);
  }
  const impact={removed,kept,already_removed:alreadyRemoved,money_in_removed:pesos(income),money_out_removed:pesos(expense),balance_change:pesos(expense-income)};
  const state=rows.map(row=>[String(row.id),row.status,row.source_revision_sha256,Number(row.other_imports),row.kind,String(row.amount)]);
  return {batch_id:batch.id,file_name:batch.file_name,status:batch.status,impact,review_token:sha256(JSON.stringify([batch.id,batch.status,state]))};
}
