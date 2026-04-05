import React, { useState, useMemo, useEffect } from “react”;
import ReactDOM from “react-dom/client”;

const range = (n) => Array.from({ length: n }, (_, i) => i);
function clampInt(v, min, max) { const x = parseInt(String(v ?? “”), 10); if (!Number.isFinite(x)) return min; return Math.max(min, Math.min(max, Math.trunc(x))); }
function courseHandicap(hi, slope, cr, par) { const h = parseFloat(hi), s = parseFloat(slope), c = parseFloat(cr), p = parseFloat(par); if (!isFinite(h) || !isFinite(s) || s <= 0) return null; return Math.round(h * (s / 113) + (isFinite(c) && isFinite(p) ? c - p : 0)); }
function strokesOnHole(ch, rank) { const h = clampInt(ch, 0, 54), r = clampInt(rank, 1, 18); let s = 0; if (h >= r) s++; if (h >= r + 18) s++; if (h >= r + 36) s++; return s; }
function fmt(n) { const x = Number(n); if (!Number.isFinite(x)) return “0”; return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(1); }
function segIdx(holeNo) { return holeNo <= 6 ? 0 : holeNo <= 12 ? 1 : 2; }
function calcMult(h) { let m = 1; if (h.press) m *= 2; if (h.roll) m *= 2; if (h.reroll) m *= 2; return m; }

const STATE_KEY   = “sps_state_v8”;
const COURSES_KEY = “sps_courses_v3”;

const SOLETA_PAR = [4,4,3,4,5,4,3,5,4,4,4,3,4,4,5,3,4,5];
const SOLETA_HCP = [9,1,11,5,7,13,17,15,3,4,6,18,10,2,12,8,16,14];
const STONEBRIDGE_PAR = [5,4,3,4,4,4,4,3,5,4,4,3,4,5,4,4,3,5];
const STONEBRIDGE_HCP = [5,15,13,7,11,3,1,17,9,18,2,14,10,6,8,12,16,4];

const BUILTIN_COURSES = [
{ id:“soleta_white”,     name:“Soleta Golf Club – White”,      slope:120, courseRating:67.7, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“soleta_bluewhite”, name:“Soleta Golf Club – Blue/White”, slope:128, courseRating:68.9, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“soleta_goldblue”,  name:“Soleta Golf Club – Gold/Blue”,  slope:134, courseRating:70.9, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“soleta_gold”,      name:“Soleta Golf Club – Gold”,       slope:136, courseRating:71.9, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“soleta_blue”,      name:“Soleta Golf Club – Blue”,       slope:130, courseRating:70.0, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“soleta_blackgold”, name:“Soleta Golf Club – Black/Gold”, slope:139, courseRating:73.4, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“soleta_black”,     name:“Soleta Golf Club – Black”,      slope:143, courseRating:74.6, holes: SOLETA_PAR.map((par,i)=>({par,hcp:SOLETA_HCP[i]})) },
{ id:“stonebridge_white”, name:“Stonebridge CC – White”, slope:133, courseRating:71.2, holes: STONEBRIDGE_PAR.map((par,i)=>({par,hcp:STONEBRIDGE_HCP[i]})) },
{ id:“stonebridge_blue”,  name:“Stonebridge CC – Blue”,  slope:139, courseRating:72.3, holes: STONEBRIDGE_PAR.map((par,i)=>({par,hcp:STONEBRIDGE_HCP[i]})) },
{ id:“stonebridge_gold”,  name:“Stonebridge CC – Gold”,  slope:143, courseRating:74.1, holes: STONEBRIDGE_PAR.map((par,i)=>({par,hcp:STONEBRIDGE_HCP[i]})) },
{ id:“stonebridge_black”, name:“Stonebridge CC – Black”, slope:147, courseRating:75.6, holes: STONEBRIDGE_PAR.map((par,i)=>({par,hcp:STONEBRIDGE_HCP[i]})) },
{ id:“stonebridge_red”,   name:“Stonebridge CC – Red”,   slope:133, courseRating:72.4, holes: STONEBRIDGE_PAR.map((par,i)=>({par,hcp:STONEBRIDGE_HCP[i]})) },
];

const BUILTIN_IDS = new Set(BUILTIN_COURSES.map(c => c.id));

function allCourses(userCourses) {
const extra = (userCourses || []).filter(c => !BUILTIN_IDS.has(c.id));
return […BUILTIN_COURSES, …extra].sort((a, b) => a.name.localeCompare(b.name));
}

function defaultState() {
return {
dollarsPerPoint: 1,
courseId: “stonebridge_blue”,
courseName: “Stonebridge CC – Blue”,
coursePar: STONEBRIDGE_PAR,
holeHcpRank: STONEBRIDGE_HCP,
slope: 139,
courseRating: 72.3,
players: [
{ id:“P1”, name:“Player 1”, hi:10 },
{ id:“P2”, name:“Player 2”, hi:12 },
{ id:“P3”, name:“Player 3”, hi:14 },
{ id:“P4”, name:“Player 4”, hi:16 },
],
segments: [
{ A:[“P1”,“P2”], B:[“P3”,“P4”] },
{ A:[“P1”,“P3”], B:[“P2”,“P4”] },
{ A:[“P1”,“P4”], B:[“P2”,“P3”] },
],
holes: range(18).map((i) => ({ no:i+1, gross:{P1:””,P2:””,P3:””,P4:””}, prox:””, press:false, roll:false, reroll:false })),
};
}

function loadLS(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function CourseBuilder({ initial, onSave, onClose }) {
const blank = { id: Date.now().toString(36)+Math.random().toString(36).slice(2), name:””, slope:113, courseRating:72, holes: range(18).map((i)=>({par:4,hcp:i+1})) };
const [c, setC] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : blank);
const setF = (k, v) => setC(p => ({…p, [k]:v}));
const setH = (i, k, v) => setC(p => ({…p, holes: p.holes.map((h,j) => j===i ? {…h,[k]:v} : h)}));
const totalPar = c.holes.reduce((a,h) => a+Number(h.par), 0);
const counts = Array(19).fill(0);
c.holes.forEach(h => { const v=Number(h.hcp); if(v>=1&&v<=18) counts[v]++; });
const hcpOk = counts.slice(1).every(x => x===1);
const valid = c.name.trim() && hcpOk;

return (
<div style={{position:“fixed”,inset:0,background:“rgba(0,0,0,0.6)”,zIndex:50,overflowY:“auto”,padding:16,display:“flex”,alignItems:“flex-start”,justifyContent:“center”}}>
<div style={{background:“white”,borderRadius:16,padding:20,width:“100%”,maxWidth:680,marginTop:16}}>
<div style={{display:“flex”,justifyContent:“space-between”,marginBottom:16}}>
<b style={{fontSize:18}}>{initial?“✏️ Edit Course”:“➕ New Course”}</b>
<button onClick={onClose} style={{border:“none”,background:”#f4f4f5”,borderRadius:8,padding:“4px 10px”,cursor:“pointer”,fontWeight:700}}>✕</button>
</div>
<div style={{display:“flex”,gap:8,marginBottom:12,flexWrap:“wrap”}}>
<input value={c.name} onChange={e=>setF(“name”,e.target.value)} placeholder=“Course name (e.g. Pebble Beach – White)”
style={{flex:1,minWidth:180,padding:“8px 10px”,borderRadius:8,border:“1px solid #d4d4d8”,fontSize:13}}/>
<label style={{fontSize:12,display:“flex”,alignItems:“center”,gap:4}}>Slope
<input type=“number” value={c.slope} onChange={e=>setF(“slope”,e.target.value)}
style={{width:58,padding:“8px 6px”,borderRadius:8,border:“1px solid #d4d4d8”,textAlign:“center”}}/>
</label>
<label style={{fontSize:12,display:“flex”,alignItems:“center”,gap:4}}>Rating
<input type=“number” step=“0.1” value={c.courseRating} onChange={e=>setF(“courseRating”,e.target.value)}
style={{width:58,padding:“8px 6px”,borderRadius:8,border:“1px solid #d4d4d8”,textAlign:“center”}}/>
</label>
<div style={{padding:“8px 12px”,background:”#f0fdf4”,borderRadius:8,fontWeight:900,color:”#166534”}}>Par {totalPar}</div>
</div>
{!hcpOk && <div style={{background:”#fef2f2”,border:“1px solid #fecaca”,borderRadius:8,padding:“8px 12px”,fontSize:12,color:”#dc2626”,marginBottom:10}}>⚠️ HCP Rank must use each number 1–18 exactly once.</div>}
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:8}}>
{[0,1].map(half=>(
<div key={half}>
<div style={{fontWeight:800,fontSize:11,color:”#a1a1aa”,marginBottom:6}}>{half===0?“FRONT 9”:“BACK 9”}</div>
{range(9).map(i=>{
const idx=half*9+i, h=c.holes[idx], dup=counts[Number(h.hcp)]>1;
return(
<div key={idx} style={{display:“flex”,alignItems:“center”,gap:6,marginBottom:4}}>
<span style={{width:20,fontWeight:700,fontSize:12,color:”#71717a”}}>{idx+1}</span>
{[3,4,5].map(p=>(
<button key={p} onClick={()=>setH(idx,“par”,p)}
style={{width:28,height:26,borderRadius:6,border:“none”,cursor:“pointer”,fontWeight:700,fontSize:12,
background:h.par===p?”#18181b”:”#e4e4e7”,color:h.par===p?“white”:”#52525b”}}>{p}</button>
))}
<input type=“number” min={1} max={18} value={h.hcp} onChange={e=>setH(idx,“hcp”,Number(e.target.value))}
style={{width:46,padding:“4px 6px”,borderRadius:6,textAlign:“center”,fontSize:12,
border:`1px solid ${dup?"#fca5a5":"#d4d4d8"}`,background:dup?”#fef2f2”:“white”}}/>
</div>
);
})}
<div style={{fontSize:12,fontWeight:900,color:”#52525b”,marginTop:4}}>Par {c.holes.slice(half*9,half*9+9).reduce((a,h)=>a+Number(h.par),0)}</div>
</div>
))}
</div>
<div style={{display:“flex”,gap:8,justifyContent:“flex-end”,marginTop:16}}>
<button onClick={onClose} style={{padding:“8px 16px”,borderRadius:8,border:“1px solid #d4d4d8”,background:“white”,fontWeight:600,cursor:“pointer”}}>Cancel</button>
<button onClick={()=>valid&&onSave(c)} disabled={!valid}
style={{padding:“8px 20px”,borderRadius:8,background:valid?”#18181b”:”#d4d4d8”,color:“white”,border:“none”,fontWeight:700,cursor:valid?“pointer”:“not-allowed”}}>
💾 Save Course
</button>
</div>
</div>
</div>
);
}

function App() {
const [s, setS] = useState(() => loadLS(STATE_KEY, defaultState()));
const [userCourses, setUserCourses] = useState(() => loadLS(COURSES_KEY, []));
const [tab, setTab] = useState(“Scoring”);
const [hole, setHole] = useState(1);
const [builder, setBuilder] = useState(null);
const [selectedDropdown, setSelectedDropdown] = useState(s.courseId || “stonebridge_blue”);

useEffect(() => saveLS(STATE_KEY, s), [s]);
useEffect(() => saveLS(COURSES_KEY, userCourses), [userCourses]);

const courses = useMemo(() => allCourses(userCourses), [userCourses]);

const upd = p => setS(prev => ({…prev,…p}));
const updPlayer = (id,p) => upd({players:s.players.map(pl=>pl.id===id?{…pl,…p}:pl)});
const updHole = (no,p) => upd({holes:s.holes.map(h=>h.no===no?{…h,…p}:h)});
const updGross = (no,pid,v) => upd({holes:s.holes.map(h=>h.no!==no?h:{…h,gross:{…h.gross,[pid]:v}})});
const updSeg = (i,p) => upd({segments:s.segments.map((sg,j)=>j===i?{…sg,…p}:sg)});

const saveCourse = (c) => {
if (BUILTIN_IDS.has(c.id)) {
setUserCourses(prev => prev.find(x=>x.id===c.id) ? prev.map(x=>x.id===c.id?c:x) : […prev, c]);
} else {
setUserCourses(prev => prev.find(x=>x.id===c.id) ? prev.map(x=>x.id===c.id?c:x) : [c,…prev]);
}
setBuilder(null);
};

const delCourse = (id) => {
if (BUILTIN_IDS.has(id)) { alert(“Built-in courses can’t be deleted, but you can edit them.”); return; }
if (!window.confirm(“Delete this course?”)) return;
setUserCourses(prev => prev.filter(c=>c.id!==id));
};

const applyCourse = (c) => {
upd({ courseId:c.id, courseName:c.name, coursePar:c.holes.map(h=>h.par), holeHcpRank:c.holes.map(h=>h.hcp), slope:c.slope, courseRating:c.courseRating });
setSelectedDropdown(c.id);
setTab(“Scoring”);
};

const handleDropdownChange = (id) => {
setSelectedDropdown(id);
const course = courses.find(c=>c.id===id);
if (course) applyCourse(course);
};

const totalPar = s.coursePar.reduce((a,b)=>a+b,0);
const frontPar = s.coursePar.slice(0,9).reduce((a,b)=>a+b,0);
const backPar  = s.coursePar.slice(9).reduce((a,b)=>a+b,0);

const playerCH = useMemo(() => {
const o={}; s.players.forEach(p=>{o[p.id]=courseHandicap(p.hi,s.slope,s.courseRating,totalPar);}); return o;
}, [s.players,s.slope,s.courseRating,totalPar]);

const derived = useMemo(() => {
const perHole = s.holes.map((h,idx)=>{
const si=segIdx(h.no),seg=s.segments[si],tA=seg.A,tB=seg.B;
const rank=clampInt(s.holeHcpRank[idx],1,18),par=s.coursePar[idx]??4;
const gross={},net={};
s.players.forEach(p=>{const ch=playerCH[p.id]??clampInt(p.hi,0,54);const g=h.gross[p.id]===””?null:clampInt(h.gross[p.id],1,20);gross[p.id]=g;net[p.id]=g==null?null:g-strokesOnHole(ch,rank);});
const done=s.players.every(p=>gross[p.id]!=null);
const teamOf=pid=>tA.includes(pid)?“A”:“B”;
let low=””,tot=””,bird=””;
if(done){
let best=Infinity;const bt=new Set();
s.players.forEach(p=>{const n=net[p.id];if(n<best){best=n;bt.clear();bt.add(teamOf(p.id));}else if(n===best)bt.add(teamOf(p.id));});
low=bt.size===1?[…bt][0]:“T”;
const sum=team=>team.reduce((a,pid)=>a+(net[pid]??0),0);const da=sum(tA),db=sum(tB);tot=da<db?“A”:db<da?“B”:“T”;
const hb=team=>team.some(pid=>gross[pid]===par-1);bird=hb(tA)&&!hb(tB)?“A”:hb(tB)&&!hb(tA)?“B”:hb(tA)&&hb(tB)?“T”:””;
}
const pA=(h.prox===“A”?1:0)+(low===“A”?2:0)+(tot===“A”?2:0)+(bird===“A”?1:0);
const pB=(h.prox===“B”?1:0)+(low===“B”?2:0)+(tot===“B”?2:0)+(bird===“B”?1:0);
const umbA=pA===6&&pB===0,umbB=pB===6&&pA===0;
const ua=umbA?12:pA,ub=umbB?12:pB,mult=calcMult(h);
return{no:h.no,si,tA,tB,rank,par,gross,net,low,tot,bird,prox:h.prox,umb:{isA:umbA,isB:umbB},mult,adj:{A:ua*mult,B:ub*mult},done};
});
const segTot=[0,1,2].map(i=>{const hs=perHole.filter(x=>x.si===i);return{i,A:s.segments[i].A,B:s.segments[i].B,adjA:hs.reduce((a,x)=>a+x.adj.A,0),adjB:hs.reduce((a,x)=>a+x.adj.B,0)};});
const indiv={};s.players.forEach(p=>{indiv[p.id]=0;});perHole.forEach(ph=>{ph.tA.forEach(pid=>{indiv[pid]+=ph.adj.A;});ph.tB.forEach(pid=>{indiv[pid]+=ph.adj.B;});});
const grossTotals={};s.players.forEach(p=>{const f=perHole.slice(0,9),b=perHole.slice(9);const front=f.reduce((a,ph)=>a+(ph.gross[p.id]??0),0),back=b.reduce((a,ph)=>a+(ph.gross[p.id]??0),0);grossTotals[p.id]={front,back,total:front+back,fe:f.some(ph=>ph.gross[p.id]!=null),be:b.some(ph=>ph.gross[p.id]!=null)};});
const birds={};s.players.forEach(p=>{birds[p.id]=0;});let umbs=0;
perHole.forEach(ph=>{if(ph.umb.isA||ph.umb.isB)umbs++;s.players.forEach(p=>{if(ph.gross[p.id]===ph.par-1)birds[p.id]++;});});
return{perHole,segTot,indiv,grossTotals,birds,umbs,totalBirds:Object.values(birds).reduce((a,b)=>a+b,0),presses:s.holes.filter(h=>h.press).length,rolls:s.holes.filter(h=>h.roll).length,rerolls:s.holes.filter(h=>h.reroll).length};
},[s,playerCH]);

const byId=Object.fromEntries(s.players.map(p=>[p.id,p]));
const dpp=Number(s.dollarsPerPoint||0);
const holesComplete=derived.perHole.filter(ph=>ph.done).length;
const totalA=derived.segTot.reduce((a,x)=>a+x.adjA,0);
const totalB=derived.segTot.reduce((a,x)=>a+x.adjB,0);
const lb=[…s.players].map(p=>({…p,pts:derived.indiv[p.id]||0,birds:derived.birds[p.id]||0})).sort((a,b)=>b.pts-a.pts||b.birds-a.birds);
const ph=derived.perHole[hole-1],hs=s.holes[hole-1];
const segLabels=[“Holes 1–6”,“Holes 7–12”,“Holes 13–18”];
const winLabel=w=>w===””?”—”:w===“T”?“Tie”:`Team ${w} ✓`;
const diffStr=(v,ok)=>!ok?”—”:v===0?“E”:v>0?`+${v}`:`${v}`;
const diffCol=v=>v<0?”#16a34a”:v>0?”#dc2626”:”#71717a”;
const pill=(txt,bg=”#f4f4f5”,col=”#52525b”)=>React.createElement(“span”,{style:{background:bg,color:col,borderRadius:9999,padding:“2px 8px”,fontSize:11,fontWeight:700}},txt);

return (
<div style={{fontFamily:“system-ui,sans-serif”,background:”#f4f4f5”,minHeight:“100vh”,color:”#18181b”}}>
{builder&&<CourseBuilder initial={builder===“new”?null:builder} onSave={saveCourse} onClose={()=>setBuilder(null)}/>}

```
  <div style={{background:"#18181b",color:"white",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
    <div>
      <div style={{fontWeight:900,fontSize:18}}>⛳ Six-Point Scotch</div>
      <div style={{fontSize:11,opacity:0.6}}>{s.courseName||"No course"} • {holesComplete}/18 • A:{fmt(totalA)} B:{fmt(totalB)}</div>
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <label style={{fontSize:12,color:"#d4d4d8",display:"flex",alignItems:"center",gap:4}}>$/pt
        <input type="number" step="0.5" value={s.dollarsPerPoint} onChange={e=>upd({dollarsPerPoint:e.target.value})}
          style={{width:48,padding:"2px 6px",borderRadius:6,border:"none",background:"#3f3f46",color:"white",fontSize:12}}/>
      </label>
      <button onClick={()=>{if(window.confirm("Reset scores?")){ setS(defaultState()); setHole(1); setSelectedDropdown("stonebridge_blue"); }}}
        style={{background:"#ef4444",color:"white",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Reset</button>
    </div>
  </div>

  <div style={{background:"white",padding:"8px 16px",borderBottom:"1px solid #e4e4e7"}}>
    <div style={{height:6,background:"#e4e4e7",borderRadius:9999,overflow:"hidden"}}>
      <div style={{height:"100%",background:"#22c55e",width:`${(holesComplete/18)*100}%`,transition:"width 0.3s"}}/>
    </div>
  </div>

  <div style={{background:"white",borderBottom:"1px solid #e4e4e7",display:"flex",overflowX:"auto"}}>
    {["Scoring","Leaderboard","Setup","Courses"].map(t=>(
      <button key={t} onClick={()=>setTab(t)} style={{padding:"10px 16px",border:"none",background:"none",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",borderBottom:tab===t?"3px solid #18181b":"3px solid transparent",color:tab===t?"#18181b":"#71717a"}}>{t}</button>
    ))}
  </div>

  <div style={{maxWidth:900,margin:"0 auto",padding:16}}>

    {tab==="Scoring"&&ph&&hs&&(
      <div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
          {range(18).map(i=>{const done=derived.perHole[i].done;return(
            <button key={i} onClick={()=>setHole(i+1)} style={{width:32,height:32,borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:hole===i+1?"#18181b":done?"#dcfce7":"#e4e4e7",color:hole===i+1?"white":done?"#166534":"#52525b"}}>{i+1}</button>
          );})}
        </div>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:12}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:22,fontWeight:900}}>Hole {hole}</span>
            {pill(`Par ${ph.par}`)}{pill(`HCP ${ph.rank}`)}{pill(segLabels[ph.si])}
            {ph.umb.isA&&pill("☂ UMBRELLA A","#dcfce7","#166534")}
            {ph.umb.isB&&pill("☂ UMBRELLA B","#dcfce7","#166534")}
            {ph.mult>1&&pill(`×${ph.mult}`,"#fef3c7","#92400e")}
          </div>
          <div style={{fontSize:11,color:"#71717a",marginBottom:12}}>
            <b style={{color:"#1d4ed8"}}>Team A:</b> {ph.tA.map(id=>byId[id]?.name).join(" & ")} &nbsp;
            <b style={{color:"#c2410c"}}>Team B:</b> {ph.tB.map(id=>byId[id]?.name).join(" & ")}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:8,marginBottom:12}}>
            {s.players.map(p=>{
              const isA=ph.tA.includes(p.id),g=hs.gross[p.id],n=ph.net[p.id],gn=g===""?null:Number(g);
              const strokes=strokesOnHole(playerCH[p.id]??clampInt(p.hi,0,54),ph.rank);
              let bg="#f9fafb";if(gn!=null){if(gn<=ph.par-2)bg="#fef9c3";else if(gn===ph.par-1)bg="#fef2f2";else if(gn>=ph.par+2)bg="#eff6ff";}
              return(
                <div key={p.id} style={{borderRadius:12,padding:10,background:bg,borderLeft:`4px solid ${isA?"#3b82f6":"#f97316"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontWeight:900,fontSize:13}}>{p.name}</span>
                    <div style={{display:"flex",gap:4}}>{pill(isA?"A":"B",isA?"#dbeafe":"#ffedd5",isA?"#1d4ed8":"#c2410c")}{strokes>0&&pill("▼".repeat(strokes))}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="number" min={1} max={20} value={g} placeholder="—" onChange={e=>updGross(hole,p.id,e.target.value)}
                      style={{width:58,padding:"6px 8px",borderRadius:8,border:"1px solid #d4d4d8",fontSize:18,fontWeight:900,textAlign:"center"}}/>
                    {g!==""&&g!=null&&<span style={{fontSize:12,color:"#71717a"}}>net <b>{n}</b></span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
            {[{label:"PROX (1pt)",manual:true},{label:"LOW (2pt)",val:ph.low},{label:"TOTAL (2pt)",val:ph.tot},{label:"BIRDIE (1pt)",val:ph.bird}].map(({label,val,manual})=>(
              <div key={label} style={{background:"#f4f4f5",borderRadius:10,padding:8}}>
                <div style={{fontSize:10,color:"#71717a",fontWeight:600,marginBottom:4}}>{label}</div>
                {manual?(<select value={hs.prox} onChange={e=>updHole(hole,{prox:e.target.value})} style={{fontSize:12,borderRadius:6,border:"1px solid #d4d4d8",padding:"2px 4px",width:"100%"}}><option value="">—</option><option value="A">Team A</option><option value="B">Team B</option><option value="T">Tie</option></select>)
                :<div style={{fontWeight:900,fontSize:12}}>{winLabel(val)}</div>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center",background:"#f4f4f5",borderRadius:10,padding:10}}>
            {[{label:"PRESS ×2",key:"press",req:null},{label:"ROLL ×2",key:"roll",req:null},{label:"RE-ROLL ×2",key:"reroll",req:"roll"}].map(({label,key,req})=>(
              <label key={key} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,cursor:"pointer",opacity:req&&!hs[req]?0.4:1}}>
                <input type="checkbox" checked={hs[key]} disabled={req&&!hs[req]} onChange={e=>{const v=e.target.checked;if(key==="roll")updHole(hole,{roll:v,reroll:v?hs.reroll:false});else updHole(hole,{[key]:v});}}/>
                {label}
              </label>
            ))}
            <div style={{marginLeft:"auto",fontWeight:900,fontSize:14}}>
              <span style={{color:"#1d4ed8"}}>A:{fmt(ph.adj.A)}</span> <span style={{color:"#71717a"}}>•</span> <span style={{color:"#c2410c"}}>B:{fmt(ph.adj.B)}</span>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
            <button disabled={hole===1} onClick={()=>setHole(h=>h-1)} style={{padding:"6px 16px",borderRadius:8,border:"1px solid #d4d4d8",background:"white",fontWeight:700,fontSize:12,cursor:"pointer",opacity:hole===1?0.4:1}}>← Prev</button>
            <button disabled={hole===18} onClick={()=>setHole(h=>h+1)} style={{padding:"6px 16px",borderRadius:8,border:"1px solid #d4d4d8",background:"white",fontWeight:700,fontSize:12,cursor:"pointer",opacity:hole===18?0.4:1}}>Next →</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8}}>
          {derived.segTot.map(st=>{
            const nA=st.A.map(id=>byId[id]?.name?.split(" ")[0]).join(" & "),nB=st.B.map(id=>byId[id]?.name?.split(" ")[0]).join(" & ");
            return(<div key={st.i} style={{background:"white",borderRadius:12,padding:12,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><b style={{fontSize:13}}>{segLabels[st.i]}</b><span style={{fontSize:11,color:"#71717a"}}>{st.adjA===st.adjB?"Push":st.adjA>st.adjB?`${nA} lead`:`${nB} lead`}</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div style={{background:"#dbeafe",borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:10,color:"#1d4ed8",fontWeight:600}}>{nA}</div><div style={{fontSize:20,fontWeight:900,color:"#1e3a8a"}}>{fmt(st.adjA)}</div></div>
                <div style={{background:"#ffedd5",borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:10,color:"#c2410c",fontWeight:600}}>{nB}</div><div style={{fontSize:20,fontWeight:900,color:"#7c2d12"}}>{fmt(st.adjB)}</div></div>
              </div>
            </div>);
          })}
        </div>
      </div>
    )}

    {tab==="Leaderboard"&&(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>🏆 Points Leaderboard</b>
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            {lb.map((p,i)=>{
              const pct=lb[0]?.pts?(p.pts/lb[0].pts)*100:0,ch=playerCH[p.id];
              return(<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:10,background:"#f9fafb",borderRadius:10}}>
                <span style={{fontSize:20,width:28}}>{["🥇","🥈","🥉",""][i]||i+1}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontWeight:900}}>{p.name}</span>
                    <span style={{fontSize:11,color:"#71717a"}}>HI:{p.hi}</span>
                    {ch!=null&&<span style={{fontSize:11,background:"#f0fdf4",color:"#166534",borderRadius:6,padding:"0 6px",fontWeight:700}}>CH:{ch}</span>}
                  </div>
                  <div style={{height:5,background:"#e4e4e7",borderRadius:9999,marginTop:4,overflow:"hidden"}}><div style={{height:"100%",background:"#18181b",width:`${pct}%`}}/></div>
                </div>
                <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900}}>{fmt(p.pts)}</div><div style={{fontSize:11,color:"#71717a"}}>${fmt(p.pts*dpp)} • {p.birds}🐦</div></div>
              </div>);
            })}
          </div>
        </div>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>📋 Gross Scores</b>
          <div style={{overflowX:"auto",marginTop:12}}>
            <table style={{borderCollapse:"collapse",width:"100%",fontSize:13,minWidth:360}}>
              <thead><tr style={{background:"#f4f4f5"}}>
                <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:12}}>Player</th>
                <th style={{padding:"8px 8px",textAlign:"center",fontWeight:700,fontSize:12}}>Front 9</th>
                <th style={{padding:"8px 4px",textAlign:"center",fontWeight:600,color:"#a1a1aa",fontSize:11}}>Par {frontPar}</th>
                <th style={{padding:"8px 8px",textAlign:"center",fontWeight:700,fontSize:12}}>Back 9</th>
                <th style={{padding:"8px 4px",textAlign:"center",fontWeight:600,color:"#a1a1aa",fontSize:11}}>Par {backPar}</th>
                <th style={{padding:"8px 8px",textAlign:"center",fontWeight:700,fontSize:12}}>Total</th>
                <th style={{padding:"8px 4px",textAlign:"center",fontWeight:600,color:"#a1a1aa",fontSize:11}}>Par {totalPar}</th>
              </tr></thead>
              <tbody>{s.players.map(p=>{const g=derived.grossTotals[p.id];return(
                <tr key={p.id} style={{borderTop:"1px solid #f4f4f5"}}>
                  <td style={{padding:"10px 12px",fontWeight:700}}>{p.name}</td>
                  <td style={{padding:"10px 8px",textAlign:"center",fontWeight:900,fontSize:15}}>{g.fe?g.front:"—"}</td>
                  <td style={{padding:"10px 4px",textAlign:"center",fontSize:12,fontWeight:700,color:diffCol(g.front-frontPar)}}>{diffStr(g.front-frontPar,g.fe)}</td>
                  <td style={{padding:"10px 8px",textAlign:"center",fontWeight:900,fontSize:15}}>{g.be?g.back:"—"}</td>
                  <td style={{padding:"10px 4px",textAlign:"center",fontSize:12,fontWeight:700,color:diffCol(g.back-backPar)}}>{diffStr(g.back-backPar,g.be)}</td>
                  <td style={{padding:"10px 8px",textAlign:"center",fontWeight:900,fontSize:15,background:"#f9fafb"}}>{g.fe||g.be?g.total:"—"}</td>
                  <td style={{padding:"10px 4px",textAlign:"center",fontSize:12,fontWeight:700,color:diffCol(g.total-totalPar),background:"#f9fafb"}}>{diffStr(g.total-totalPar,g.fe||g.be)}</td>
                </tr>
              );})}</tbody>
            </table>
          </div>
        </div>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>💰 Payout (${dpp}/pt)</b>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
            {(()=>{const pairs=[];for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){const pi=s.players[i],pj=s.players[j],diff=(derived.indiv[pi.id]||0)-(derived.indiv[pj.id]||0),d=diff*dpp;if(Math.abs(d)>0.001)pairs.push({from:d>0?pj.name:pi.name,to:d>0?pi.name:pj.name,amt:Math.abs(d)});}
            if(!pairs.length)return React.createElement("div",{style:{color:"#71717a",fontSize:13}},"All square — nobody owes anything yet.");
            return pairs.sort((a,b)=>b.amt-a.amt).map((p,i)=>React.createElement("div",{key:i,style:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f4f4f5",borderRadius:8,padding:"8px 12px"}},
              React.createElement("span",{style:{fontSize:13}},React.createElement("b",{style:{color:"#dc2626"}},p.from)," → ",React.createElement("b",{style:{color:"#16a34a"}},p.to)),
              React.createElement("b",{style:{fontSize:16}},"$"+p.amt.toFixed(2))));})()}
          </div>
        </div>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>📊 Stats</b>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginTop:10}}>
            {[{icon:"🐦",label:"Birdies",val:derived.totalBirds},{icon:"☂",label:"Umbrellas",val:derived.umbs},{icon:"✌️",label:"Presses",val:derived.presses},{icon:"🎲",label:"Rolls",val:derived.rolls},{icon:"🎰",label:"Re-rolls",val:derived.rerolls}].map(({icon,label,val})=>(
              <div key={label} style={{background:"#f4f4f5",borderRadius:10,padding:10,textAlign:"center"}}><div style={{fontSize:20}}>{icon}</div><div style={{fontSize:22,fontWeight:900}}>{val}</div><div style={{fontSize:11,color:"#71717a"}}>{label}</div></div>
            ))}
          </div>
        </div>
      </div>
    )}

    {tab==="Setup"&&(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>👤 Players & Handicaps</b>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 12px",margin:"10px 0"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#166534"}}>Course ratings:</span>
            <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4}}>Slope<input type="number" min={55} max={155} value={s.slope} onChange={e=>upd({slope:e.target.value})} style={{width:54,padding:"4px 6px",borderRadius:6,border:"1px solid #bbf7d0",textAlign:"center"}}/></label>
            <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4}}>Rating<input type="number" step="0.1" min={60} max={80} value={s.courseRating} onChange={e=>upd({courseRating:e.target.value})} style={{width:54,padding:"4px 6px",borderRadius:6,border:"1px solid #bbf7d0",textAlign:"center"}}/></label>
            <span style={{fontSize:11,color:"#16a34a"}}>Par {totalPar}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {s.players.map(p=>{const ch=playerCH[p.id];return(
              <div key={p.id} style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{width:24,height:24,background:"#18181b",color:"white",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>{p.id.replace("P","")}</span>
                <input value={p.name} onChange={e=>updPlayer(p.id,{name:e.target.value})} style={{flex:1,minWidth:120,padding:"6px 10px",borderRadius:8,border:"1px solid #d4d4d8",fontSize:13}}/>
                <label style={{fontSize:11,color:"#71717a",display:"flex",alignItems:"center",gap:4}}>HI<input type="number" step="0.1" min={-10} max={54} value={p.hi} onChange={e=>updPlayer(p.id,{hi:e.target.value})} style={{width:56,padding:"6px 8px",borderRadius:8,border:"1px solid #d4d4d8",textAlign:"center"}}/></label>
                {ch!=null&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"4px 10px",fontSize:12}}>CH:<b style={{color:"#166534"}}>{ch}</b></div>}
              </div>
            );})}
          </div>
        </div>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>🔄 Team Rotation</b>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:8,marginTop:10}}>
            {[0,1,2].map(i=>{const sg=s.segments[i];return(
              <div key={i} style={{background:"#f4f4f5",borderRadius:10,padding:10}}>
                <b style={{fontSize:12}}>{segLabels[i]}</b>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
                  {["A","B"].map(team=>(
                    <div key={team} style={{background:team==="A"?"#dbeafe":"#ffedd5",borderRadius:8,padding:6}}>
                      <div style={{fontSize:10,fontWeight:800,color:team==="A"?"#1d4ed8":"#c2410c",marginBottom:4}}>Team {team}</div>
                      {sg[team].map((pid,j)=>(
                        <select key={j} value={pid} onChange={e=>{const next=[...sg[team]];next[j]=e.target.value;const other=team==="A"?sg.B:sg.A;if(new Set([...next,...other]).size!==4)return;updSeg(i,{[team]:next});}} style={{width:"100%",fontSize:11,borderRadius:4,border:"1px solid #d4d4d8",padding:"2px 4px",marginBottom:2}}>
                          {s.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );})}
          </div>
        </div>
      </div>
    )}

    {tab==="Courses"&&(
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>⛳ Select Course</b>
          <p style={{fontSize:12,color:"#71717a",margin:"4px 0 12px"}}>Choose a course to load it for your round. Sorted alphabetically.</p>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <select value={selectedDropdown} onChange={e=>handleDropdownChange(e.target.value)}
              style={{flex:1,minWidth:200,padding:"10px 12px",borderRadius:10,border:"1px solid #d4d4d8",fontSize:14,background:"white",cursor:"pointer"}}>
              {courses.map(c=>React.createElement("option",{key:c.id,value:c.id},c.name))}
            </select>
            <button onClick={()=>setTab("Scoring")}
              style={{background:"#18181b",color:"white",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,cursor:"pointer"}}>▶ Play</button>
          </div>
          {(()=>{
            const c=courses.find(x=>x.id===selectedDropdown);
            if(!c)return null;
            const cPar=c.holes.reduce((a,h)=>a+Number(h.par),0);
            const fp=c.holes.slice(0,9).reduce((a,h)=>a+Number(h.par),0);
            const bp=c.holes.slice(9).reduce((a,h)=>a+Number(h.par),0);
            const isActive=s.courseId===c.id;
            return(
              <div style={{marginTop:12,background:"#f9fafb",borderRadius:10,padding:12,border:`1px solid ${isActive?"#22c55e":"#e4e4e7"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
                  <div>
                    <span style={{fontWeight:900,fontSize:14}}>{c.name}</span>
                    {isActive&&<span style={{marginLeft:8,background:"#dcfce7",color:"#166534",borderRadius:9999,padding:"1px 8px",fontSize:11,fontWeight:700}}>✓ Active</span>}
                  </div>
                  <div style={{fontSize:12,color:"#71717a"}}>Par {cPar} ({fp}/{bp}) • Slope {c.slope} • Rating {c.courseRating}</div>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",fontSize:11,minWidth:480}}>
                    <thead><tr style={{background:"#f0f0f0"}}>
                      <th style={{padding:"3px 8px",textAlign:"left",color:"#a1a1aa"}}>Hole</th>
                      {c.holes.map((_,i)=>React.createElement("th",{key:i,style:{padding:"3px 5px",textAlign:"center",color:"#a1a1aa"}},i+1))}
                      <th style={{padding:"3px 8px",textAlign:"center",color:"#a1a1aa"}}>Tot</th>
                    </tr></thead>
                    <tbody>
                      <tr style={{borderTop:"1px solid #e4e4e7"}}><td style={{padding:"3px 8px",fontWeight:700}}>Par</td>{c.holes.map((h,i)=>React.createElement("td",{key:i,style:{padding:"3px 5px",textAlign:"center",fontWeight:700,color:h.par===3?"#7c3aed":h.par===5?"#0369a1":"#18181b"}},h.par))}<td style={{padding:"3px 8px",textAlign:"center",fontWeight:900}}>{cPar}</td></tr>
                      <tr style={{borderTop:"1px solid #e4e4e7"}}><td style={{padding:"3px 8px",fontWeight:700}}>HCP</td>{c.holes.map((h,i)=>React.createElement("td",{key:i,style:{padding:"3px 5px",textAlign:"center",color:"#71717a"}},h.hcp))}<td/></tr>
                    </tbody>
                  </table>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10,justifyContent:"flex-end"}}>
                  <button onClick={()=>setBuilder(c)} style={{background:"#f4f4f5",color:"#18181b",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>✏️ Edit</button>
                  {!BUILTIN_IDS.has(c.id)&&<button onClick={()=>delCourse(c.id)} style={{background:"#fef2f2",color:"#dc2626",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>✕ Delete</button>}
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{background:"white",borderRadius:16,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <b style={{fontSize:16}}>➕ Add a Course</b>
          <p style={{fontSize:12,color:"#71717a",margin:"4px 0 12px"}}>Build any course from scratch — saved to your library permanently.</p>
          <button onClick={()=>setBuilder("new")} style={{background:"#18181b",color:"white",border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>➕ New Course</button>
          {userCourses.filter(c=>!BUILTIN_IDS.has(c.id)).length>0&&<div style={{marginTop:12,fontSize:12,color:"#71717a"}}>You have {userCourses.filter(c=>!BUILTIN_IDS.has(c.id)).length} custom course(s) — find them in the dropdown above.</div>}
        </div>
      </div>
    )}
  </div>
</div>
```

);
}

const root = ReactDOM.createRoot(document.getElementById(“root”));
root.render(React.createElement(App));
