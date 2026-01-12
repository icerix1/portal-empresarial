// ========================================
// SISTEMA DE IDIOMAS
// ========================================
const translations = {
    es: {
        portal: 'Blog de Icerix',
        documents: 'Documentos',
        publications: 'Publicaciones',
        adminMode: '🔐 Modo Administrador activo',
        docManagement: 'Gestión de Documentos',
        filesAvailable: 'Archivos disponibles para descarga',
        uploadFile: 'Subir Archivo',
        dragFiles: 'Arrastre sus archivos aquí',
        orClickSelect: 'o haga clic para seleccionar',
        selectFile: 'Seleccionar Archivo',
        availableFiles: 'Archivos Disponibles',
        name: 'Nombre',
        size: 'Tamaño',
        date: 'Fecha',
        actions: 'Acciones',
        noFiles: 'No hay archivos disponibles',
        newsContent: 'Contenido y novedades',
        newPost: 'Nueva Publicación',
        titleEs: 'Título (ES)',
        contentEs: 'Contenido (ES)',
        enterTitleEs: 'Ingrese el título en español',
        writeContentEs: 'Escriba el contenido en español...',
        titleEn: 'Título (EN)',
        contentEn: 'Contenido (EN)',
        enterTitleEn: 'Ingrese el título en inglés',
        writeContentEn: 'Escriba el contenido en inglés...',
        title: 'Título',
        content: 'Contenido',
        enterTitle: 'Ingrese el título',
        writeContent: 'Escriba el contenido...',
        publish: 'Publicar',
        recentPosts: 'Publicaciones Recientes',
        noPosts: 'No hay publicaciones disponibles',
        copyright: '© 2026 Blog de Icerix. Todos los derechos reservados.',
        delete: 'Eliminar',
        comments: 'Comentarios',
        yourName: 'Tu nombre',
        writeComment: 'Escribe un comentario...',
        comment: 'Comentar',
        anonymous: 'Anónimo',
        admin: 'Admin',
        completeFields: 'Complete todos los campos',
        writeCommentAlert: 'Escribe un comentario',
        selectFolder: 'Subir Carpeta',
        deleteAll: 'Eliminar Todo',
        deleteAllConfirm: '¿Estás seguro de que quieres eliminar TODOS los archivos? Esta acción no se puede deshacer.',
        download: 'Descargar',
        donatePaypal: 'Donaciones por PayPal',
        back: 'Volver',
        translationMissing: 'Sin traducción disponible'
    },
    en: {
        portal: "Icerix's blog",
        documents: 'Documents',
        publications: 'Publications',
        adminMode: '🔐 Administrator Mode active',
        docManagement: 'Document Management',
        filesAvailable: 'Files available for download',
        uploadFile: 'Upload File',
        dragFiles: 'Drag your files here',
        orClickSelect: 'or click to select',
        selectFile: 'Select File',
        availableFiles: 'Available Files',
        name: 'Name',
        size: 'Size',
        date: 'Date',
        actions: 'Actions',
        noFiles: 'No files available',
        newsContent: 'News and updates',
        newPost: 'New Post',
        titleEs: 'Title (ES)',
        contentEs: 'Content (ES)',
        enterTitleEs: 'Enter the Spanish title',
        writeContentEs: 'Write the Spanish content...',
        titleEn: 'Title (EN)',
        contentEn: 'Content (EN)',
        enterTitleEn: 'Enter the English title',
        writeContentEn: 'Write the English content...',
        title: 'Title',
        content: 'Content',
        enterTitle: 'Enter the title',
        writeContent: 'Write your content...',
        publish: 'Publish',
        recentPosts: 'Recent Posts',
        noPosts: 'No posts available',
        copyright: "© 2026 Icerix's blog. All rights reserved.",
        delete: 'Delete',
        comments: 'Comments',
        yourName: 'Your name',
        writeComment: 'Write a comment...',
        comment: 'Comment',
        anonymous: 'Anonymous',
        admin: 'Admin',
        completeFields: 'Please complete all fields',
        writeCommentAlert: 'Please write a comment',
        selectFolder: 'Upload Folder',
        deleteAll: 'Delete All',
        deleteAllConfirm: 'Are you sure you want to delete ALL files? This action cannot be undone.',
        download: 'Download',
        donatePaypal: 'Donate via PayPal',
        back: 'Back',
        translationMissing: 'No translation available'
    }
};

const PAYPAL_DONATION_URL = 'https://paypal.me/TizianoSavoini';

let currentLang = localStorage.getItem('lang') || 'en';

function t(key) {
    return translations[currentLang][key] || key;
}

function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang][key]) {
            el.placeholder = translations[currentLang][key];
        }
    });

    const langEl = document.getElementById('currentLang');
    if (langEl) langEl.textContent = currentLang.toUpperCase();
    document.documentElement.lang = currentLang;

    if (typeof window.renderFiles === 'function') window.renderFiles();
    if (typeof window.renderBlogs === 'function') window.renderBlogs();
}

function toggleLanguage() {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    localStorage.setItem('lang', currentLang);
    updateLanguage();
}

// ========================================
// CONFIGURACIÓN ADMIN
// ========================================
const ADMIN_RADIUS_METERS = 150;

function decodeLocation(encoded) {
    try {
        const decoded = atob(encoded);
        const parts = decoded.split('|');
        return { lat: parseFloat(parts[0]), lon: parseFloat(parts[1]) };
    } catch (e) {
        return null;
    }
}

function encodeLocation(lat, lon) {
    return btoa(`${lat}|${lon}`);
}

let isAdmin = false;
let adminLocation = null;

// Cargar ubicación guardada
const savedLoc = localStorage.getItem('_adminLocEnc');
if (savedLoc) {
    adminLocation = decodeLocation(savedLoc);
}

// ========================================
// DOM Ready
// ========================================
document.addEventListener('DOMContentLoaded', function () {

    // Language toggle
    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.addEventListener('click', toggleLanguage);
    updateLanguage();

    document.querySelectorAll('[data-paypal-donate]').forEach((el) => {
        el.setAttribute('href', PAYPAL_DONATION_URL);
    });

    // ========================================
    // Triple-click en logo para setup admin
    // ========================================
    let clickCount = 0;
    let clickTimer = null;
    const logo = document.querySelector('.logo');

    if (logo) {
        logo.addEventListener('click', () => {
            clickCount++;
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 600);

            if (clickCount >= 3) {
                clickCount = 0;
                setupAdminLocation();
            }
        });
    }

    function ensureAdminSetupOverlay() {
        let overlay = document.getElementById('adminSetupOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'adminSetupOverlay';
        overlay.className = 'zip-overlay hidden';
        overlay.innerHTML = `
            <div class="zip-overlay-card">
                <div class="zip-overlay-title">Código de configuración</div>
                <div class="zip-overlay-sub">Ingresá el código para guardar esta ubicación como admin.</div>
                <div style="margin: 12px 0;">
                    <input id="adminSetupCodeInput" type="password" class="form-control" placeholder="Código" autocomplete="one-time-code">
                </div>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button class="btn btn-outline" id="adminSetupCancelBtn" type="button">Cancelar</button>
                    <button class="btn btn-primary" id="adminSetupOkBtn" type="button">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function requestAdminSetupCode() {
        return new Promise((resolve) => {
            const overlay = ensureAdminSetupOverlay();
            const input = overlay.querySelector('#adminSetupCodeInput');
            const okBtn = overlay.querySelector('#adminSetupOkBtn');
            const cancelBtn = overlay.querySelector('#adminSetupCancelBtn');

            const cleanup = () => {
                if (okBtn) okBtn.onclick = null;
                if (cancelBtn) cancelBtn.onclick = null;
                if (input) input.onkeydown = null;
            };

            const close = (value) => {
                cleanup();
                overlay.classList.add('hidden');
                resolve(value);
            };

            overlay.classList.remove('hidden');
            if (input) {
                input.value = '';
                input.focus();
            }

            if (okBtn) okBtn.onclick = () => close(input ? input.value : '');
            if (cancelBtn) cancelBtn.onclick = () => close(null);
            if (input) {
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') close(input.value);
                    if (e.key === 'Escape') close(null);
                };
            }
        });
    }

    async function setupAdminLocation() {
        const password = await requestAdminSetupCode();
        if (password == null) return;
        if (password !== 'setup2026') {
            alert('Código incorrecto');
            return;
        }

        if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const encoded = encodeLocation(position.coords.latitude, position.coords.longitude);
                localStorage.setItem('_adminLocEnc', encoded);
                adminLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
                isAdmin = true;

                // Guardar UID del admin en Firestore
                const auth = firebase.auth && firebase.auth();
                if (auth) {
                    const saveUid = (u) => {
                        if (!u) {
                            console.error('No hay usuario autenticado para guardar UID admin');
                            return;
                        }
                        const adminUid = u.uid;
                        db.collection('config').doc('admin').set({ uid: adminUid }, { merge: true })
                            .then(() => console.log('Admin UID guardado en Firestore'))
                            .catch(err => console.error('Error guardando admin UID:', err));
                    };

                    if (auth.currentUser) {
                        saveUid(auth.currentUser);
                    } else {
                        const unsubscribe = auth.onAuthStateChanged((u) => {
                            if (u) {
                                try { unsubscribe(); } catch (e) { }
                                saveUid(u);
                            }
                        });
                        setTimeout(() => {
                            try { unsubscribe(); } catch (e) { }
                            saveUid(auth.currentUser);
                        }, 5000);
                    }
                }

                checkAdminStatus();
                alert('✅ Ubicación admin guardada!\n\nAhora eres admin.');
                console.log('Código encriptado:', encoded);
            },
            (error) => {
                alert('Error al obtener ubicación: ' + error.message + '\n\nPermite el acceso a la ubicación.');
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    }

    // ========================================
    // Admin Status
    // ========================================
    function checkAdminStatus() {
        const adminElements = document.querySelectorAll('.admin-only');
        const adminHeaders = document.querySelectorAll('.admin-only-header');
        const adminBanner = document.getElementById('adminBanner');

        if (isAdmin) {
            adminElements.forEach(el => el.style.display = 'block');
            adminHeaders.forEach(el => el.style.display = 'table-cell');
            if (adminBanner) adminBanner.style.display = 'flex';
        } else {
            adminElements.forEach(el => el.style.display = 'none');
            adminHeaders.forEach(el => el.style.display = 'none');
            if (adminBanner) adminBanner.style.display = 'none';
        }

        window.renderFiles();
        window.renderBlogs();
    }

    function getDistanceMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function checkLocationOnLoad() {
        if (!adminLocation || !navigator.geolocation) {
            checkAdminStatus();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const distance = getDistanceMeters(
                    position.coords.latitude,
                    position.coords.longitude,
                    adminLocation.lat,
                    adminLocation.lon
                );
                console.log('Distancia:', Math.round(distance), 'metros');

                if (distance <= ADMIN_RADIUS_METERS) {
                    isAdmin = true;
                }
                checkAdminStatus();
            },
            () => {
                checkAdminStatus();
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // ========================================
    // Navigation
    // ========================================
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = link.dataset.tab;
            if (!tabName) return;

            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
        });
    });

    const config = {
        apiKey: "AIzaSyA8K0w-qTKs9WkcOoSSXLgjfiT8fMprR1g",
        authDomain: "compresor-de-archivos-15e3a.firebaseapp.com",
        projectId: "compresor-de-archivos-15e3a",
        storageBucket: "compresor-de-archivos-15e3a.firebasestorage.app",
        messagingSenderId: "1075076139650",
        appId: "1:1075076139650:web:0ded5b31cecf72b10f429b",
        measurementId: "G-PRTN16Q3SM"
    };
    const DEFAULT_RUST_API_BASE_URL = 'https://portal-backend-ktjoryazzq-uc.a.run.app';
    const RUST_API_BASE_URL = (() => {
        const normalize = (value) => String(value || '').trim().replace(/\/+$/, '');
        try {
            const v = localStorage.getItem('RUST_API_BASE_URL');
            if (v && String(v).trim()) return normalize(v);
        } catch (e) { }
        const meta = document.querySelector('meta[name="rust-api-base-url"]');
        const content = meta ? meta.getAttribute('content') : '';
        if (content && String(content).trim()) return normalize(content);
        const w = typeof window.RUST_API_BASE_URL === 'string' ? window.RUST_API_BASE_URL : '';
        if (w && String(w).trim()) return normalize(w);
        const host = window.location && window.location.hostname ? String(window.location.hostname).toLowerCase() : '';
        if (!host || host === 'localhost' || host === '127.0.0.1') return '';
        if (host.endsWith('github.io')) return DEFAULT_RUST_API_BASE_URL;
        return DEFAULT_RUST_API_BASE_URL;
    })();

    // Initialize Firebase
    let db, storage;
    try {
        firebase.initializeApp(config);
        db = firebase.firestore();
        storage = firebase.storage();
        try { db.enablePersistence({ synchronizeTabs: true }).catch(() => { }); } catch (e) { }

        // Hide warning if successful
        const warning = document.getElementById('firebase-warning');
        if (warning) warning.style.display = 'none';
        console.log("Firebase initialized successfully");
    } catch (e) {
        console.error("Firebase Init Error:", e);
        const warning = document.getElementById('firebase-warning');
        if (warning) warning.style.display = 'flex';
    }

    // State
    let currentPath = [];
    let currentPathKey = '';
    let currentFolderItems = [];
    let folderSizeBytesByFullPathKey = new Map();
    let folderSizeInFlightByFullPathKey = new Map();
    let blogPosts = [];
    let blogDraftsByPostId = new Map();
    let listenersStarted = false;
    let permissionAlertShown = false;
    let activeUploadSession = null;
    let filesUnsubscribe = null;
    let renderFilesQueued = false;
    let renderBlogsQueued = false;

    function makePathKey(pathArray) {
        const arr = Array.isArray(pathArray) ? pathArray : [];
        if (arr.length === 0) return '';
        return arr.map(v => String(v)).join('\u0001');
    }

    function setCurrentPath(pathArray) {
        currentPath = Array.isArray(pathArray) ? pathArray : [];
        currentPathKey = makePathKey(currentPath);
        currentFolderItems = [];
        if (listenersStarted) subscribeFilesForCurrentPath();
    }

    function queueRenderFiles() {
        if (renderFilesQueued) return;
        renderFilesQueued = true;
        requestAnimationFrame(() => {
            renderFilesQueued = false;
            if (typeof window.renderFiles === 'function') window.renderFiles();
        });
    }

    function queueRenderBlogs() {
        if (renderBlogsQueued) return;
        renderBlogsQueued = true;
        requestAnimationFrame(() => {
            renderBlogsQueued = false;
            if (typeof window.renderBlogs === 'function') window.renderBlogs();
        });
    }

    async function computeFolderSizeBytes(folderFullPathArray) {
        if (!db) return 0;
        const queue = [folderFullPathArray];
        const visited = new Set();
        let total = 0;

        while (queue.length) {
            const p = queue.shift();
            const key = makePathKey(p);
            if (visited.has(key)) continue;
            visited.add(key);

            const snap = await db.collection('files').where('path', '==', p).get();
            snap.forEach((doc) => {
                const data = doc.data() || {};
                if (data.type === 'file') {
                    if (typeof data.rawSize === 'number' && data.rawSize > 0) total += data.rawSize;
                } else if (data.type === 'folder' && data.name) {
                    queue.push([...p, data.name]);
                }
            });
        }
        return total;
    }

    function subscribeFilesForCurrentPath() {
        if (!db) return;
        if (typeof filesUnsubscribe === 'function') {
            try { filesUnsubscribe(); } catch (e) { }
        }

        const filesContainer = document.getElementById('filesContainer');
        if (filesContainer) filesContainer.innerHTML = '<tr class="loading-row"><td colspan="4">🔄 Cargando archivos...</td></tr>';

        const pathValue = currentPath.slice();
        filesUnsubscribe = db.collection('files').where('path', '==', pathValue).onSnapshot(
            (snapshot) => {
                currentFolderItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                queueRenderFiles();
            },
            handleListenerError
        );
    }

    function handleListenerError(error) {
        console.error("Firestore listener error:", error);
        if (!permissionAlertShown && error && error.code === 'permission-denied') {
            permissionAlertShown = true;
            alert('FirebaseError: Missing or insufficient permissions. Revisa las reglas de Firestore y/o habilita Anonymous Auth.');
        }
    }

    function startRealtimeListeners() {
        if (!db || listenersStarted) return;
        listenersStarted = true;

        // Mostrar indicadores de carga
        const blogsContainer = document.getElementById('blogsContainer');
        if (blogsContainer) blogsContainer.innerHTML = '<p class="loading-message">🔄 Cargando publicaciones...</p>';

        if (!currentPathKey) setCurrentPath([]);
        subscribeFilesForCurrentPath();

        db.collection('posts').orderBy('id', 'desc').onSnapshot(
            (snapshot) => {
                blogPosts = snapshot.docs.map((doc) => ({ ...doc.data(), firebaseId: doc.id }));
                queueRenderBlogs();
            },
            handleListenerError
        );
    }

    if (db && firebase.auth) {
        const auth = firebase.auth();
        auth.onAuthStateChanged((user) => {
            if (user) startRealtimeListeners();
        });
        auth.signInAnonymously().catch((error) => {
            console.error("Anonymous sign-in failed:", error);
        });
    } else {
        startRealtimeListeners();
    }

    // ========================================
    // File Management (Firebase)
    // ========================================
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');

    // --- Drop Zone Listeners ---
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const items = e.dataTransfer.items;
            if (items) processItems(items);
            else handleFiles(e.dataTransfer.files);
        });
    }

    if (fileInput) fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });
    if (folderInput) folderInput.addEventListener('change', (e) => { handleFiles(e.target.files); });

    // --- File Processing ---
    function processItems(items) {
        if (!isAdmin) return;
        let entryPromises = [];
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            if (item.kind === 'file') {
                let entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) entryPromises.push(traverseFileTree(entry, currentPath));
            }
        }
        Promise.all(entryPromises).then(() => {
            // No need to call saveFiles or renderFiles here, onSnapshot will handle it
        });
    }

    function traverseFileTree(item, path) {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    uploadFileToFirebase(file, path);
                    resolve();
                });
            } else if (item.isDirectory) {
                let dirReader = item.createReader();
                let entries = [];
                const readEntries = () => {
                    dirReader.readEntries((result) => {
                        if (result.length > 0) {
                            entries = entries.concat(result);
                            readEntries();
                        } else {
                            let newPath = [...path, item.name];
                            ensureFolderExists(newPath);
                            let promises = entries.map(entry => traverseFileTree(entry, newPath));
                            Promise.all(promises).then(resolve);
                        }
                    });
                };
                readEntries();
            }
        });
    }

    function ensureUploadOverlay() {
        let overlay = document.getElementById('uploadOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'uploadOverlay';
        overlay.className = 'zip-overlay hidden';
        overlay.innerHTML = `
            <div class="zip-overlay-card">
                <div class="zip-overlay-title">Subiendo…</div>
                <div class="zip-overlay-sub" id="uploadOverlaySub">Preparando…</div>
                <div class="zip-overlay-bar"><div class="zip-overlay-fill" id="uploadOverlayFill"></div></div>
                <div class="zip-overlay-percent" id="uploadOverlayPercent">0%</div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function setUploadOverlay(visible, percent, text) {
        const overlay = ensureUploadOverlay();
        const sub = overlay.querySelector('#uploadOverlaySub');
        const fill = overlay.querySelector('#uploadOverlayFill');
        const pct = overlay.querySelector('#uploadOverlayPercent');
        if (visible) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
        if (typeof percent === 'number') {
            const clamped = Math.max(0, Math.min(100, percent));
            if (fill) fill.style.width = clamped + '%';
            if (pct) pct.textContent = Math.round(clamped) + '%';
        }
        if (sub && typeof text === 'string') sub.textContent = text;
    }

    function getUploadUniqueId() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        } catch (e) { }
        return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    }

    function sanitizeStorageSegment(seg) {
        return String(seg || '').replace(/[\\/]/g, '_');
    }

    function buildUploadStoragePath(pathArray, fileName) {
        const safeParts = (pathArray || []).map(sanitizeStorageSegment).filter(Boolean);
        const safeName = sanitizeStorageSegment(fileName);
        const unique = getUploadUniqueId();
        const dir = safeParts.length ? safeParts.join('/') + '/' : '';
        return `uploads/${dir}${unique}_${safeName}`;
    }

    function buildUploadStoragePrefix(pathArray) {
        const safeParts = (pathArray || []).map(sanitizeStorageSegment).filter(Boolean);
        const dir = safeParts.length ? safeParts.join('/') + '/' : '';
        return `uploads/${dir}`;
    }

    async function handleFiles(files) {
        if (!isAdmin) return;
        const auth = firebase.auth && firebase.auth();
        if (!auth || !auth.currentUser) {
            console.error('❌ No hay usuario autenticado todavía. Espera 2 segundos y reintenta.');
            alert('Esperá un momento: Firebase todavía está autenticando. Reintentá en 2 segundos.');
            return;
        }

        const list = Array.from(files || []);
        if (!list.length) return;

        activeUploadSession = {
            startedAt: Date.now(),
            totalFiles: list.length,
            totalBytes: list.reduce((acc, f) => acc + (f && f.size ? f.size : 0), 0),
            completed: 0,
            failed: 0,
            okBytes: 0,
            failedItems: []
        };

        const session = activeUploadSession;
        setUploadOverlay(true, 0, `0/${session.totalFiles} - ${formatFileSize(0)}/${formatFileSize(session.totalBytes)}`);

        let cursor = 0;
        const concurrency = Math.min(3, session.totalFiles);

        const worker = async () => {
            while (cursor < list.length) {
                const idx = cursor;
                cursor += 1;
                const file = list[idx];

                let path = [...currentPath];
                if (file && file.webkitRelativePath) {
                    const parts = file.webkitRelativePath.split('/');
                    parts.pop();
                    if (parts.length > 0) {
                        path = [...currentPath, ...parts];
                        let tempPath = [...currentPath];
                        for (let part of parts) {
                            tempPath.push(part);
                            ensureFolderExists(tempPath);
                        }
                    }
                }

                let ok = false;
                let errMsg = '';
                try {
                    const result = await uploadFileToFirebase(file, path);
                    ok = !!(result && result.ok);
                    if (!ok && result && result.error) errMsg = String(result.error && result.error.message ? result.error.message : result.error);
                } catch (e) {
                    ok = false;
                    errMsg = String(e && e.message ? e.message : e);
                }

                session.completed += 1;
                if (ok) session.okBytes += (file && file.size ? file.size : 0);
                else {
                    session.failed += 1;
                    session.failedItems.push({
                        name: file && file.name ? file.name : '(sin nombre)',
                        size: file && file.size ? file.size : 0,
                        error: errMsg
                    });
                }

                const pct = (session.completed / session.totalFiles) * 100;
                const statusText = `${session.completed}/${session.totalFiles}${session.failed ? ` (fallidos: ${session.failed})` : ''} - ${formatFileSize(session.okBytes)}/${formatFileSize(session.totalBytes)}`;
                setUploadOverlay(true, pct, statusText);
                await new Promise(r => setTimeout(r, 0));
            }
        };

        try {
            await Promise.all(Array.from({ length: concurrency }, () => worker()));
        } finally {
            setUploadOverlay(false, 100, '');
        }

        if (session.failed || session.okBytes !== session.totalBytes) {
            const sample = session.failedItems.slice(0, 10).map(f => `- ${f.name} (${formatFileSize(f.size)})${f.error ? `: ${f.error}` : ''}`).join('\n');
            alert(
                `Subida terminada con problemas.\n` +
                `Archivos: ${session.completed}/${session.totalFiles}\n` +
                `Fallidos: ${session.failed}\n` +
                `Bytes OK: ${formatFileSize(session.okBytes)} / ${formatFileSize(session.totalBytes)}\n\n` +
                (sample ? `Ejemplos de fallidos:\n${sample}` : '')
            );
        }
    }

    function ensureFolderExists(pathArray) {
        if (!isAdmin) return;
        const parentPath = pathArray.slice(0, -1);
        const folderName = pathArray[pathArray.length - 1];
        const encodeId = (input) => {
            try {
                return btoa(unescape(encodeURIComponent(String(input))))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/g, '');
            } catch (e) {
                return Date.now().toString(36);
            }
        };

        const fullPathKey = makePathKey(pathArray);
        const folderDocId = `folder_${encodeId(fullPathKey)}`;

        db.collection('files').doc(folderDocId).set({
            type: 'folder',
            name: folderName,
            size: '-',
            date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US'),
            path: parentPath,
            pathKey: makePathKey(parentPath),
            parentId: 'virtual'
        }, { merge: true });
    }

    function uploadFileToFirebase(file, pathArray) {
        if (!isAdmin) return Promise.resolve({ ok: false, stage: 'admin', error: new Error('Not admin') });
        const auth = firebase.auth && firebase.auth();
        if (!auth || !auth.currentUser) {
            console.error(`❌ No hay usuario autenticado todavía. No se puede subir ${file.name}.`);
            return Promise.resolve({ ok: false, stage: 'auth', error: new Error('No authenticated user') });
        }
        return new Promise((resolve) => {
            const filesContainer = document.getElementById('filesContainer');
            const progressRow = document.createElement('tr');
            progressRow.className = 'upload-progress-row';
            progressRow.innerHTML = `
                <td colspan="4">
                    <div class="upload-progress">
                        <span>⬆️ ${escapeHtml(file.name)}</span>
                        <div class="progress-bar"><div class="progress-fill"></div></div>
                        <span class="progress-percent">0%</span>
                    </div>
                </td>
            `;
            if (filesContainer) filesContainer.appendChild(progressRow);

            const storageRef = storage.ref();
            const objectPath = buildUploadStoragePath(pathArray, file.name);
            const fileRef = storageRef.child(objectPath);
            const uploadTask = fileRef.put(file);

            uploadTask.on(
                'state_changed',
                (snap) => {
                    const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
                    const progressFill = progressRow.querySelector('.progress-fill');
                    const progressPercent = progressRow.querySelector('.progress-percent');
                    if (progressFill) progressFill.style.width = progress + '%';
                    if (progressPercent) progressPercent.textContent = Math.round(progress) + '%';
                },
                (error) => {
                    console.error(`❌ Error uploading ${file.name}:`, error);
                    try { progressRow.remove(); } catch (e) { }
                    resolve({ ok: false, stage: 'upload', error });
                },
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        try {
                            const metadata = {
                                type: 'file',
                                name: file.name,
                                size: formatFileSize(file.size),
                                rawSize: file.size,
                                path: pathArray,
                                pathKey: makePathKey(pathArray),
                                date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US'),
                                url: downloadURL,
                                storagePath: uploadTask.snapshot.ref.fullPath
                            };

                            const bucketName = (firebase.app && firebase.app().options && firebase.app().options.storageBucket)
                                ? firebase.app().options.storageBucket
                                : null;
                            if (bucketName) metadata.bucket = bucketName;

                            const rel = file && file.webkitRelativePath ? String(file.webkitRelativePath) : '';
                            if (rel) metadata.relativePath = rel;

                            db.collection('files').add(metadata).then((docRef) => {
                                console.log(`✅ Uploaded: ${file.name}`);
                                try {
                                    if (makePathKey(pathArray) === currentPathKey && docRef && docRef.id) {
                                        currentFolderItems.unshift({ id: docRef.id, ...metadata });
                                        queueRenderFiles();
                                    }
                                } catch (e) { }
                                try { progressRow.remove(); } catch (e) { }
                                resolve({ ok: true });
                            }).catch((error) => {
                                console.error(`❌ Error saving metadata for ${file.name}:`, error);
                                try { progressRow.remove(); } catch (e) { }
                                resolve({ ok: false, stage: 'firestore', error });
                            });
                        } catch (error) {
                            console.error(`❌ Error building metadata for ${file.name}:`, error);
                            try { progressRow.remove(); } catch (e) { }
                            resolve({ ok: false, stage: 'firestore', error });
                        }
                    }).catch((error) => {
                        console.error(`❌ Error getting download URL for ${file.name}:`, error);
                        try { progressRow.remove(); } catch (e) { }
                        resolve({ ok: false, stage: 'downloadURL', error });
                    });
                }
            );
        });
    }

    // --- Rendering ---
    function calculateFolderSize(folder) {
        const p = Array.isArray(folder.path) ? folder.path : [];
        const folderFullPath = [...p, folder.name];
        const folderKey = makePathKey(folderFullPath);
        if (folderSizeBytesByFullPathKey.has(folderKey)) {
            return formatFileSize(folderSizeBytesByFullPathKey.get(folderKey) || 0);
        }

        if (!folderSizeInFlightByFullPathKey.has(folderKey)) {
            const promise = computeFolderSizeBytes(folderFullPath).then((bytes) => {
                folderSizeBytesByFullPathKey.set(folderKey, bytes);
                folderSizeInFlightByFullPathKey.delete(folderKey);
                queueRenderFiles();
                return bytes;
            }).catch(() => {
                folderSizeInFlightByFullPathKey.delete(folderKey);
            });
            folderSizeInFlightByFullPathKey.set(folderKey, promise);
        }

        return '…';
    }

    function getFileDisplaySize(item) {
        const raw = (typeof item.rawSize === 'number')
            ? item.rawSize
            : (typeof item.rawSize === 'string' ? Number(item.rawSize) : NaN);
        if (Number.isFinite(raw) && raw >= 0) return formatFileSize(raw);
        if (typeof item.size === 'string' && item.size.trim()) return item.size;
        return '-';
    }

    window.renderFiles = function () {
        const filesContainer = document.getElementById('filesContainer');
        const breadcrumbs = document.getElementById('breadcrumbs');
        if (!filesContainer) return;

        // Breadcrumbs
        renderBreadcrumbs(breadcrumbs);

        // Filter items for current path
        const items = currentFolderItems.slice();

        // Sort: Folders first, then files
        items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        if (items.length === 0) {
            filesContainer.innerHTML = `<tr class="empty-row"><td colspan="4">${t('noFiles')}</td></tr>`;
            return;
        }

        const rustBase = typeof RUST_API_BASE_URL === 'string' ? RUST_API_BASE_URL.trim() : '';
        const bucketDefault = (firebase.app && firebase.app().options && firebase.app().options.storageBucket)
            ? firebase.app().options.storageBucket
            : '';
        const rustDownloadBase = rustBase ? rustBase.replace(/\/+$/, '') + '/v1/download' : '';

        filesContainer.innerHTML = items.map(item => {
            const icon = item.type === 'folder' ? '📁' : '📄';
            const iconClass = item.type === 'folder' ? 'icon-folder' : 'icon-file';
            const onclick = item.type === 'folder' ? `onclick="navigateTo('${item.name}')"` : '';
            const size = item.type === 'folder' ? '-' : getFileDisplaySize(item);
            const downloadLabel = t('download');
            const deleteLabel = t('delete');
            let downloadHref = item && item.url ? String(item.url) : '';
            if (item && item.type === 'file' && rustDownloadBase) {
                const storagePath = item.storagePath || getStoragePathFromDownloadUrl(downloadHref);
                const bucketName = item.bucket || getBucketFromDownloadUrl(downloadHref) || bucketDefault;
                if (storagePath && bucketName) {
                    downloadHref = `${rustDownloadBase}?bucket=${encodeURIComponent(bucketName)}&filePath=${encodeURIComponent(storagePath)}`;
                }
            }
            const actionBtn = item.type === 'folder'
                ? `<button class="btn-action btn-action-primary" onclick="downloadFolder('${item.id}')" type="button">${downloadLabel}</button>`
                : `<a href="${downloadHref}" target="_blank" rel="noopener noreferrer" class="btn-action btn-action-primary" download>${downloadLabel}</a>`;

            return `
            <tr>
                <td>
                    <span class="file-icon ${iconClass}">${icon}</span>
                    <span class="file-name ${item.type === 'folder' ? 'is-folder' : ''}" ${onclick}>${escapeHtml(item.name)}</span>
                </td>
                <td>${size}</td>
                <td>${item.date}</td>
                <td class="actions-cell">
                    ${actionBtn}
                    <button class="btn-action btn-action-danger ${isAdmin ? '' : 'hidden'}" onclick="deleteItem('${item.id}')" type="button">${deleteLabel}</button>
                </td>
            </tr>
            `;
        }).join('');
    };

    function renderBreadcrumbs(container) {
        const showBack = currentPath.length > 0;
        let html = '';
        if (showBack) {
            html += `<button class="btn btn-outline btn-sm btn-back" type="button" onclick="navigateBack()">${t('back')}</button>`;
        }

        currentPath.forEach((folder, index) => {
            if (index > 0) html += ` <span class="breadcrumb-separator">/</span> `;
            const isLast = index === currentPath.length - 1;
            if (isLast) {
                html += `<span class="breadcrumb-current">${escapeHtml(folder)}</span>`;
            } else {
                html += `<span class="breadcrumb-item" onclick="navigateUpTo(${index})">${escapeHtml(folder)}</span>`;
            }
        });
        container.innerHTML = html;
    }

    // --- Navigation Actions ---
    window.navigateBack = function () {
        if (currentPath.length === 0) return;
        setCurrentPath(currentPath.slice(0, -1));
        window.renderFiles();
    };
    window.navigateTo = function (folderName) {
        setCurrentPath([...currentPath, folderName]);
        window.renderFiles();
    };

    window.navigateToRoot = function () {
        setCurrentPath([]);
        window.renderFiles();
    };

    window.navigateUpTo = function (index) {
        setCurrentPath(currentPath.slice(0, index + 1));
        window.renderFiles();
    };

    // --- Download ---
    function getBucketFromDownloadUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/\/b\/([^/]+)\/o\//);
        if (!match || !match[1]) return null;
        try {
            return decodeURIComponent(match[1]);
        } catch (e) {
            return null;
        }
    }

    function getStoragePathFromDownloadUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/\/o\/([^?]+)/);
        if (!match || !match[1]) return null;
        try {
            return decodeURIComponent(match[1]);
        } catch (e) {
            return null;
        }
    }

    function ensureZipOverlay() {
        let overlay = document.getElementById('zipDownloadOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'zipDownloadOverlay';
        overlay.className = 'zip-overlay hidden';
        overlay.innerHTML = `
            <div class="zip-overlay-card">
                <div class="zip-overlay-title">Descargando carpeta…</div>
                <div class="zip-overlay-sub" id="zipOverlaySub">Preparando…</div>
                <div class="zip-overlay-bar"><div class="zip-overlay-fill" id="zipOverlayFill"></div></div>
                <div class="zip-overlay-percent" id="zipOverlayPercent">0%</div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function setZipOverlay(visible, percent, text) {
        const overlay = ensureZipOverlay();
        const sub = overlay.querySelector('#zipOverlaySub');
        const fill = overlay.querySelector('#zipOverlayFill');
        const pct = overlay.querySelector('#zipOverlayPercent');
        if (visible) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
        if (typeof percent === 'number') {
            const clamped = Math.max(0, Math.min(100, percent));
            if (fill) fill.style.width = clamped + '%';
            if (pct) pct.textContent = Math.round(clamped) + '%';
        }
        if (sub && typeof text === 'string') sub.textContent = text;
    }

    window.downloadFolder = async function (folderId, folderName) {
        if (!db) return;
        const folderSnap = await db.collection('files').doc(folderId).get();
        if (!folderSnap.exists) return;
        const folder = { id: folderSnap.id, ...folderSnap.data() };
        if (!folder || folder.type !== 'folder') return;

        const folderFullPath = [...folder.path, folder.name];

        const bucketName =
            folder.bucket ||
            ((firebase.app && firebase.app().options && firebase.app().options.storageBucket) ? firebase.app().options.storageBucket : '');
        const rustBase = typeof RUST_API_BASE_URL === 'string' ? RUST_API_BASE_URL.trim() : '';
        if (rustBase && bucketName) {
            const prefix = buildUploadStoragePrefix(folderFullPath);
            const zipUrl = `${rustBase.replace(/\/+$/, '')}/v1/zip?bucket=${encodeURIComponent(bucketName)}&prefix=${encodeURIComponent(prefix)}&name=${encodeURIComponent(folder.name)}`;

            setZipOverlay(true, 5, 'Iniciando descarga…');
            const a = document.createElement('a');
            a.href = zipUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.download = (folder && folder.name ? String(folder.name) : 'folder') + '.zip';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try { a.remove(); } catch (e) { }
            }, 1000);
            setTimeout(() => setZipOverlay(false, 100, ''), 2500);
            return;
        }

        const zip = new JSZip();

        const items = [];
        const pendingFolders = [folderFullPath];
        const visited = new Set();

        while (pendingFolders.length) {
            const p = pendingFolders.shift();
            const key = makePathKey(p);
            if (visited.has(key)) continue;
            visited.add(key);

            const snap = await db.collection('files').where('path', '==', p).get();
            snap.forEach((doc) => {
                const data = doc.data() || {};
                if (data.type === 'file') items.push({ id: doc.id, ...data });
                else if (data.type === 'folder' && data.name) pendingFolders.push([...p, data.name]);
            });
        }

        console.log('Items to download:', items);

        if (items.length === 0) {
            alert('La carpeta está vacía');
            return;
        }

        const totalFiles = items.length;
        let completedFiles = 0;
        let failedFiles = 0;
        setZipOverlay(true, 0, `0/${totalFiles}`);

        let cursor = 0;
        const concurrency = Math.min(4, totalFiles);

        const worker = async () => {
            while (cursor < items.length) {
                const idx = cursor;
                cursor += 1;
                const file = items[idx];

                let storagePath = null;
                let bucketName = null;
                let proxyUrl = null;
                try {
                    storagePath = file.storagePath || getStoragePathFromDownloadUrl(file.url);
                    if (!storagePath) throw new Error('Missing storagePath for download');

                    bucketName = file.bucket || getBucketFromDownloadUrl(file.url) || ((firebase.app && firebase.app().options && firebase.app().options.storageBucket) ? firebase.app().options.storageBucket : '');
                    if (!bucketName) throw new Error('Missing bucket for download');

                    const rustBase = typeof RUST_API_BASE_URL === 'string' ? RUST_API_BASE_URL.trim() : '';
                    if (rustBase) {
                        proxyUrl = `${rustBase.replace(/\/+$/, '')}/v1/download?bucket=${encodeURIComponent(bucketName)}&filePath=${encodeURIComponent(storagePath)}`;
                    } else {
                        proxyUrl = `https://downloadproxy-ktjoryazzq-uc.a.run.app?bucket=${encodeURIComponent(bucketName)}&filePath=${encodeURIComponent(storagePath)}`;
                    }

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 120000);
                    const response = await fetch(proxyUrl, { mode: 'cors', signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (!response.ok) throw new Error(`Proxy request failed (${response.status})`);

                    const blob = await response.blob();
                    const relativeParts = (file.path || []).slice(folderFullPath.length);
                    const zipPath = [...relativeParts, file.name].join('/');
                    zip.file(zipPath, blob, { binary: true });
                } catch (error) {
                    failedFiles += 1;
                    console.error('Could not download file for zip:', {
                        name: file.name,
                        url: file.url,
                        storagePath,
                        bucketName,
                        proxyUrl
                    }, error);
                } finally {
                    completedFiles += 1;
                    const downloadPct = (completedFiles / totalFiles) * 80;
                    setZipOverlay(true, downloadPct, `${completedFiles}/${totalFiles}${failedFiles ? ` (fallidos: ${failedFiles})` : ''}`);
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        };

        try {
            await Promise.all(Array.from({ length: concurrency }, () => worker()));

            const content = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (meta) => {
                if (meta && typeof meta.percent === 'number') {
                    const pct = 80 + (meta.percent * 0.2);
                    setZipOverlay(true, pct, `Creando ZIP… ${Math.round(meta.percent)}%`);
                }
            });

            saveAs(content, folder.name + ".zip");
            setZipOverlay(false, 100, '');
            console.log('ZIP generated and saved');
        } catch (err) {
            setZipOverlay(false, 0, '');
            console.error('Error generating ZIP:', err);
            alert('Error generando el ZIP: ' + err.message);
        }
    };

    // --- Admin Actions ---
    window.deleteItem = function (id) {
        if (!isAdmin) return;
        if (!db) return;

        db.collection('files').doc(id).get().then(async (snap) => {
            if (!snap.exists) return;
            const item = { id: snap.id, ...snap.data() };

            if (item.type !== 'folder') {
                await db.collection('files').doc(id).delete();
                return;
            }

            if (!confirm(`Delete folder "${item.name}"?`)) return;
            const folderFullPath = [...(item.path || []), item.name];
            const folderKey = makePathKey(folderFullPath);
            const endKey = folderKey + '\uf8ff';
            let lastDoc = null;

            while (true) {
                let q = db.collection('files')
                    .where('pathKey', '>=', folderKey)
                    .where('pathKey', '<', endKey)
                    .orderBy('pathKey')
                    .limit(450);
                if (lastDoc) q = q.startAfter(lastDoc);
                const childrenSnap = await q.get();
                if (childrenSnap.empty) break;

                const batch = db.batch();
                childrenSnap.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();

                lastDoc = childrenSnap.docs[childrenSnap.docs.length - 1];
            }

            await db.collection('files').doc(id).delete();
        }).catch(handleListenerError);
    };

    window.deleteAllFiles = function () {
        if (!isAdmin) return;
        if (!db) return;
        if (!confirm(t('deleteAllConfirm'))) return;

        const idField = firebase.firestore.FieldPath.documentId();
        let lastDoc = null;

        const run = async () => {
            while (true) {
                let q = db.collection('files').orderBy(idField).limit(500);
                if (lastDoc) q = q.startAfter(lastDoc);
                const snap = await q.get();
                if (snap.empty) break;

                const batch = db.batch();
                snap.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();
                lastDoc = snap.docs[snap.docs.length - 1];
            }
        };

        run().catch(handleListenerError);
    };

    function formatFileSize(bytes) {
        if (!bytes || bytes === '-') return '-';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ========================================
    // Blog Management (Firebase)
    // ========================================

    window.publishBlog = function () {
        if (!isAdmin) return;
        const titleEsEl = document.getElementById('blogTitleEs');
        const contentEsEl = document.getElementById('blogContentEs');
        const titleEnEl = document.getElementById('blogTitleEn');
        const contentEnEl = document.getElementById('blogContentEn');

        const titleEs = titleEsEl ? titleEsEl.value.trim() : '';
        const contentEs = contentEsEl ? contentEsEl.value.trim() : '';
        const titleEn = titleEnEl ? titleEnEl.value.trim() : '';
        const contentEn = contentEnEl ? contentEnEl.value.trim() : '';

        if (!titleEs || !contentEs || !titleEn || !contentEn) {
            alert(t('completeFields'));
            return;
        }

        const createdAt = Date.now();
        const titleByLang = { es: titleEs, en: titleEn };
        const contentByLang = { es: contentEs, en: contentEn };

        db.collection('posts').add({
            id: createdAt,
            createdAt,
            lang: 'multi',
            titleByLang,
            contentByLang,
            comments: []
        });

        if (titleEsEl) titleEsEl.value = '';
        if (contentEsEl) contentEsEl.value = '';
        if (titleEnEl) titleEnEl.value = '';
        if (contentEnEl) contentEnEl.value = '';
    };

    window.renderBlogs = function () {
        const blogsContainer = document.getElementById('blogsContainer');
        if (!blogsContainer) return;

        try {
            blogPosts.forEach((post) => {
                const postDocId = typeof post.firebaseId === 'string' ? post.firebaseId.trim() : '';
                const postKey = postDocId || String(post.id || post.createdAt || '');
                const authorEl = document.getElementById(`author-${postKey}`);
                const commentEl = document.getElementById(`comment-${postKey}`);
                if (!authorEl && !commentEl) return;
                const existing = blogDraftsByPostId.get(postKey) || {};
                blogDraftsByPostId.set(postKey, {
                    author: authorEl ? authorEl.value : existing.author || '',
                    comment: commentEl ? commentEl.value : existing.comment || ''
                });
            });
        } catch (e) { }

        if (blogPosts.length === 0) {
            blogsContainer.innerHTML = `<p class="empty-message">${t('noPosts')}</p>`;
            return;
        }

        const dateLocale = currentLang === 'es' ? 'es-ES' : 'en-US';
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const formatPostDate = (post) => {
            if (typeof post.createdAt === 'number' && Number.isFinite(post.createdAt)) {
                return new Date(post.createdAt).toLocaleDateString(dateLocale, dateOptions);
            }
            if (typeof post.date === 'string' && post.date.trim()) return post.date;
            return '';
        };

        const getPostLocalizedText = (post, key) => {
            if (!post) return '';
            const byLang = post[key];
            if (byLang && typeof byLang === 'object') {
                const candidate = byLang[currentLang];
                if (typeof candidate === 'string' && candidate.trim()) return candidate;
                if (Object.prototype.hasOwnProperty.call(byLang, currentLang)) return t('translationMissing');
                if (typeof byLang.es === 'string' && byLang.es.trim()) return byLang.es;
                if (typeof byLang.en === 'string' && byLang.en.trim()) return byLang.en;
                return t('translationMissing');
            }
            if (key === 'titleByLang' && typeof post.title === 'string') return post.title;
            if (key === 'contentByLang' && typeof post.content === 'string') return post.content;
            return '';
        };

        const getCommentLocalizedText = (comment) => {
            if (!comment) return '';
            const byLang = comment.textByLang;
            if (byLang && typeof byLang === 'object') {
                const candidate = byLang[currentLang];
                if (typeof candidate === 'string' && candidate.trim()) return candidate;
            }
            if (typeof comment.text === 'string') return comment.text;
            return '';
        };

        blogsContainer.innerHTML = blogPosts.map((post) => {
            const postDocId = typeof post.firebaseId === 'string' ? post.firebaseId.trim() : '';
            const postKey = postDocId || String(post.id || post.createdAt || '');
            const canComment = !!postDocId;
            return `
            <div class="post-item" id="post-${escapeHtml(postKey)}">
                <div class="post-header">
                    <h3 class="post-title">${escapeHtml(getPostLocalizedText(post, 'titleByLang'))}</h3>
                    <span class="post-date">${escapeHtml(formatPostDate(post))}</span>
                </div>
                <p class="post-content">${escapeHtml(getPostLocalizedText(post, 'contentByLang'))}</p>
                ${isAdmin && postDocId ? `<div class="post-actions"><button class="btn btn-danger" onclick="deleteBlog('${postDocId}')">${t('delete')}</button></div>` : ''}
                
                <div class="comments-section">
                    <h4 class="comments-title">💬 ${t('comments')} (${post.comments ? post.comments.length : 0})</h4>
                    <div class="comments-list">
                        ${(post.comments || []).map((c, idx) => `
                            <div class="comment ${c.isAdmin ? 'comment-admin' : ''}">
                                <div class="comment-header">
                                    <span class="comment-author">${escapeHtml(c.author)}${c.isAdmin ? ` <span class="admin-badge">${t('admin')}</span>` : ''}</span>
                                    <span class="comment-date">${escapeHtml((typeof c.createdAt === 'number' && Number.isFinite(c.createdAt)) ? new Date(c.createdAt).toLocaleDateString(dateLocale) : (c.date || ''))}</span>
                                    ${isAdmin && postDocId ? `<button class="btn-delete-comment" onclick="deleteComment('${postDocId}', ${idx})">×</button>` : ''}
                                </div>
                                <p class="comment-text">${escapeHtml(getCommentLocalizedText(c))}</p>
                            </div>
                        `).join('')}
                    </div>
                    <div class="comment-form">
                        <input type="text" class="form-control comment-author-input" id="author-${escapeHtml(postKey)}" placeholder="${t('yourName')}" maxlength="30">
                        <input type="text" class="form-control comment-input" id="comment-${escapeHtml(postKey)}" placeholder="${t('writeComment')}" ${canComment ? `onkeypress="handleComment(event, '${postDocId}')"` : 'disabled'}>
                        <button class="btn btn-sm btn-primary" ${canComment ? `onclick="addComment('${postDocId}')"` : 'disabled'}>${t('comment')}</button>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        try {
            blogPosts.forEach((post) => {
                const postDocId = typeof post.firebaseId === 'string' ? post.firebaseId.trim() : '';
                const postKey = postDocId || String(post.id || post.createdAt || '');
                const draft = blogDraftsByPostId.get(postKey) || { author: '', comment: '' };
                const authorEl = document.getElementById(`author-${postKey}`);
                const commentEl = document.getElementById(`comment-${postKey}`);
                if (authorEl) {
                    authorEl.value = draft.author || '';
                    authorEl.oninput = () => {
                        const cur = blogDraftsByPostId.get(postKey) || {};
                        blogDraftsByPostId.set(postKey, { ...cur, author: authorEl.value });
                    };
                }
                if (commentEl) {
                    commentEl.value = draft.comment || '';
                    commentEl.oninput = () => {
                        const cur = blogDraftsByPostId.get(postKey) || {};
                        blogDraftsByPostId.set(postKey, { ...cur, comment: commentEl.value });
                    };
                }
            });
        } catch (e) { }
    };

    window.handleComment = function (e, a, b) {
        if (e.key === 'Enter') addComment(a, b);
    };

    window.addComment = function (a, b) {
        const tryResolveDocId = (x, y) => {
            const s1 = typeof x === 'string' ? x.trim() : '';
            if (s1) return { docId: s1, legacyKey: null };

            const s2 = typeof y === 'string' ? y.trim() : '';
            if (s2) return { docId: s2, legacyKey: null };

            const n1 = typeof x === 'number' && Number.isFinite(x) ? x : null;
            const n2 = typeof y === 'number' && Number.isFinite(y) ? y : null;
            const legacy = n1 !== null ? n1 : n2;
            if (legacy === null) return { docId: '', legacyKey: null };

            const match = (Array.isArray(blogPosts) ? blogPosts : []).find((p) => {
                if (!p) return false;
                return p.id === legacy || p.createdAt === legacy;
            });
            const docId =
                match && typeof match.firebaseId === 'string' ? match.firebaseId.trim() : '';
            return { docId, legacyKey: legacy };
        };

        const resolved = tryResolveDocId(a, b);
        const postId = resolved.docId;
        const postKeyCandidates = [];
        if (postId) postKeyCandidates.push(postId);
        if (resolved.legacyKey !== null) postKeyCandidates.push(String(resolved.legacyKey));

        let authorInput = null;
        let input = null;
        let usedKey = '';
        for (const k of postKeyCandidates) {
            const aEl = document.getElementById(`author-${k}`);
            const cEl = document.getElementById(`comment-${k}`);
            if (aEl || cEl) {
                authorInput = aEl;
                input = cEl;
                usedKey = k;
                break;
            }
        }

        if (!postId) {
            alert('No se pudo identificar la publicación. Recargá la página.');
            return;
        }

        const text = input ? input.value.trim() : '';
        let author = authorInput ? authorInput.value.trim() : '';

        if (!author) author = t('anonymous');
        if (!text) { alert(t('writeCommentAlert')); return; }

        const legacyId = (() => {
            if (resolved.legacyKey !== null) return resolved.legacyKey;
            const p = (Array.isArray(blogPosts) ? blogPosts : []).find((x) => {
                if (!x) return false;
                return typeof x.firebaseId === 'string' && x.firebaseId.trim() === postId;
            });
            const n = p && (p.id != null ? p.id : p.createdAt);
            return (typeof n === 'number' && Number.isFinite(n)) ? n : null;
        })();

        const callViaRust = async () => {
            if (typeof fetch !== 'function') throw new Error('fetch-missing');
            const base = typeof RUST_API_BASE_URL === 'string' ? RUST_API_BASE_URL.trim() : '';
            if (!base) throw new Error('rust-base-missing');
            const url = `${base.replace(/\/+$/, '')}/v1/comments`;
            let token = '';
            try {
                const auth = firebase && firebase.auth ? firebase.auth() : null;
                const user = auth && auth.currentUser ? auth.currentUser : null;
                if (user && user.getIdToken) token = String(await user.getIdToken());
            } catch (e) { }
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const resp = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    postId,
                    id: legacyId,
                    author,
                    text,
                    lang: currentLang,
                    isAdmin
                })
            });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json || !json.ok) {
                const msg = json && (json.error || json.message) ? String(json.error || json.message) : `HTTP ${resp.status}`;
                const err = new Error(msg);
                err.code = 'rust-failed';
                throw err;
            }
            try { console.info('[comments] guardado via rust backend'); } catch (e) { }
            return json;
        };

        Promise.resolve()
            .then(callViaRust)
            .then(() => {
            if (input) input.value = '';
            const keyForDraft = usedKey || postId;
            const cur = blogDraftsByPostId.get(keyForDraft) || {};
            blogDraftsByPostId.set(keyForDraft, { ...cur, comment: '' });
        }).catch((error) => {
            console.error('Error adding comment:', error);
            if (error && String(error.code || '').includes('rust-failed')) {
                alert('No se pudo guardar el comentario (Rust backend).');
                return;
            }
            alert('No se pudo guardar el comentario.');
        });
    };

    window.deleteComment = function (firebaseId, idx) {
        if (!isAdmin) return;
        const post = blogPosts.find(p => p.firebaseId === firebaseId);
        if (!post) return;

        // Need to read current comments, splice, update (primitive way but simple for array)
        // Better way: unique ID for comments, but arrayUnion/Remove needs exact object match
        // We'll just update the whole array
        const newComments = [...post.comments];
        newComments.splice(idx, 1);

        db.collection('posts').doc(firebaseId).update({ comments: newComments });
    };

    window.deleteBlog = function (firebaseId) {
        if (!isAdmin) return;
        db.collection('posts').doc(firebaseId).delete();
    };

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================
    // Init
    // ========================================
    checkLocationOnLoad();
});
