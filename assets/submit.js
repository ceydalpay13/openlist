import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db   = getFirestore(app);

// anonim giriş (hata göster)
(async () => {
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error("Anon login error:", e);
    const m = document.querySelector("#msg");
    if (m) m.textContent = "Giriş hatası: " + (e.code || e.message);
  }
})();

const $   = s => document.querySelector(s);
const form = $("#form");
const msg  = $("#msg");

// izin verilen alanlar
const ALLOW = [
  "twitter.com","x.com","instagram.com","youtube.com","youtu.be",
  "bbc.com","dw.com","hurriyet.com.tr","cumhuriyet.com.tr","sozcu.com.tr",
  "bianet.org","nytimes.com","theguardian.com"
];

function validLink(url){
  try{
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./,'').toLowerCase();
    return ALLOW.some(d => host === d || host.endsWith("." + d));
  }catch{ return false; }
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent = "";

  const name = $("#name").value.trim();
  const url  = $("#link").value.trim();
  const description = ($("#desc")?.value || "").trim();
  const nameLower = name.toLocaleLowerCase("tr");

  if(!name){ msg.textContent = "İsim zorunludur."; return; }
  if(!url || !validLink(url)){ msg.textContent = "Geçerli ve izin verilen bir kaynak linki giriniz."; return; }
  if(description.length > 1000){ msg.textContent = "Açıklama en fazla 1000 karakter olmalı."; return; }

  try{
    // Mükerrer isim kontrolü (approved + pending)
    const qApproved = query(collection(db,"approved"), where("nameLower","==",nameLower), limit(1));
    const qPending  = query(collection(db,"pending"),  where("nameLower","==",nameLower), limit(1));
    const [s1, s2]  = await Promise.all([getDocs(qApproved), getDocs(qPending)]);
    if(!s1.empty || !s2.empty){
      msg.textContent = "Bu isim zaten sistemde mevcut (onaylı veya beklemede).";
      return;
    }

    await addDoc(collection(db, "pending"), {
      name, nameLower, url, description,
      created: serverTimestamp()
    });

    form.reset();
    msg.textContent = "Gönderildi. Onaylandığında listede görünecek.";
  }catch(e){
    console.error("addDoc error:", e);
    msg.textContent = "Kaydetme hatası: " + (e.code || e.message);
  }
});
