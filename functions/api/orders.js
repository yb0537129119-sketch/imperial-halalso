import { sendPushToAll } from "./_push.js";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const clean = (v, n = 2000) => String(v ?? "").slice(0, n);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ success: false, error: "D1 binding DB is missing" }, 503);
  let d;
  try { d = await request.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }
  if (d.lead === true) {
    if (!d.name || !d.phone) return json({success:false,error:"יש למלא שם וטלפון"},400);
    const id = "lead-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
    const orderNumber = Date.now();
    const createdAt = new Date().toISOString();
    const topic = clean(d.topic || "בקשה לשיחה עם נציג", 300);
    const notes = clean(d.notes || "", 1500);
    try {
      await env.DB.prepare(`INSERT INTO imperial_orders
        (id, order_number, created_at, status, customer_name, customer_phone, customer_email, event_type, event_date, guests, location, address, notes, items_json, contract_json)
        VALUES (?, ?, ?, 'חדש', ?, ?, '', 'בקשת חזרה', NULL, NULL, ?, '', ?, '[]', NULL)`)
        .bind(id, orderNumber, createdAt, clean(d.name,120), clean(d.phone,40), topic, notes).run();
    } catch (e) { return json({success:false,error:"D1 insert failed: "+clean(e.message,300)},500); }
    try { await sendPushToAll(env,{title:"בקשת חזרה חדשה — אולמי אימפריאל",body:clean(d.name,100)+" · "+clean(d.phone,40),url:"/"}); } catch(e) { /* notification failure must not block lead capture */ }
    let emailSent=false,emailError="";
    if(env.RESEND_API_KEY){
      try {
        const safe=v=>clean(v,1800).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
        const html='<div dir="rtl" style="font-family:Arial;background:#f4efe5;padding:24px;color:#30291f"><div style="max-width:560px;margin:auto;background:#fffdf8;border:1px solid #e5d8c0;border-radius:16px;overflow:hidden"><div style="background:#302719;padding:20px;text-align:center;color:#ffe8b0"><b>IMPERIAL HALLS</b><h2>בקשה חדשה לחזרה ללקוח</h2></div><div style="padding:22px;line-height:2"><b>שם:</b> '+safe(d.name)+'<br><b>טלפון:</b> '+safe(d.phone)+'<br><b>תחום עניין:</b> '+safe(topic)+'<br><b>הערות:</b> '+safe(notes||"אין")+'<br><b>התקבל:</b> '+safe(createdAt)+'</div></div></div>';
        const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:"Imperial Website <onboarding@resend.dev>",to:["yehudaa148@gmail.com"],subject:"בקשת חזרה חדשה — "+clean(d.name,100),html,text:"בקשת חזרה חדשה\\nשם: "+clean(d.name,120)+"\\nטלפון: "+clean(d.phone,40)+"\\nתחום עניין: "+topic+"\\nהערות: "+notes})});
        const result=await mail.json().catch(()=>({}));emailSent=mail.ok;if(!mail.ok)emailError=clean(result.message||result.name||"Resend failed",250);
      } catch(e){emailError=clean(e.message,250);}
    } else emailError="RESEND_API_KEY is not configured";
    return json({success:true,id,emailSent,emailError});
  }
  if (!d.name || !d.phone || !d.email || !d.eventType || !d.date) return json({ success: false, error: "Missing required order fields" }, 400);
  const id = clean(d.id, 80);
  const orderNumber = Number(d.orderNumber);
  if (!id || !Number.isFinite(orderNumber)) return json({ success: false, error: "Invalid order identifier" }, 400);
  const createdAt = clean(d.createdAt, 50) || new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO imperial_orders
      (id, order_number, created_at, status, customer_name, customer_phone, customer_email, event_type, event_date, guests, location, address, notes, items_json, contract_json)
      VALUES (?, ?, ?, 'חדש', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, orderNumber, createdAt, clean(d.name,120), clean(d.phone,40), clean(d.email,200), clean(d.eventType,100), clean(d.date,30), d.guests ? Number(d.guests) : null, clean(d.location,200), clean(d.address,300), clean(d.notes,2000), JSON.stringify(Array.isArray(d.items) ? d.items.slice(0,100) : []), d.contract ? JSON.stringify(d.contract) : null)
      .run();
  } catch (e) {
    return json({ success: false, error: "D1 insert failed: " + clean(e.message, 300) }, 500);
  }
  let emailSent = false, emailError = "";
  if (env.RESEND_API_KEY) {
    try {
      const escHtml = value => clean(value, 3000).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
      const grouped = {};
      (Array.isArray(d.items) ? d.items.slice(0,100) : []).forEach(item => {
        const category = clean(item.category || "מנות", 80);
        (grouped[category] ||= []).push(clean(item.name, 160));
      });
      const info = [
        ["שם הלקוח", d.name], ["טלפון", d.phone], ["מייל", d.email],
        ["סוג האירוע", d.eventType], ["תאריך האירוע", d.date],
        ["מספר מוזמנים", d.guests || "לא צוין"], ["מיקום", d.location || "לא צוין"],
        ["כתובת", d.address || "לא צוין"]
      ];
      const detailsRows = info.map(([label,value]) =>
        '<tr><td style="padding:11px 14px;border-bottom:1px solid #eee7da;color:#80652f;font-weight:700;width:36%">'+escHtml(label)+'</td><td style="padding:11px 14px;border-bottom:1px solid #eee7da;color:#30291f">'+escHtml(value || "—")+'</td></tr>'
      ).join("");
      const menuHtml = Object.keys(grouped).length
        ? Object.entries(grouped).map(([category,names]) =>
            '<div style="padding:13px 15px;border:1px solid #e8ddc9;border-radius:12px;margin:9px 0;background:#fffdf9"><div style="font-weight:800;color:#8b6728;margin-bottom:6px">'+escHtml(category)+'</div><div style="color:#41382c;line-height:1.8">'+names.map(escHtml).join(' · ')+'</div></div>'
          ).join("")
        : '<p style="color:#756b5d">לא נבחרו מנות.</p>';
      const htmlBody = '<div dir="rtl" style="margin:0;background:#f3eee5;padding:24px 10px;font-family:Arial,sans-serif;color:#30291f"><div style="max-width:650px;margin:0 auto;background:#fffdf9;border:1px solid #e2d4bb;border-radius:18px;overflow:hidden"><div style="background:linear-gradient(135deg,#3a3020,#17130d);padding:25px 22px;text-align:center"><div style="color:#e6c783;font-size:12px;letter-spacing:3px">IMPERIAL HALLS</div><h1 style="margin:8px 0 4px;color:#fff0c9;font-size:26px">התקבלה הזמנה חדשה</h1><div style="color:#e5d8bd">סיכום פנייה מאתר אולמי אימפריאל</div><div style="display:inline-block;margin-top:14px;padding:7px 16px;border:1px solid #c5a66d;border-radius:30px;color:#ffe8b0;font-weight:700">הזמנה #'+orderNumber+'</div></div><div style="padding:22px"><h2 style="font-size:17px;color:#8b6728;margin:0 0 10px">פרטי האירוע והלקוח</h2><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee7da;border-radius:12px;overflow:hidden">'+detailsRows+'</table><h2 style="font-size:17px;color:#8b6728;margin:22px 0 8px">בחירת מנות</h2>'+menuHtml+'<div style="margin-top:18px;padding:14px;border-right:4px solid #b58a3b;background:#f6f0e5;border-radius:8px"><b style="color:#765722">הערות מיוחדות</b><div style="margin-top:5px;white-space:pre-wrap">'+escHtml(d.notes || "אין הערות")+'</div></div><div style="margin-top:18px;padding:14px;border:1px solid #e6d8bd;border-radius:12px"><b style="color:#765722">חוזה ותנאים</b><div style="margin-top:5px">'+(d.contract?.accepted ? 'הלקוח אישר את התנאים וחתם דיגיטלית.' : 'לא סומן אישור חוזה.')+'</div>'+(d.contract?.acceptedAt?'<div style="font-size:12px;color:#766b5b;margin-top:4px">מועד אישור: '+escHtml(d.contract.acceptedAt)+'</div>':'')+'</div></div><div style="padding:15px;text-align:center;background:#f7f2e9;color:#847963;font-size:12px">נשלח אוטומטית ממערכת ההזמנות של אולמי אימפריאל</div></div></div>';
      const textLines = [
        "התקבלה הזמנה חדשה מאתר אולמי אימפריאל", "מספר הזמנה: #" + orderNumber,
        ...info.map(([label,value]) => label + ": " + clean(value || "—",300)),
        "הערות: " + clean(d.notes,2000), "מנות:",
        ...Object.entries(grouped).flatMap(([category,names]) => [category, ...names.map(name => "• " + name)])
      ];
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Imperial Website <onboarding@resend.dev>",
          to: ["yehudaa148@gmail.com"],
          subject: "✦ הזמנה חדשה מאולמי אימפריאל #" + orderNumber + " — " + clean(d.name,100),
          html: htmlBody,
          text: textLines.join("\\n")
        })
      });
      const result = await mail.json().catch(() => ({}));
      emailSent = mail.ok;
      if (!mail.ok) emailError = clean(result.message || result.name || "Resend failed", 250);
    } catch (e) { emailError = clean(e.message, 250); }
  } else emailError = "RESEND_API_KEY is not configured";
  return json({ success: true, id, emailSent, emailError });
}

export async function onRequestGet({ request, env }) {
  if (request.headers.get("x-admin-password") !== (env.ADMIN_PASSWORD || "5555")) return json({ success: false, error: "Unauthorized" }, 401);
  if (!env.DB) return json({ success: false, error: "D1 binding DB is missing" }, 503);
  const { results = [] } = await env.DB.prepare("SELECT * FROM imperial_orders ORDER BY created_at DESC LIMIT 500").all();
  return json({ success: true, orders: results.map(r => ({
    id:r.id, orderNumber:r.order_number, createdAt:r.created_at, status:r.status,
    name:r.customer_name, phone:r.customer_phone, email:r.customer_email, eventType:r.event_type,
    date:r.event_date, guests:r.guests, location:r.location, address:r.address, notes:r.notes,
    items:JSON.parse(r.items_json || "[]"), contract:r.contract_json ? JSON.parse(r.contract_json) : null
  }))});
}


export async function onRequestPatch({ request, env }) {
  if (request.headers.get("x-admin-password") !== (env.ADMIN_PASSWORD || "5555")) return json({success:false,error:"Unauthorized"},401);
  if (!env.DB) return json({success:false,error:"D1 binding DB is missing"},503);
  let d; try { d=await request.json(); } catch { return json({success:false,error:"Invalid JSON"},400); }
  const allowed=["חדש","בטיפול","נסגר","בוטל"];
  if (!d.id || !allowed.includes(d.status)) return json({success:false,error:"Invalid id or status"},400);
  const result=await env.DB.prepare("UPDATE imperial_orders SET status = ? WHERE id = ?").bind(d.status,clean(d.id,80)).run();
  if (!result.meta?.changes) return json({success:false,error:"Order not found"},404);
  return json({success:true});
}
export async function onRequestDelete({ request, env }) {
  if (request.headers.get("x-admin-password") !== (env.ADMIN_PASSWORD || "5555")) return json({success:false,error:"Unauthorized"},401);
  if (!env.DB) return json({success:false,error:"D1 binding DB is missing"},503);
  const id=new URL(request.url).searchParams.get("id");
  if (!id) return json({success:false,error:"Missing order id"},400);
  const result=await env.DB.prepare("DELETE FROM imperial_orders WHERE id = ?").bind(clean(id,80)).run();
  if (!result.meta?.changes) return json({success:false,error:"Order not found"},404);
  return json({success:true});
}
