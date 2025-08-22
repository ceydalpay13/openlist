import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAILS = (window.__ADMIN_EMAILS__ || []).map(s=>String(s).toLowerCase());

const $ = s=>document.querySelector(s);
const loginBtn = $("#login");
const logoutBtn = $("#logout");
const who = $("#who");
const pending = $("#pending");

function cardHTML(id, d){
  const when = d.created?.toDate ? d.created.toDate().toLocaleString() : "";
  const tags = (d.tags||[]).map(t=>`<span class="badge">#${t}</span>`).join(" ");
  return `<div class="card">
    <div class="meta">
      <strong>${d.name||"(İsimsiz)"}</strong>
      <div class="badges">${tags}</div>
      <div><a class="src" href="${d.url}" target="_blank" rel="noopener">Kaynak</a> • <small>${when}</small></div>
      <div class="controls" style="margin-top:.5rem;display:flex;gap:.4rem">
        <button data-act="approve" data-id="${id}">Onayla</button>
        <button data-act="reject" data-id="${id}">Reddet</button>
      </div>
    </div>
  </div>`;
}

async function loadPending(){
  pending.innerHTML = "";
  const snap = await getDocs(collection(db,"pending"));
  snap.forEach(docu => {
    pending.insertAdjacentHTML("beforeend", cardHTML(docu.id, docu.data()));
  });
}

pending.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const id = btn.dataset.id;
  const ref = doc(collection(db,"pending"), id);
  const snap = await getDoc(ref);
  const d = snap.data();
  if(!d) return;

  if(btn.dataset.act==="approve"){
    await addDoc(collection(db,"approved"), {
      name: d.name, url: d.url, tags: d.tags||[],
      created: serverTimestamp()
    });
    await deleteDoc(ref);
  }else if(btn.dataset.act==="reject"){
    await deleteDoc(ref);
  }
  await loadPending();
});

loginBtn.addEventListener("click", async ()=>{
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
});
logoutBtn.addEventListener("click", ()=> signOut(auth));

onAuthStateChanged(auth, async (user)=>{
  if(user && ADMIN_EMAILS.includes((user.email||"").toLowerCase())){
    who.textContent = `Giriş yapıldı: ${user.email}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    await loadPending();
  }else if(user){
    who.textContent = `Bu sayfayı görüntüleme yetkiniz yok: ${user.email}`;
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "inline-block";
    pending.innerHTML = "";
  }else{
    who.textContent = "Lütfen Google ile giriş yapınız.";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    pending.innerHTML = "";
  }
});
