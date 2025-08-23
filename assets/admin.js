// assets/admin.js — kalıcı oturum + hesap seçici + approve/reject + description + nameLower/nameKey
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, getDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app  = initializeApp(window.__FIREBASE_CONFIG__);
const db   = getFirestore(app);
const auth = getAuth(app);
auth.useDeviceLanguage();

// Oturumu kalıcı yap (beni hatırla)
await setPersistence(auth, browserLocalPersistence);

// Hesap seçici (ilk girişte hesabı seçtir)
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = s => document.querySelector(s);
const loginBtn  = $("#login");
const logoutBtn = $("#logout");
const who       = $("#who");
const pendingEl = $("#pending");
const ADMIN_EMAILS = (window.__ADMIN_EMAILS__ || []).map(s => String(s).toLowerCase());

// Türkçe güvenli anahtar (duplicate tespiti için)
function nameKeyOf(s){
  const map = { 'İ':'i','I':'i','ı':'i','Ş':'s','ş':'s','Ğ':'g','ğ':'g','Ü':'u','ü':'u','Ö':'o','ö':'o','Ç':'c','ç':'c' };
  return (s||"")
    .replace(/[İIışğüöçŞĞÜÖÇ]/g, ch => map[ch] ?? ch)
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ")
    .trim();
}

function showErr(e){
  console.error(e);
  if (who) who.textContent = `Giriş/işlem hatası: ${e?.code || e?.message || e}`;
}
const isAdmin = u => !!(u && ADMIN_EMAILS.includes((u.email||"").toLowerCase()));

// Bekleyenleri yükle (yeni → eski)
async function loadPending(){
  try{
    pendingEl.innerHTML = "";
    const snap = await getDocs(query(collection(db,"pending"), orderBy("created","desc")));
    snap.forEach(d => {
      const x = d.data();
      const when = x.created?.toDate ? x.created.toDate().toLocaleString() : "";
      const desc = x.description ? `<div style="margin-top:.35rem;color:var(--muted)">${String(x.description)}</div>` : "";
      pendingEl.insertAdjacentHTML("beforeend", `
        <div class="card">
          <div class="meta">
            <strong>${x.name || "(İsimsiz)"}</strong>
            ${desc}
            <div style="margin-top:.35rem;">
              <a class="src" href="${x.url}" target="_blank" rel="noopener">Kaynak</a> • <small>${when}</small>
            </div>
            <div class="controls" style="margin-top:.5rem;display:flex;gap:.4rem">
              <button data-act="approve" data-id="${d.id}">Onayla</button>
              <button data-act="reject"  data-id="${d.id}">Reddet</button>
            </div>
          </div>
        </div>
      `);
    });
  }catch(e){ showErr(e); }
}

// Onay / Ret
pendingEl.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;

  try{
    const id  = btn.dataset.id;
    const ref = doc(db,"pending", id);
    const snap = await getDoc(ref);
    const data = snap.data();
    if(!data) return;

    if(btn.dataset.act === "approve"){
      const safeName = data.name || "";
      await addDoc(collection(db,"approved"), {
        name: safeName,
        nameLower: safeName.toLocaleLowerCase("tr"),
        nameKey:   nameKeyOf(safeName),
        url: data.url,
        description: data.description || "",
        created: serverTimestamp()
      });
      await deleteDoc(ref);
    }else{
      await deleteDoc(ref);
    }
    await loadPending();
  }catch(e){ showErr(e); }
});

// Giriş (popup; engellenirse redirect)
loginBtn.addEventListener("click", async ()=>{
  try{
    await signInWithPopup(auth, provider);
  }catch(e){
    if (e?.code === "auth/popup-blocked" || e?.code === "auth/cancelled-popup-request") {
      try{ await signInWithRedirect(auth, provider); }
      catch(er2){ showErr(er2); }
    }else{
      showErr(e);
    }
  }
});

// Çıkış
logoutBtn.addEventListener("click", ()=> signOut(auth));

// Oturum durumu
onAuthStateChanged(auth, async (user)=>{
  if(isAdmin(user)){
    who.textContent = `Giriş yapıldı: ${user.email}`;
    loginBtn.style.display  = "none";
    logoutBtn.style.display = "inline-block";
    await loadPending();
  }else if(user){
    who.textContent = `Bu sayfayı görüntüleme yetkiniz yok: ${user.email}`;
    loginBtn.style.display  = "inline-block";
    logoutBtn.style.display = "inline-block";
    pendingEl.innerHTML = "";
  }else{
    who.textContent = "Lütfen Google ile giriş yapınız.";
    loginBtn.style.display  = "inline-block";
    logoutBtn.style.display = "none";
    pendingEl.innerHTML = "";
  }
});
