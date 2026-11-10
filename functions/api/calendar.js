const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const esc=v=>String(v??"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
const dateOnly=v=>{const s=String(v||"").slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.replace(/-/g,""):null;};
export async function onRequestGet({request,env}){
 const token=new URL(request.url).searchParams.get("token");
 if(!env.CALENDAR_FEED_TOKEN||!token||token!==env.CALENDAR_FEED_TOKEN)return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
 if(!env.DB)return json({success:false,error:"DB binding unavailable"},503);
 const {results=[]}=await env.DB.prepare("SELECT id,order_number,status,customer_name,customer_phone,event_type,event_date,guests,location,address,notes FROM imperial_orders WHERE event_date IS NOT NULL AND event_date <> '' ORDER BY event_date ASC").all();
 const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
 const events=results.filter(r=>r.event_type!=="בקשת חזרה"&&!String(r.id||"").startsWith("lead-")).flatMap(r=>{
  const start=dateOnly(r.event_date);if(!start)return[];
  const title=[r.event_type||"אירוע",r.customer_name||"לקוח"].join(" — ");
  const desc=["הזמנה #"+r.order_number,"לקוח: "+(r.customer_name||""),"טלפון: "+(r.customer_phone||""),"מוזמנים: "+(r.guests||"לא צוין"),"סטטוס: "+(r.status||"חדש"),"הערות: "+(r.notes||"")].join("\n");
  return [["BEGIN:VEVENT","UID:"+esc(r.id)+"@imperial-halls","DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+start,"SUMMARY:"+esc(title),"DESCRIPTION:"+esc(desc),"LOCATION:"+esc([r.location,r.address].filter(Boolean).join(" — ")),"STATUS:"+(r.status==="בוטל"?"CANCELLED":"CONFIRMED"),"END:VEVENT"].join("\r\n")];
 });
 const body=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Imperial Halls//Event Calendar//HE","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:יומן אירועים — אימפריאל","X-WR-TIMEZONE:Asia/Jerusalem",...events,"END:VCALENDAR",""].join("\r\n");
 return new Response(body,{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":"inline; filename=imperial-events.ics","cache-control":"no-store, no-cache, must-revalidate","access-control-allow-origin":"*"}});
}
