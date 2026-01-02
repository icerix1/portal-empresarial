// ========================================
// SISTEMA DE IDIOMAS
// ========================================
const translations = {
    es: {
        portal: 'Portal Empresarial',
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
        title: 'Título',
        content: 'Contenido',
        enterTitle: 'Ingrese el título',
        writeContent: 'Escriba el contenido...',
        publish: 'Publicar',
        recentPosts: 'Publicaciones Recientes',
        noPosts: 'No hay publicaciones disponibles',
        copyright: '© 2026 Portal Empresarial. Todos los derechos reservados.',
        delete: 'Eliminar',
        comments: 'Comentarios',
        yourName: 'Tu nombre',
        writeComment: 'Escribe un comentario...',
        comment: 'Comentar',
        anonymous: 'Anónimo',
        admin: 'Admin',
        completeFields: 'Complete todos los campos',
        writeCommentAlert: 'Escribe un comentario'
    },
    en: {
        portal: 'Business Portal',
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
        title: 'Title',
        content: 'Content',
        enterTitle: 'Enter the title',
        writeContent: 'Write your content...',
        publish: 'Publish',
        recentPosts: 'Recent Posts',
        noPosts: 'No posts available',
        copyright: '© 2026 Business Portal. All rights reserved.',
        delete: 'Delete',
        comments: 'Comments',
        yourName: 'Your name',
        writeComment: 'Write a comment...',
        comment: 'Comment',
        anonymous: 'Anonymous',
        admin: 'Admin',
        completeFields: 'Please complete all fields',
        writeCommentAlert: 'Please write a comment'
    }
};

let currentLang = localStorage.getItem('lang') || 'es';

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

    function setupAdminLocation() {
        const password = prompt('Código de configuración:');
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

    // ========================================
    // File Management
    // ========================================
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    let uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles')) || [];

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (isAdmin) handleFiles(e.dataTransfer.files);
        });
        dropZone.addEventListener('click', () => { if (isAdmin && fileInput) fileInput.click(); });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => { if (isAdmin) handleFiles(e.target.files); });
    }

    function handleFiles(files) {
        for (let file of files) {
            uploadedFiles.push({
                id: Date.now() + Math.random(),
                name: file.name,
                size: formatFileSize(file.size),
                date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US')
            });
        }
        saveFiles();
        window.renderFiles();
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    window.renderFiles = function () {
        const filesContainer = document.getElementById('filesContainer');
        if (!filesContainer) return;

        if (uploadedFiles.length === 0) {
            filesContainer.innerHTML = `<tr class="empty-row"><td colspan="4">${t('noFiles')}</td></tr>`;
            return;
        }

        filesContainer.innerHTML = uploadedFiles.map(file => `
            <tr>
                <td class="file-name">${escapeHtml(file.name)}</td>
                <td>${file.size}</td>
                <td>${file.date}</td>
                <td class="${isAdmin ? '' : 'hidden'}">
                    <button class="btn btn-danger" onclick="deleteFile(${file.id})">${t('delete')}</button>
                </td>
            </tr>
        `).join('');
    };

    window.deleteFile = function (id) {
        if (!isAdmin) return;
        uploadedFiles = uploadedFiles.filter(f => f.id !== id);
        saveFiles();
        window.renderFiles();
    };

    function saveFiles() {
        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
    }

    // ========================================
    // Blog Management with Comments
    // ========================================
    let blogPosts = JSON.parse(localStorage.getItem('blogPosts')) || [];

    window.publishBlog = function () {
        if (!isAdmin) return;
        const title = document.getElementById('blogTitle').value.trim();
        const content = document.getElementById('blogContent').value.trim();

        if (!title || !content) {
            alert(t('completeFields'));
            return;
        }

        blogPosts.unshift({
            id: Date.now(),
            title,
            content,
            date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
            comments: []
        });

        saveBlogs();
        window.renderBlogs();
        document.getElementById('blogTitle').value = '';
        document.getElementById('blogContent').value = '';
    };

    window.renderBlogs = function () {
        const blogsContainer = document.getElementById('blogsContainer');
        if (!blogsContainer) return;

        if (blogPosts.length === 0) {
            blogsContainer.innerHTML = `<p class="empty-message">${t('noPosts')}</p>`;
            return;
        }

        blogsContainer.innerHTML = blogPosts.map(post => `
            <div class="post-item" id="post-${post.id}">
                <div class="post-header">
                    <h3 class="post-title">${escapeHtml(post.title)}</h3>
                    <span class="post-date">${post.date}</span>
                </div>
                <p class="post-content">${escapeHtml(post.content)}</p>
                ${isAdmin ? `<div class="post-actions"><button class="btn btn-danger" onclick="deleteBlog(${post.id})">${t('delete')}</button></div>` : ''}
                
                <div class="comments-section">
                    <h4 class="comments-title">💬 ${t('comments')} (${post.comments ? post.comments.length : 0})</h4>
                    <div class="comments-list">
                        ${(post.comments || []).map((c, idx) => `
                            <div class="comment ${c.isAdmin ? 'comment-admin' : ''}">
                                <div class="comment-header">
                                    <span class="comment-author">${escapeHtml(c.author)}${c.isAdmin ? ` <span class="admin-badge">${t('admin')}</span>` : ''}</span>
                                    <span class="comment-date">${c.date}</span>
                                    ${isAdmin ? `<button class="btn-delete-comment" onclick="deleteComment(${post.id}, ${idx})">×</button>` : ''}
                                </div>
                                <p class="comment-text">${escapeHtml(c.text)}</p>
                            </div>
                        `).join('')}
                    </div>
                    <div class="comment-form">
                        <input type="text" class="form-control comment-author-input" id="author-${post.id}" placeholder="${t('yourName')}" maxlength="30">
                        <textarea class="form-control comment-text-input" id="comment-${post.id}" placeholder="${t('writeComment')}" rows="2"></textarea>
                        <button class="btn btn-primary btn-comment" onclick="addComment(${post.id})">${t('comment')}</button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    window.addComment = function (postId) {
        const authorInput = document.getElementById(`author-${postId}`);
        const textInput = document.getElementById(`comment-${postId}`);
        const author = authorInput.value.trim() || t('anonymous');
        const text = textInput.value.trim();

        if (!text) { alert(t('writeCommentAlert')); return; }

        const post = blogPosts.find(p => p.id === postId);
        if (!post) return;
        if (!post.comments) post.comments = [];

        post.comments.push({
            author,
            text,
            date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US'),
            isAdmin
        });

        saveBlogs();
        window.renderBlogs();
    };

    window.deleteComment = function (postId, idx) {
        if (!isAdmin) return;
        const post = blogPosts.find(p => p.id === postId);
        if (post && post.comments) {
            post.comments.splice(idx, 1);
            saveBlogs();
            window.renderBlogs();
        }
    };

    window.deleteBlog = function (id) {
        if (!isAdmin) return;
        blogPosts = blogPosts.filter(p => p.id !== id);
        saveBlogs();
        window.renderBlogs();
    };

    function saveBlogs() {
        localStorage.setItem('blogPosts', JSON.stringify(blogPosts));
    }

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
