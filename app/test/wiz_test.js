// jsdom regression for the data-stream wizard: intents, recognition tiers, mapping suggestions, processors, templates, navigation.
const {JSDOM, VirtualConsole} = require("jsdom"); const fs = require("fs"); const nodeCrypto = require("crypto");
const html = fs.readFileSync(__dirname + "/../analytics-hub.html", "utf8").replace(/<script src="https:[^"]+"><\/script>/, "").replace(/<link[^>]+fonts[^>]*>/g, "");
const errors = []; const vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(String(e.message || e).slice(0, 300))); vc.on("error", (...a) => errors.push("console.error " + a.map(String).join(" ").slice(0, 300)));
const dom = new JSDOM(html, {runScripts: "dangerously", url: "https://example.test/#uploads", virtualConsole: vc, beforeParse(w) { w.XLSX = require("xlsx"); w.confirm = () => true; w.prompt = () => ""; if (!w.crypto || !w.crypto.subtle) { Object.defineProperty(w, "crypto", {value: nodeCrypto.webcrypto, configurable: true}); } }});
const w = dom.window;
w.eval(`DB = {doc: () => ({set: async () => {}})}; USER={id:"u1",name:"Joe Benson",owner:true}; window.claude = {use: async () => null};`);
const D = JSON.parse(fs.readFileSync(__dirname + "/seed.json", "utf8"));
w.__D = D; w.eval(`for (const k in window.__D) { if (!S[k]) S[k] = []; S[k].push(...window.__D[k]); }`);
const text = sel => w.document.querySelector(sel)?.textContent || "";
const tick = () => new Promise(r => setTimeout(r, 0));
(async () => { try {
  const out = {};
  w.eval(`$("#ro").style.display="none"; render();`);
  // 1. navigation: Data streams appears in Plan, Measure and Deliver sidebars and keeps the group it was opened from
  w.eval(`V.navGroup = "Measure"; location.hash = "uploads"; render();`); await tick();
  out.nav_measure = {group: w.eval(`GROUP_OF("uploads")`), area: w.document.documentElement.dataset.area, sidebar: [...w.document.querySelectorAll("#nav a[data-nav]")].map(a => a.dataset.nav)};
  w.eval(`V.navGroup = "Plan"; render();`); out.nav_plan = {group: w.eval(`GROUP_OF("uploads")`), area: w.document.documentElement.dataset.area, has: [...w.document.querySelectorAll("#nav a[data-nav]")].map(a => a.dataset.nav).includes("uploads")};
  w.eval(`V.navGroup = "Deliver"; render();`); out.nav_deliver = {group: w.eval(`GROUP_OF("uploads")`), has: [...w.document.querySelectorAll("#nav a[data-nav]")].map(a => a.dataset.nav).includes("uploads")};
  out.h1 = text("#main h1"); out.stageTiles = w.document.querySelectorAll(".dstage").length; out.intentCards = w.document.querySelectorAll(".optcard[data-w=intent]").length;
  // 2. Reports page defaults to the Data streams tab
  w.eval(`V.repTab = null; location.hash = "reports"; render();`); out.reports_default = {tiles: w.document.querySelectorAll(".dstage").length, tabs: [...w.document.querySelectorAll("#main [data-a=rep_tab]")].map(b => b.textContent.trim()).slice(0, 5)};
  w.eval(`location.hash = "uploads"; render();`);
  // helper: run an upload through the wizard from text
  const cid = w.eval(`live("clients").find(c => c.client_name === "Cboe")?.id || live("clients")[0].id`); const alpha = w.eval(`live("mplans").find(m => m.id === "plan_alpha_pltp_v1")`);
  async function run(intent, name, csv, before) { w.eval(`wizReset(${JSON.stringify(intent)}); V.wiz.client_id = ${JSON.stringify(before?.client_id || cid)}; V.wiz.campaign_id = ${JSON.stringify(before?.campaign_id || "")}; V.wiz.name = ${JSON.stringify(name)}; V.wiz.file = null; render();`); if (before?.pre) w.eval(before.pre); w.__csv = csv; await w.eval(`wizLoadText(V.wiz, window.__csv)`); await tick(); return w.eval(`(() => { const W = V.wiz; return {stage: W.stage, tier: W.rec?.tier, platform: W.platform, mapping: W.mapping, conf: W.conf, missing: wizMissing(W), error: W.error, summary: W.result?.summary, kind: W.result?.kind, opts: W.opts, tpl: W.tpl ? {name: W.tpl.name, version: W.tpl.version, client_id: W.tpl.client_id} : null}; })()`); }
  // 3. unknown source → define platform → suggested mapping → process (starter QA) → template saved
  const csvA = "Day,Publisher Line,Served Imps,Total Clicks,Media Cost\n2026-09-01,Bloomberg_NEWS_P0001,1000,10,100\n2026-09-02,Bloomberg_NEWS_P0001,1200,12,120\n2026-09-02,Reuters_DISP_P0002,800,4,50\n";
  out.qa1 = await run("qa", "vendor_weekly.csv", csvA); out.qa1_stage3 = w.document.querySelectorAll(".optcard[data-w=plat]").length;
  w.eval(`wizPickPlatform(V.wiz, "custom", "Nexxen weekly"); render();`); out.qa1_map = w.eval(`({stage: V.wiz.stage, mapping: V.wiz.mapping, missing: wizMissing(V.wiz), rows: document.querySelectorAll("table.wizmap tbody tr").length, selects: document.querySelectorAll("[data-wmap]").length})`);
  // map the placement column by hand (fuzzy "line" alias may or may not fire) then process
  w.eval(`V.wiz.mapping["Publisher Line"] = "placement"; V.wiz.conf["Publisher Line"] = "manual"; V.wiz.mapping["Day"] = "date"; V.wiz.mapping["Served Imps"] = "impressions"; V.wiz.mapping["Total Clicks"] = "clicks"; V.wiz.mapping["Media Cost"] = "cost"; V.wiz.tplName = "Nexxen weekly · QA"; render();`);
  await w.eval(`wizProcess(V.wiz)`); await tick(); out.qa1_done = w.eval(`({stage: V.wiz.stage, error: V.wiz.error, kind: V.wiz.result?.kind, summary: V.wiz.result?.summary, status: V.wiz.result?.status, tpl: V.wiz.tpl && {name: V.wiz.tpl.name, version: V.wiz.tpl.version, client_id: V.wiz.tpl.client_id, platform: V.wiz.tpl.platform, platform_label: V.wiz.tpl.platform_label, mapped: Object.keys(V.wiz.tpl.mapping).length}, uploads: live("uploads").filter(u => u.intent).length, tpls: live("upload_templates").length, listRows: document.querySelectorAll("#main .card table tbody tr").length})`);
  // 4. same columns again (different bytes) → known template → auto-processed, no mapping step
  const csvA2 = csvA.replace("2026-09-01", "2026-09-08").replace("1000", "1500");
  out.qa2 = await run("qa", "vendor_weekly_wk2.csv", csvA2); out.qa2_uses = w.eval(`live("upload_templates")[0].uses`);
  // 5. same source with a NEW column → variant → mapping stage with the new field flagged; template v2 on confirm
  const csvA3 = "Day,Publisher Line,Served Imps,Total Clicks,Media Cost,Viewable Imps\n2026-09-15,Bloomberg_NEWS_P0001,1000,10,100,700\n";
  out.qa3 = await run("qa", "vendor_weekly_wk3.csv", csvA3); out.qa3_ui = w.eval(`({newRows: document.querySelectorAll("table.wizmap tr.new").length, recLine: document.querySelector("#main .find")?.textContent.slice(0, 120)})`);
  w.eval(`V.wiz.mapping["Viewable Imps"] = "viewable_impressions"; V.wiz.conf["Viewable Imps"] = "manual";`); await w.eval(`wizProcess(V.wiz)`); await tick(); out.qa3_done = w.eval(`({error: V.wiz.error, tpl: V.wiz.tpl && {name: V.wiz.tpl.name, version: V.wiz.tpl.version}, tpls: live("upload_templates").length})`);
  // 6. Comscore export → platform recognised → interpret with (000) scaling → report saved
  const csvC = "Media,Unique Audience (000),% Reach,Frequency,Duplicated Audience (000),Total Digital Population (000)\nBloomberg,120,1.2,3.1,40,10000\nReuters,80,0.8,2.5,30,10000\nWSJ,60,0.6,2.2,25,10000\n";
  out.cs = await run("interpret", "comscore_sep.csv", csvC); out.cs_scale = w.eval(`V.wiz.scale`);
  await w.eval(`wizProcess(V.wiz)`); await tick(); out.cs_done = w.eval(`({error: V.wiz.error, kind: V.wiz.result?.kind, summary: V.wiz.result?.summary, reports: live("reports").filter(r => r.kind === "interpretation" && r.meta?.via === "data stream").length, total: live("reports").find(r => r.meta?.via === "data stream")?.body?.sites?.[0], tplPlatform: V.wiz.tpl?.platform})`);
  // 7. CM360 overlap export recognised by signature (legacy detector) → interpret
  const csvM = "Site (CM360),Unique Reach: Total Reach,Unique Reach: Exclusive Reach,Unique Reach: Duplicate Reach,Impressions\nBloomberg,120000,90000,30000,1500000\nReuters,80000,50000,30000,900000\n";
  out.cm = await run("interpret", "cm360_overlap.csv", csvM); await w.eval(`wizProcess(V.wiz)`); await tick(); out.cm_done = w.eval(`({error: V.wiz.error, summary: V.wiz.result?.summary})`);
  // 8. Meta export → platform meta; R&F inputs into the Alpha plan
  const per0 = w.eval(`(() => { const P = byId("mplans", "plan_alpha_pltp_v1"); const p = rfPeriods(P, "monthly")[0]; return [p.start, p.end]; })()`); const csvF = "Reporting starts,Reporting ends,Campaign name,Impressions,Reach,Frequency,Amount spent (USD)\n" + per0[0] + "," + per0[1] + "," + JSON.stringify(alpha.lines[0].partner) + ",50000,20000,2.5,1200\n";
  out.meta = await run("rf", "meta_apr.csv", csvF, {client_id: alpha.client_id, pre: ``}); w.eval(`V.wiz.opts.plan_id = "plan_alpha_pltp_v1"; V.wiz.opts.rf_source = "meta";`); await w.eval(`wizProcess(V.wiz)`); await tick(); out.meta_done = w.eval(`({error: V.wiz.error, summary: V.wiz.result?.summary, actuals: live("actuals").filter(a => a.plan_id === "plan_alpha_pltp_v1").length})`);
  // 9. Cboe Table export → QA intent recognises the Table contract → four-tier QA run
  const req = w.eval(`CBOE.required`); const rowsT = [["2026-04-01","CM360 Delivery","Pkg","MB1","US","Bloomberg","Brand","ff","CPM","1000","900","950","100000","Closed"],["2026-04-02","CM360 Delivery","Pkg","MB1","US","Bloomberg","Brand","ff","CPM","1000","900","950","100000","Closed"]];
  const csvT = req.join(",") + "\n" + rowsT.map(r => r.join(",")).join("\n") + "\n"; const cboeId = w.eval(`live("clients").find(c => c.client_name === "Cboe")?.id`);
  if (cboeId) { out.cboe = await run("qa", "datorama_table_apr.csv", csvT, {client_id: cboeId}); await tick(); await tick(); out.cboe_done = w.eval(`({stage: V.wiz.stage, noMap: V.wiz.noMap, platform: V.wiz.platform, error: V.wiz.error, kind: V.wiz.result?.kind, summary: V.wiz.result?.summary, runs: live("qa_runs").filter(r => r.file === "datorama_table_apr.csv").length})`); }
  // 10. document intent
  out.doc = await run("document", "brand_guidelines.md", "# Brand guidelines\nUse the blue.\n", {}); w.eval(`V.wiz.opts.doc_kind = "workspace_guide";`); await w.eval(`wizProcess(V.wiz)`); await tick(); out.doc_done = w.eval(`({error: V.wiz.error, summary: V.wiz.result?.summary, docs: live("documents").filter(d => d.file === "brand_guidelines.md").length})`);
  // 11. lists + dictionary render; stage tile back-navigation
  w.eval(`V.wizDict = true; render();`); out.dict = {details: w.document.querySelectorAll(".wizdict details").length, verifiedPills: [...w.document.querySelectorAll(".wizdict .pill")].filter(p => /verified 2026/.test(p.textContent)).length, links: w.document.querySelectorAll(".wizdict a[href^=http]").length};
  out.lists = {streams: [...w.document.querySelectorAll("#main .card")].find(c => /Streams processed/.test(c.textContent))?.querySelectorAll("tbody tr").length, templates: [...w.document.querySelectorAll("#main .card")].find(c => /Templates · client-wide/.test(c.textContent))?.querySelectorAll("tbody tr").length};
  w.eval(`V.wizDict = false; V.wiz.stage = 2; render();`); out.back = {tiles: [...w.document.querySelectorAll(".dstage")].map(t => t.className.replace("dstage ", ""))};
  // 12. export/import roundtrip keeps upload_templates
  out.backupHas = w.eval(`COLS.includes("upload_templates")`);
  console.log(JSON.stringify(out, null, 1)); console.log("ERRORS", errors.slice(0, 8)); process.exit(0);
} catch (e) { console.error("ERR", e.stack); console.log("ERRORS", errors.slice(0, 8)); process.exit(1); } })();
