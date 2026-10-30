import crypto from 'node:crypto';
export const pkString=(row,keys)=>JSON.stringify(keys.map(k=>String(row[k])));
const safeValue=value=>{
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return `hex:${value.toString('hex')}`;
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,safeValue(v)]));
  if (Array.isArray(value)) return value.map(safeValue);
  return value;
};
export const canonical=value=>JSON.stringify(safeValue(value));
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export const compareTable=(sourceRows,targetRows,pk)=>{
  const src=new Map(),dst=new Map();
  for(const row of sourceRows) { const k=pkString(row,pk);if(src.has(k))throw new Error('Duplicate source primary key');src.set(k,sha256(canonical(row))); }
  for(const row of targetRows) { const k=pkString(row,pk);if(dst.has(k))throw new Error('Duplicate target primary key');dst.set(k,sha256(canonical(row))); }
  let sourceOnly=0,targetOnly=0,changed=0;
  for(const [k,h] of src){if(!dst.has(k))sourceOnly++;else if(dst.get(k)!==h)changed++;}
  for(const k of dst.keys())if(!src.has(k))targetOnly++;
  return {source_count:src.size,target_count:dst.size,source_only:sourceOnly,target_only:targetOnly,changed,match:sourceOnly===0&&targetOnly===0&&changed===0,
    source_digest:sha256([...src].sort(([a],[b])=>a.localeCompare(b)).map(([k,h])=>k+'='+h).join('\n')),
    target_digest:sha256([...dst].sort(([a],[b])=>a.localeCompare(b)).map(([k,h])=>k+'='+h).join('\n'))};
};
