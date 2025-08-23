// assets/submit.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db   = getFirestore(app);

// anonim giriş
(async () => {
  try { await signInAnonymously(auth); }
  catch (e) {
    console.error("Anon login error:", e);
    const m = document.querySelector("#msg");
    if (m) m.textContent = "Giriş hatası: " + (e.code || e.message);
  }
})();

const $    = s => document.querySelector(s);
const form = $("#form");
const msg  = $("#msg");

// izin verilen kaynak alan adları
const ALLOW = [
  "twitter.com","x.com","instagram.com","youtube.com","youtu.be",
  "bbc.com","dw.com","hurriyet.com.tr","cumhuriyet.com.tr","sozcu.com.tr",
  "bianet.org","nytimes.com","theguardian.com","evrensel.net"
];

function validLink(url){
  try{
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./,'').toLowerCase();
    return ALLOW.some(d => host === d || host.endsWith("." + d));
  }catch{ return false; }
}

// Türkçe güvenli anahtar: İ/ı/ş/ğ/ü/ö/ç -> ascii, trim, tek boşluk, tr-lower
function nameKeyOf(s){
  const map = { 'İ':'i','I':'i','ı':'i','Ş':'s','ş':'s','Ğ':'g','ğ':'g','Ü':'u','ü':'u','Ö':'o','ö':'o','Ç':'c','ç':'c' };
  return (s||"")
    .replace(/[İIışğüöçŞĞÜÖÇ]/g, ch => map[ch] ?? ch)
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ")
    .trim();
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent = "";

  const name = $("#name").value.trim();
  const url  = $("#link").value.trim();
  const description = ($("#desc")?.value || "").trim();

  if(!name){ msg.textContent = "İsim zorunludur."; return; }
  if(!url || !validLink(url)){ msg.textContent = "Geçerli ve izin verilen bir kaynak linki giriniz."; return; }
  if(description.length > 1000){ msg.textContent = "Açıklama en fazla 1000 karakter olmalı."; return; }

  const nameLower = name.toLocaleLowerCase("tr");
  const nameKey   = nameKeyOf(name);

  try{
    // ---- Mükerrer kontrol (SADECE approved zorunlu) ----
    const qA1 = query(collection(db,"approved"), where("nameKey","==",nameKey), limit(1));
    const qA2 = query(collection(db,"approved"), where("name","==",name),       limit(1));
    const [a1, a2] = await Promise.all([getDocs(qA1), getDocs(qA2)]);
    if (!a1.empty || !a2.empty) {
      msg.textContent = "Bu isim zaten yayında mevcut.";
      return;
    }

    // (Opsiyonel) pending’de var mı dene; rules read kapalıysa hatayı yut
    let pendingExists = false;
    try {
      const qP1 = query(collection(db,"pending"), where("nameKey","==",nameKey), limit(1));
      const qP2 = query(collection(db,"pending"), where("name","==",name),       limit(1));
      const [p1, p2] = await Promise.all([getDocs(qP1), getDocs(qP2)]);
      pendingExists = !p1.empty || !p2.empty;
    } catch (_) { /* pending read izni yok → yok say */ }
    if (pendingExists) {
      msg.textContent = "Bu isim zaten moderasyon kuyruğunda.";
      return;
    }
    // -----------------------------------------------

    await addDoc(collection(db, "pending"), {
      name, nameLower, nameKey, url, description,
      created: serverTimestamp()
    });

    form.reset();
    msg.textContent = "Gönderildi. Onaylandığında listede görünecek.";
  }catch(e){
    console.error("addDoc error:", e);
    msg.textContent = "Kaydetme hatası: " + (e.code || e.message);
  }
});
