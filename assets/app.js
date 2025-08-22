// assets/app.js — onaylı kayıtlar + arama/filtre + sayfalama ("Daha fazla yükle")
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const db  = getFirestore(app);

const $ = s => document.querySelector(s);
const grid         = $("#grid");
const qInput       = $("#q");
const sortSel      = $("#sort");
const filterDomain = $("#filterDomain");
const moreBtn      = $("#more");

function norm(s){ return (s||"").toLocaleUpperCase("tr"); }

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

// Kart HTML — açıklama + link badge + mümkünse embed (kart komple tıklanmaz)
function cardHTML(d){
  const when  = d.created?.toDate ? d.created.toDate().toLocaleString() : "";
  const type  = sourceType(d.url);
  const title = d.name || "(İsimsiz)";
  const desc  = d.description ? String(d.description) : "";

  // embed hazırlığı
  let embed = "";
  if(type==="twitter"){
    embed = `<blockquote class="twitter-tweet"><a href="${d.url}"></a></blockquote>`;
  }else if(type==="instagram"){
    embed = `<blockquote class="instagram-media" data-instgrm-permalink="${d.url}" data-instgrm-version="14"></blockquote>`;
  }else if(type==="youtube"){
    try{
      const u = new URL(d.url);
      let vid = u.searchParams.get("v")||"";
      if(!vid && u.hostname.includes("youtu.be")) vid = u.pathname.slice(1);
      if(vid){
        embed = `<div style="position:relative;padding-top:56.25%;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
          <iframe src="https://www.youtube.com/embed/${vid}" title="YouTube"
            style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
        </div>`;
      }
    }catch{}
  }

  return `
    <div class="card">
      <div class="meta">
        <strong>${title}</strong>
        ${desc ? `<div style="margin-top:.35rem;color:var(--muted)">${desc}</div>` : ""}
        <div><a class="link-badge" href="${d.url}" target="_blank" rel="noopener">Kaynak Linki</a></div>
        <div style="margin-top:.35rem;"><small>${when}</small></div>
      </div>
      ${embed ? `<div class="meta">${embed}</div>` : ""}
    </div>
  `;
}

/* ---------- Sayfalama durumu ---------- */
let DATA = [];                 // ekranda gösterilecek toplu veri (sayfa sayfa büyür)
const PAGE = 20;               // her istekte kaç kayıt
let lastCursor = null;         // Firestore cursor
let finished   = false;        // daha sayfa var mı?

async function loadMore(initial=false){
  if(finished) return;
  // Cursor’lı sorgu (yalnız "yeni→eski" sırada mantıklı)
  const baseQ = query(
    collection(db,"approved"),
    orderBy("created","desc"),
    ...(lastCursor ? [startAfter(lastCursor)] : []),
    limit(PAGE)
  );

  const snap = await getDocs(baseQ);
  if(snap.empty){ finished = true; toggleMore(); return; }

  const chunk = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  DATA = DATA.concat(chunk);
  lastCursor = snap.docs[snap.docs.length-1];
  if(snap.size < PAGE) finished = true;

  render();
  toggleMore();
}

function toggleMore(){
  const defaultSort = (sortSel?.value ?? "created_desc") === "created_desc";
  if(moreBtn){
    moreBtn.style.display = defaultSort && !finished ? "inline-block" : "none";
    moreBtn.disabled = finished;
    moreBtn.textContent = finished ? "Hepsi yüklendi" : "Daha fazla yükle";
  }
}

/* ---------- Filtreleme / sıralama ---------- */
function passesFilter(d){
  if(filterDomain?.value){
    const t = sourceType(d.url);
    if(filterDomain.value === "haber" && t !== "news") return false;
    if(filterDomain.value !== "haber" && !d.url.includes(filterDomain.value)) return false;
  }
  const q = norm(qInput?.value);
  if(q){
    // etiketleri aramadan çıkardık
    const hay = norm(`${d.name||""} ${d.description||""} ${d.url}`);
    if(!hay.includes(q)) return false;
  }
  return true;
}

function render(){
  let list = DATA.slice();

  const [field,dir] = (() => {
    if(sortSel?.value==="created_desc") return ["created",-1];
    if(sortSel?.value==="created_asc")  return ["created", 1];
    if(sortSel?.value==="name_asc")     return ["name",    1];
    if(sortSel?.value==="name_desc")    return ["name",   -1];
    return ["created",-1];
  })();

  list.sort((a,b)=>{
    if(field==="created"){
      const av = a.created?.seconds||0, bv = b.created?.seconds||0;
      return dir*(av-bv);
    }else{
      return dir*((a.name||"").localeCompare(b.name||"", "tr"));
    }
  });

  list = list.filter(passesFilter);
  grid.innerHTML = list.map(cardHTML).join("");

  if(window.twttr?.widgets)  window.twttr.widgets.load();
  if(window.instgrm?.Embeds) window.instgrm.Embeds.process();
}

/* ---------- Eventler ---------- */
qInput?.addEventListener("input", ()=>{ render(); toggleMore(); });
sortSel?.addEventListener("change", ()=>{ render(); toggleMore(); });
filterDomain?.addEventListener("change", ()=>{ render(); toggleMore(); });
moreBtn?.addEventListener("click", ()=> loadMore());

/* ---------- İlk yükleme ---------- */
await loadMore(true);
