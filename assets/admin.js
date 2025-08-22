import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut, setPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
auth.useDeviceLanguage();

// ❶ Oturum kalıcılığını "sekme" seviyesine indir (sayfayı kapatınca çıkar)
await setPersistence(auth, browserSessionPersistence);

const provider = new GoogleAuthProvider();
// ❷ Her seferinde hesap seçtir
provider.setCustomParameters({ prompt: "select_account" });

const $ = s=>document.querySelector(s);
const loginBtn = $("#login");
const logoutBtn = $("#logout");
const who = $("#who");
const pending = $("#pending");

// Hata göster
function showErr(e){
  console.error(e);
  who.textContent = `Giriş hatası: ${e?.code || e?.message || e}`;
}

// Pending yükleyen fonksiyonun aynı kalabilir
async function loadPending(){
  pending.innerHTML = "";
  const snap = await getDocs(collection(getFirestore(app),"pending"));
  snap.forEach(docu => {
    const d = docu.data();
    const when = d.created?.toDate ? d.created.toDate().toLocaleString() : "";
    const tags = (d.tags||[]).map(t=>`<span class="badge">#${t}</span>`).join(" ");
    pending.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="meta">
          <strong>${d.name||"(İsimsiz)"}</strong>
          <div class="badges">${tags}</div>
          <div><a class="src" href="${d.url}" target="_blank" rel="noopener">Kaynak</a> • <small>${when}</small></div>
          <div class="controls" style="margin-top:.5rem;display:flex;gap:.4rem">
            <button data-act="approve" data-id="${docu.id}">Onayla</button>
            <button data-act="reject" data-id="${docu.id}">Reddet</button>
          </div>
        </div>
      </div>`);
  });
}

// ❸ Giriş: önce popup dene; engellenirse redirect'e düş
loginBtn.addEventListener("click", async ()=>{
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === "auth/popup-blocked" || e?.code === "auth/cancelled-popup-request") {
      try { await signInWithRedirect(auth, provider); }
      catch (er2) { showErr(er2); }
    } else {
      showErr(e);
    }
  }
});

// Çıkış (hesap değiştirmek için de buna bas)
logoutBtn.addEventListener("click", ()=> signOut(auth));

pending.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const id = btn.dataset.id;
  const ref = doc(collection(getFirestore(app),"pending"), id);
  const snap = await getDoc(ref);
  const d = snap.data();
  if(!d) return;
  if(btn.dataset.act==="approve"){
    await addDoc(collection(getFirestore(app),"approved"), {
      name: d.name, url: d.url, tags: d.tags||[], created: serverTimestamp()
    });
    await deleteDoc(ref);
  }else{
    await deleteDoc(ref);
  }
  await loadPending();
});

// Oturum durumu
onAuthStateChanged(auth, async (user)=>{
  if(user && (window.__ADMIN_EMAILS__||[]).map(s=>s.toLowerCase()).includes((user.email||"").toLowerCase())){
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
