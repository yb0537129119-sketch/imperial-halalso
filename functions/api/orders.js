const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const clean = (v, n = 2000) => String(v ?? "").slice(0, n);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ success: false, error: "D1 binding DB is missing" }, 503);
  let d;
  try { d = await request.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }
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
      const lines = [
        "התקבלה הזמנה חדשה מאתר אולמי אימפריאל",
        "מספר הזמנה: #" + orderNumber,
        "שם: " + clean(d.name,120), "טלפון: " + clean(d.phone,40),
        "מייל לקוח: " + clean(d.email,200), "סוג אירוע: " + clean(d.eventType,100),
        "תאריך: " + clean(d.date,30), "מוזמנים: " + clean(d.guests,20),
        "מיקום: " + clean(d.location,200), "כתובת: " + clean(d.address,300),
        "הערות: " + clean(d.notes,2000), "מנות:",
        ...(Array.isArray(d.items) ? d.items.slice(0,100).map(x => clean(x.category,80) + ": " + clean(x.name,160)) : [])
      ];
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Imperial Website <onboarding@resend.dev>", to: ["yehudaa148@gmail.com"], subject: "הזמנה חדשה מאולמי אימפריאל #" + orderNumber, text: lines.join("\n") })
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
