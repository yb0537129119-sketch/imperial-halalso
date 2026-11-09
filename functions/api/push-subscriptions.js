import { sendPushToAll } from "./_push.js";
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function onRequestPost({request,env}){
 if(request.headers.get("x-admin-password")!==(env.ADMIN_PASSWORD||"5555"))return json({success:false,error:"Unauthorized"},401);
 if(!env.DB)return json({success:false,error:"D1 binding DB is missing"},503);
 let sub;try{sub=await request.json();}catch{return json({success:false,error:"Invalid JSON"},400);}
 if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth)return json({success:false,error:"Invalid subscription"},400);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, subscription_json TEXT NOT NULL, created_at TEXT NOT NULL)").run();
 await env.DB.prepare("INSERT INTO push_subscriptions(endpoint,subscription_json,created_at) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET subscription_json=excluded.subscription_json").bind(String(sub.endpoint).slice(0,2000),JSON.stringify(sub),new Date().toISOString()).run();
 return json({success:true});
}
export async function onRequestDelete({request,env}){
 if(request.headers.get("x-admin-password")!==(env.ADMIN_PASSWORD||"5555"))return json({success:false,error:"Unauthorized"},401);
 let d;try{d=await request.json();}catch{return json({success:false,error:"Invalid JSON"},400);}
 if(!d.endpoint)return json({success:false,error:"Missing endpoint"},400);
 await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(String(d.endpoint).slice(0,2000)).run();return json({success:true});
}
export async function onRequestGet({request,env}){
 if(request.headers.get("x-admin-password")!==(env.ADMIN_PASSWORD||"5555"))return json({success:false,error:"Unauthorized"},401);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, subscription_json TEXT NOT NULL, created_at TEXT NOT NULL)").run();
 const {results=[]}=await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").all();return json({success:true,count:results[0]?.count||0});
}
export async function onRequestPut({request,env}){
 if(request.headers.get("x-admin-password")!==(env.ADMIN_PASSWORD||"5555"))return json({success:false,error:"Unauthorized"},401);
 const result=await sendPushToAll(env,{title:"אולמי אימפריאל",body:"התראות הפעילות בהצלחה! זהו מסר ניסיון.",url:"/"});return json({success:true,sent:result.sent});
}
