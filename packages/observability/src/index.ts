export const correlationId=(v?:string)=>v??crypto.randomUUID(); export const log=(event:string,data:Record<string,unknown>={})=>console.log(JSON.stringify({event,...data}));
