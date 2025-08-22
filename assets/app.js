import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const db = getFirestore(app);

const $ = s=>document.querySelector(s);
const grid = $("#grid");
const qInput = $("#q");
const sortSel = $("#sort");
const filterDomain = $("#filterDomain");

function norm(s){return (s||"").toLocaleUpperCase("tr");}

function sourceType(url){
  try{
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./,'').toLowerCase();
    if(host.includes("twitter.com") || host.includes("x.com")) return "twitter";
    if(host.includes("instagram.com")) return "instagram";
    if(host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    return "news";
  }catch{ return "news"; }
}

function cardHTML(d){
  const when = d.created?.toDate ? d.created.toDate().toLocaleString() : "";
  const type = sourceType(d.url);
  const title = d.name || "(İsimsiz)";
  const tags = (d.tags||[]).map(t=>`<span class="badge">#${t}</span>`).join(" ");
  let body = `<a class="src" href="${d.url}" target="_blank" rel="noopener">Kaynağa git</a>`;
  if(type==="twitter"){
    body = `<blockquote class="twitter-tweet"><a href="${d.url}"></a></blockquote>`;
  }else if(type==="instagram"){
    body = `<blockquote class="instagram-media" data-instgrm-permalink="${d.url}" data-instgrm-version="14"></blockquote>`;
  }else if(type==="youtube"){
    try{
      const u = new URL(d.url);
      let vid = u.searchParams.get("v")||"";
      if(!vid && u.hostname.includes("youtu.be")) vid = u.pathname.slice(1);
      if(vid){
        body = `<div style="position:relative;padding-top:56.25%;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
          <iframe src="https://www.youtube.com/embed/${vid}" title="YouTube" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
        </div>`;
      }
    }catch{}
  }
  return `<div class="card">
    <div class="meta">
      <strong>${title}</strong>
      <div class="badges">${tags}</div>
      <div><small>${when}</small></div>
    </div>
    <div class="meta">${body}</div>
  </div>`;
}

let DATA = [];

async function load(){
  const snap = await getDocs(query(collection(db,"approved"), orderBy("created","desc")));
  DATA = snap.docs.map(d=> d.data());
  render();
}
function passesFilter(d){
  if(filterDomain.value){
    const t = sourceType(d.url);
    if(filterDomain.value==="haber" && (t==="news")) { /* ok */ }
    else if(filterDomain.value!=="haber" && !d.url.includes(filterDomain.value)) return false;
    if(filterDomain.value==="haber" && (t!=="news")) return false;
  }
  const q = norm(qInput.value);
  if(q){
    const hay = norm(`${d.name||""} ${(d.tags||[]).join(" ")} ${d.url}`);
    if(!hay.includes(q)) return false;
  }
  return true;
}

function render(){
  let list = DATA.slice();
  const [f,dir] = (function(){
    if(sortSel.value==="created_desc") return ["created",-1];
    if(sortSel.value==="created_asc") return ["created",1];
    if(sortSel.value==="name_asc") return ["name",1];
    if(sortSel.value==="name_desc") return ["name",-1];
    return ["created",-1];
  })();
  list.sort((a,b)=>{
    if(f==="created"){
      const av = a.created?.seconds||0, bv = b.created?.seconds||0;
      return dir*(av-bv);
    }else{
      const av = (a.name||"").localeCompare(b.name||"", "tr");
      return dir*av;
    }
  });
  list = list.filter(passesFilter);
  grid.innerHTML = list.map(cardHTML).join("");
  if(window.twttr?.widgets) window.twttr.widgets.load();
  if(window.instgrm?.Embeds) window.instgrm.Embeds.process();
}

qInput.addEventListener("input", render);
sortSel.addEventListener("change", render);
filterDomain.addEventListener("change", render);

await load();
