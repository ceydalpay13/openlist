import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db = getFirestore(app);
await signInAnonymously(auth);

const $ = s=>document.querySelector(s);
const form = $("#form");
const msg = $("#msg");

// izin verilen alanlar (gerekirse ekle/çıkar)
const ALLOW = [
  "twitter.com","x.com","instagram.com","youtube.com","youtu.be",
  "bbc.com","dw.com","hurriyet.com.tr","cumhuriyet.com.tr","sozcu.com.tr","bianet.org","nytimes.com","theguardian.com"
];

function validLink(url){
  try{
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./,'').toLowerCase();
    return ALLOW.some(d=> host===d || host.endsWith("."+d));
  }catch{ return false; }
}
function parseTags(s){
  return (s||"").split(/\s+/).map(t=>t.replace(/^#/,'').trim()).filter(Boolean).slice(0,10);
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent = "";
  const name = $("#name").value.trim();
  const url = $("#link").value.trim();
  const tags = parseTags($("#tags").value);

  if(!name) return msg.textContent = "İsim zorunludur.";
  if(!url || !validLink(url)) return msg.textContent = "Geçerli ve izin verilen bir kaynak linki giriniz.";

  await addDoc(collection(db,"pending"), {
    name, url, tags,
    created: serverTimestamp()
  });
  form.reset();
  msg.textContent = "Gönderildi. Onaylandığında listede görünecek.";
});
