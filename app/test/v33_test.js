// jsdom regression for v33: top bar, dashboard layout engine, Active reports, QA/Interpret landings, create-user drawer
const {JSDOM, VirtualConsole} = require("jsdom"); const fs = require("fs"); const nodeCrypto = require("crypto");
const html = fs.readFileSync(__dirname + "/../analytics-hub.html", "utf8").replace(/<script src="https:[^"]+"><\/script>/, "").replace(/<link[^>]+fonts[^>]*>/g, "");
const errors = []; const vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(String(e.message || e).slice(0, 300))); vc.on("error", (...a) => errors.push("console.error " + a.map(String).join(" ").slice(0, 300)));
const dom = new JSDOM(html, {runScripts: "dangerously", url: "https://example.test/#dash/Measure", virtualConsole: vc, beforeParse(w) { w.XLSX = require("xlsx"); w.confirm = () => true; w.prompt = () => ""; if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, "crypto", {value: nodeCrypto.webcrypto, configurable: true}); }});
const w = dom.window; const d = w.document;
w.eval(`DB = {doc: () => ({set: async () => {}})}; USER={id:"u1",name:"Joe Benson",owner:true}; window.claude = {use: async () => null};`);
const D = JSON.parse(fs.readFileSync(__dirname + "/seed.json", "utf8"));
w.__D = D; w.eval(`for (const k in window.__D) { if (!S[k]) S[k] = []; S[k].push(...window.__D[k]); }`);
const tick = () => new Promise(r => setTimeout(r, 0)); const $ = s => d.querySelector(s); const $$ = s => [...d.querySelectorAll(s)];
const ev = (el, type, init) => { const e = new w.MouseEvent(type, {bubbles: true, cancelable: true, ...init}); Object.defineProperty(e, "pointerId", {value: 1}); Object.defineProperty(e, "pointerType", {value: "mouse"}); el.dispatchEvent(e); };
(async () => { try {
  const out = {};
  w.eval(`$("#ro").style.display="none"; render();`);
  // 1. top bar
  out.brand = {text: $(".top .brand")?.textContent.trim(), logo: !!$(".top .brand .logo")};
  // 2. dashboards: seeded Measure dashboard migrates to units and renders the free grid
  w.eval(`location.hash = "dash/Measure"; V.dashEdit = false; render();`); await tick();
  out.dash = {free: !!$("#dashgrid.free"), widgets: $$("#dashgrid .widget").length, layout: w.eval(`(dashDoc("Measure")?.widgets || []).map(x => [x.x, x.y, x.w, x.h])`), gridH: $("#dashgrid")?.style.height, styled: $$("#dashgrid .widget").every(el => /left:calc/.test(el.getAttribute("style")))};
  out.overlaps = w.eval(`(() => { const W = dashDoc("Measure").widgets; let n = 0; for (let a = 0; a < W.length; a++) for (let b = a + 1; b < W.length; b++) if (dlOverlap(W[a], W[b])) n++; return n; })()`);
  // edit mode: handles, size cycle, fit, up/down, then a simulated drag (pointer events with tiny geometry)
  w.eval(`V.dashEdit = true; render();`); await tick(); out.edit = {handles: $$("#dashgrid .rz").length, grips: $$("#dashgrid .grip").length, fit: $$('[data-dw="fit"]').length};
  const first = w.eval(`dashDoc("Measure").widgets[0].id`); const before = w.eval(`(() => { const x = dashDoc("Measure").widgets[0]; return [x.x, x.y, x.w, x.h]; })()`);
  $(`[data-dw="size"][data-v="${first}"]`).click(); await tick(); await tick(); const afterSize = w.eval(`(() => { const x = dashDoc("Measure").widgets[0]; return [x.x, x.y, x.w, x.h]; })()`);
  $(`[data-dw="down"][data-v="${first}"]`).click(); await tick(); await tick(); const afterDown = w.eval(`(() => { const x = dashDoc("Measure").widgets.find(y => y.id === "${first}"); return [x.x, x.y, x.w, x.h]; })()`);
  out.actions = {before, afterSize, afterDown, overlaps: w.eval(`(() => { const W = dashDoc("Measure").widgets; let n = 0; for (let a = 0; a < W.length; a++) for (let b = a + 1; b < W.length; b++) if (dlOverlap(W[a], W[b])) n++; return n; })()`)};
  // drag simulation: pointerdown on the corner handle then move; jsdom geometry is 0 so colW = gap/12 and each unit is a few px
  const card = $(`#dashgrid [data-wid="${first}"]`); const se = card.querySelector(".rz.se"); const h0 = w.eval(`dashDoc("Measure").widgets.find(y => y.id === "${first}").h`);
  ev(se, "pointerdown", {clientX: 100, clientY: 100, button: 0}); out.drag = {started: !!w.eval("DLDRAG"), ph: !!$("#dashgrid .wph")};
  ev(d, "pointermove", {clientX: 100 + 22 / 12 * 3 + 1, clientY: 100 + 52 * 2 + 1}); ev(d, "pointerup", {clientX: 100 + 22 / 12 * 3 + 1, clientY: 100 + 52 * 2 + 1}); await tick();
  const after = w.eval(`(() => { const x = dashDoc("Measure").widgets.find(y => y.id === "${first}"); return [x.x, x.y, x.w, x.h]; })()`); out.drag.after = after; out.drag.h0 = h0; out.drag.ended = !w.eval("DLDRAG") && !$("#dashgrid .wph");
  // move drag: title bar
  const bar = card.querySelector(".wdrag"); ev(bar, "pointerdown", {clientX: 50, clientY: 50, button: 0}); ev(d, "pointermove", {clientX: 50, clientY: 50 + 52 * 30}); ev(d, "pointerup", {clientX: 50, clientY: 50 + 52 * 30}); await tick(); await new Promise(r => setTimeout(r, 400));
  out.drag.moved = w.eval(`(() => { const W = dashDoc("Measure").widgets; const x = W.find(y => y.id === "${first}"); let n = 0; for (let a = 0; a < W.length; a++) for (let b = a + 1; b < W.length; b++) if (dlOverlap(W[a], W[b])) n++; return {pos: [x.x, x.y, x.w, x.h], overlaps: n, maxY: Math.max(...W.map(q => q.y + q.h))}; })()`);
  w.eval(`V.dashEdit = false;`);
  // 3. Active reports
  w.eval(`location.hash = "reports"; V.repTab = "active"; render();`); await tick(); out.ar = {tabs: $$(".artabs button").length, client: w.eval("arClient()"), form: !!$("#ar_name")};
  $("#ar_name").value = "Weekly pacing · test"; $("#ar_cad").value = "weekly"; $("#ar_day").value = "2"; $("#ar_time").value = "10:30"; $("#ar_rcpt").value = "client@example.com"; $('[data-ar="save"]').click(); await tick(); await tick(); await tick();
  out.ar.afterWeekly = {rules: w.eval(`live("rules").filter(r => r.kind === "client_report").length`), tasks: w.eval(`live("tasks").filter(t => live("rules").some(r => r.kind === "client_report" && r.id === t.rule_id)).length`), toast: $("#toast")?.textContent};
  $("#ar_name").value = "Monthly wrap · test"; $("#ar_cad").value = "monthly"; $("#ar_cad").dispatchEvent(new w.Event("change", {bubbles: true})); await tick(); $("#ar_day").value = "5"; $('[data-ar="save"]').click(); await tick(); await tick(); await tick();
  out.ar.lists = {weekly: [...$$("#main .card")].find(c => /Weekly reports/.test(c.textContent))?.querySelectorAll("tbody tr").length, monthly: [...$$("#main .card")].find(c => /Monthly reports/.test(c.textContent))?.querySelectorAll("tbody tr").length, monthCells: $$(".armonth .ard").length, chips: $$(".armonth .archip").length};
  $('[data-ar="view"][data-v="week"]').click(); await tick(); out.ar.week = {days: $$(".arweek .ard").length, chips: $$(".arweek .archip").length}; $('[data-ar="nav"][data-v="1"]').click(); await tick(); out.ar.weekNext = $$(".arweek .ard").length; $('[data-ar="view"][data-v="month"]').click(); await tick();
  const rid = w.eval(`live("rules").find(r => r.kind === "client_report").id`); $(`[data-ar="toggle"][data-v="${rid}"]`).click(); await tick(); await tick(); out.ar.paused = w.eval(`byId("rules", "${rid}").active`);
  // 4. QA landing: platform tiles → report tiles → duo + field map; upload through the landing
  w.eval(`V.repTab = "qa"; render();`); await tick(); out.qa = {platforms: $$('.optcard[data-rl="plat"]').length, formGone: !$("#qa_up")};
  $('.optcard[data-rl="plat"][data-v="cm360"]').click(); await tick(); out.qa.rts = $$('.optcard[data-rl="rt"]').map(x => x.dataset.v);
  $('.optcard[data-rl="rt"][data-v="standard"]').click(); await tick(); out.qa.duo = {cards: $$(".rlduo .card").length, drop: !!$("#rl_file_qa"), fieldRows: $$("#main table tbody tr").length, verifiedPill: !![...$$(".pill")].find(p => /report type verified/.test(p.textContent))};
  w.eval(`wizReset("qa"); V.wiz.host = "landing:qa"; V.wiz.presetPlatform = "cm360"; V.wiz.reportType = "standard"; V.wiz.name = "cm360_standard.csv";`);
  await w.eval(`wizLoadText(V.wiz, "Date,Site (CM360),Placement,Impressions,Clicks,Media Cost\\n2026-09-01,Bloomberg,BLM_NEWS_P0001,1000,10,100\\n2026-09-02,Reuters,RTR_DISP_P0002,800,4,50\\n")`); await tick();
  out.qa.wiz = {stage: w.eval("V.wiz.stage"), tier: w.eval("V.wiz.rec.tier"), platform: w.eval("V.wiz.platform"), inline: !!$("#main .dstream"), missing: w.eval("wizMissing(V.wiz)")};
  await w.eval(`wizProcess(V.wiz)`); await tick(); out.qa.done = {error: w.eval("V.wiz.error"), summary: w.eval("V.wiz.result?.summary"), reportType: w.eval(`live("uploads").find(u => u.filename === "cm360_standard.csv")?.report_type`), tplRt: w.eval(`live("upload_templates").find(t => t.platform === "cm360")?.report_type`)};
  w.eval(`wizReset(); render();`); await tick(); out.qa.old = $$(".rlduo table tbody tr").length; $('[data-rl="open"]')?.click(); await tick(); out.qa.opened = !!w.eval("V.rl.qa.open");
  // 5. Interpret landing
  w.eval(`V.repTab = "interpret"; render();`); await tick(); out.interp = {platforms: $$('.optcard[data-rl="plat"]').map(x => x.dataset.v)}; $('.optcard[data-rl="plat"][data-v="comscore"]').click(); await tick(); $('.optcard[data-rl="rt"]').click(); await tick(); out.interp.duo = {cards: $$(".rlduo .card").length, fieldRows: $$("#main table tbody tr").length, old: $$(".rlduo table tbody tr").length};
  // 6. create-user drawer
  w.eval(`location.hash = "settings"; V.setTab = "users"; render();`); await tick(); const btn = $('[data-dr="user_new"]'); out.user = {button: !!btn, disabled: btn?.disabled}; btn?.click(); await tick();
  out.user.form = {wide: $("#drawer")?.classList.contains("wide"), row4: $$("#drawer .row4 .fld").length, row2: $$("#drawer .row2 .fld").length, preview: !!$("#nu_preview")};
  const cl = $('#drawer [data-nu="client"]'); cl.value = cl.options[1].value; cl.dispatchEvent(new w.Event("change", {bubbles: true})); await tick(); out.user.lobs = {all: !!$('#drawer [data-nu="lob_all"]'), boxes: $$('#drawer [data-nu="lob"]').length};
  $('#drawer [data-nu="lob_all"]').click(); await tick(); const boxes = $$('#drawer [data-nu="lob"]'); boxes[0].click(); await tick(); out.user.pick = w.eval("V.nu.lobs");
  const em = $('#drawer [data-nu="email"]'); em.value = "new.person@example.com"; em.dispatchEvent(new w.Event("input", {bubbles: true})); const fn = $('#drawer [data-nu="first"]'); fn.value = "Nadia"; fn.dispatchEvent(new w.Event("input", {bubbles: true})); const ln = $('#drawer [data-nu="last"]'); ln.value = "Ortiz"; ln.dispatchEvent(new w.Event("input", {bubbles: true})); await tick(); out.user.preview = $("#nu_preview").value.slice(0, 40);
  const n0 = w.eval(`live("users").length`); $("#drawer [data-dr-save]").click(); await tick(); await tick(); await tick(); const nu = w.eval(`live("users").find(u => u.email === "new.person@example.com")`); out.user.saved = {added: w.eval(`live("users").length`) - n0, first: nu?.first_name, last: nu?.last_name, name: nu?.name, ws: nu?.access?.workspaces, client: nu?.client, drawerOpen: d.body.classList.contains("drawer-open"), wideCleared: !$("#drawer")?.classList.contains("wide")};
  console.log(JSON.stringify(out, null, 1)); console.log("ERRORS", errors.slice(0, 8)); process.exit(0);
} catch (e) { console.error("ERR", e.stack); console.log("ERRORS", errors.slice(0, 8)); process.exit(1); } })();
