const auth = firebase.auth();
const storage = firebase.storage();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// ---------- عناصر الصفحة ----------
const authScreen = document.getElementById('authScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFileName = document.getElementById('progressFileName');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');

const searchInput = document.getElementById('searchInput');
const fileListEl = document.getElementById('fileList');
const emptyState = document.getElementById('emptyState');
const noResults = document.getElementById('noResults');

let currentUser = null;
let unsubscribeFiles = null;
let allFiles = [];

// ---------- تسجيل الدخول / الخروج ----------
googleLoginBtn.addEventListener('click', () => {
  auth.signInWithPopup(provider).catch(err => alert('حصل خطأ في تسجيل الدخول: ' + err.message));
});

logoutBtn.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    userAvatar.src = user.photoURL || '';
    userName.textContent = user.displayName || 'مستخدم';
    userEmail.textContent = user.email || '';
    listenToFiles(user.uid);
  } else {
    authScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    if (unsubscribeFiles) unsubscribeFiles();
    fileListEl.innerHTML = '';
  }
});

// ---------- الرفع ----------
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
  fileInput.value = '';
});

['dragover', 'dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.toggle('dragover', evt === 'dragover');
  });
});
dropzone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

function uploadFile(file) {
  if (!currentUser) return;

  const path = `uploads/${currentUser.uid}/${Date.now()}_${file.name}`;
  const ref = storage.ref(path);
  const task = ref.put(file);

  uploadProgress.classList.remove('hidden');
  progressFileName.textContent = file.name;

  task.on('state_changed',
    snap => {
      const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      progressBar.style.width = pct + '%';
      progressPercent.textContent = pct + '%';
    },
    err => {
      alert('فشل الرفع: ' + err.message);
      uploadProgress.classList.add('hidden');
    },
    async () => {
      const url = await ref.getDownloadURL();
      await db.collection('users').doc(currentUser.uid).collection('files').add({
        name: file.name,
        url,
        path,
        size: file.size,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      uploadProgress.classList.add('hidden');
      progressBar.style.width = '0%';
    }
  );
}

// ---------- عرض الملفات ----------
function listenToFiles(uid) {
  if (unsubscribeFiles) unsubscribeFiles();
  unsubscribeFiles = db.collection('users').doc(uid).collection('files')
    .orderBy('uploadedAt', 'desc')
    .onSnapshot(snap => {
      allFiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFiles(allFiles);
    });
}

function renderFiles(files) {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;

  fileListEl.innerHTML = '';
  emptyState.classList.toggle('hidden', files.length !== 0);
  noResults.classList.toggle('hidden', !(files.length > 0 && filtered.length === 0));

  filtered.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-icon">📄</span>
      <div class="file-meta">
        <div class="file-name">${escapeHtml(file.name)}</div>
        <div class="file-sub">${formatSize(file.size)}</div>
      </div>
      <div class="file-actions">
        <button class="copy-btn" data-url="${file.url}">نسخ اللينك</button>
        <button class="delete-btn" data-id="${file.id}" data-path="${file.path}">حذف</button>
      </div>
    `;
    fileListEl.appendChild(item);
  });

  fileListEl.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.url);
      const old = btn.textContent;
      btn.textContent = 'اتنسخ ✓';
      setTimeout(() => (btn.textContent = old), 1500);
    });
  });

  fileListEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteFile(btn.dataset.id, btn.dataset.path));
  });
}

async function deleteFile(docId, path) {
  if (!confirm('متأكد عايز تمسح الملف ده؟')) return;
  try {
    await storage.ref(path).delete();
  } catch (e) { /* ممكن يكون اتمسح قبل كده من الـ storage، نكمل نمسح السجل برضو */ }
  await db.collection('users').doc(currentUser.uid).collection('files').doc(docId).delete();
}

searchInput.addEventListener('input', () => renderFiles(allFiles));

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(1) + ' ' + units[i];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- مطر الماتريكس ----------
(function initRain(){
  const canvas = document.getElementById('rain');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const chars = 'Ziyad4Upload01アイウエオカキクケコ'.split('');
  let cols, drops;

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.floor(canvas.width / 18);
    drops = Array(cols).fill(0).map(() => Math.random() * -50);
  }
  resize();
  window.addEventListener('resize', resize);

  function draw(){
    ctx.fillStyle = 'rgba(5,7,6,0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#39ffb0';
    ctx.font = '14px monospace';
    drops.forEach((y, i) => {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * 18, y * 18);
      drops[i] = (y * 18 > canvas.height && Math.random() > 0.975) ? 0 : y + 1;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();
