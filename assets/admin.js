// assets/admin.js  — güncel tam dosya
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut, setPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const db = getFirestore(app);
const auth = getAuth(app);
auth.useDeviceLanguage();

// ❶ Sekme kapanınca oturum bitsin (her girişte hesap seçici gelsin)
await setPersistence(auth, browserSessionPersistence);

// ❷ Hesap seçiciyi zorla
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = s => document.querySelector(s);
const loginBtn = $("#login");
const logoutBtn = $("#logout");
const who = $("#who");
const pending = $("#pending");
const ADMIN_EMAILS = (window.__ADMIN_EMAILS__ || []).map(s => String(s).toLowerCase());

// Hata göster
function showErr(e){
  console.error(e);
  who.textContent = `Giriş hatası: ${e?.code || e?.message || e}`;
}

// Bekleyenleri yükle
async function loadPending(){
  pending.innerHTML = "";
  const snap = await getDocs(collection(db,"pending"));
  snap.forEach(d => {
    const x = d.data();
    const when = x.created?.toDate ? x.created.toDate().toLocaleString() : "";
    const tags = (x.tags||[]).map(t=>`<span class="badge">#${t}</span>`).join(" ");
    pending.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="meta">
          <strong>${x.name||"(İsimsiz)"}</strong>
          <div class="badges">${tags}</div>
          <div><a class="src" href="${x.url}" target="_blank" rel="noopener">Kaynak</a> • <small>${when}</small></div>
          <div class="controls" style="margin-top:.5rem;display:flex;gap:.4rem">
            <button data-act="approve" data-id="${d.id}">Onayla</button>
            <button data-act="reject" data-id="${d.id}">Reddet</button>
          </div>
        </div>
      </div>
    `);
  });
}

// Onay/ret
pending.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const id = btn.dataset.id;
  const ref = doc(db,"pending", id);
  const snap = await getDoc(ref);
  const data = snap.data();
  if(!data) return;

  if(btn.dataset.act === "approve"){
    await addDoc(collection(db,"approved"), {
      name: data.name, url: data.url, tags: data.tags || [],
      created: serverTimestamp()
    });
    await deleteDoc(ref);
  } else {
    await deleteDoc(ref);
  }
  await loadPending();
});

// Giriş (popup; engellenirse redirect)
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

logoutBtn.addEventListener("click", ()=> signOut(auth));

// Oturum durumu
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
