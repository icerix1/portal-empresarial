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
        writeCommentAlert: 'Escribe un comentario',
        selectFolder: 'Subir Carpeta',
        deleteAll: 'Eliminar Todo',
        deleteAllConfirm: '¿Estás seguro de que quieres eliminar TODOS los archivos? Esta acción no se puede deshacer.',
        download: 'Descargar'
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
        writeCommentAlert: 'Please write a comment',
        selectFolder: 'Upload Folder',
        deleteAll: 'Delete All',
        deleteAllConfirm: 'Are you sure you want to delete ALL files? This action cannot be undone.',
        download: 'Download'
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
    // File Management (Virtual File System)
    // ========================================
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');

    // State
    let currentPath = []; // Array of folder names
    let uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles')) || [];

    // Ensure backwards compatibility (add path/type if missing)
    uploadedFiles = uploadedFiles.map(f => ({
        ...f,
        type: f.type || 'file',
        path: f.path || [], // root
        parentId: f.parentId || 'root'
    }));

    // --- Drop Zone Listeners ---
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (isAdmin) {
                const items = e.dataTransfer.items;
                if (items) processItems(items);
                else handleFiles(e.dataTransfer.files);
            }
        });
        // Click handled by buttons
    }

    if (fileInput) fileInput.addEventListener('change', (e) => { if (isAdmin) handleFiles(e.target.files); });
    if (folderInput) folderInput.addEventListener('change', (e) => { if (isAdmin) handleFiles(e.target.files); });

    // --- File Processing ---
    function processItems(items) {
        let entryPromises = [];
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            if (item.kind === 'file') {
                let entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) entryPromises.push(traverseFileTree(entry, currentPath));
            }
        }
        Promise.all(entryPromises).then(() => {
            saveFiles();
            window.renderFiles();
        });
    }

    function traverseFileTree(item, path) {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    addFileToVFS(file, path);
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

    function handleFiles(files) {
        for (let file of files) {
            let path = [...currentPath];
            if (file.webkitRelativePath) {
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
            addFileToVFS(file, path);
        }
        saveFiles();
        window.renderFiles();
    }

    function ensureFolderExists(pathArray) {
        const parentPath = pathArray.slice(0, -1);
        const folderName = pathArray[pathArray.length - 1];

        const exists = uploadedFiles.some(f =>
            f.type === 'folder' &&
            f.name === folderName &&
            JSON.stringify(f.path) === JSON.stringify(parentPath)
        );

        if (!exists) {
            uploadedFiles.push({
                id: 'folder-' + Date.now() + Math.random(),
                type: 'folder',
                name: folderName,
                size: '-',
                date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US'),
                path: parentPath
            });
        }
    }

    function addFileToVFS(file, pathArray) {
        uploadedFiles.push({
            id: Date.now() + Math.random(),
            type: 'file',
            name: file.name,
            size: formatFileSize(file.size),
            rawSize: file.size,
            path: pathArray,
            date: new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US'),
            content: null
        });

        // Try to save content (limit to small files to prevent quota errors)
        if (file.size < 2.5 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const fileEntry = uploadedFiles.find(f => f.id === uploadedFiles[uploadedFiles.length - 1].id);
                if (fileEntry) {
                    fileEntry.content = e.target.result;
                    try {
                        saveFiles();
                    } catch (e) {
                        console.warn('Storage quota exceeded');
                        fileEntry.content = null;
                        saveFiles();
                    }
                }
            };
            reader.readAsDataURL(file);
        } else {
            saveFiles();
        }
    }

    // --- Rendering ---
    window.renderFiles = function () {
        const filesContainer = document.getElementById('filesContainer');
        const breadcrumbs = document.getElementById('breadcrumbs');
        if (!filesContainer) return;

        // Breadcrumbs
        renderBreadcrumbs(breadcrumbs);

        // Filter items for current path
        const items = uploadedFiles.filter(f => JSON.stringify(f.path) === JSON.stringify(currentPath));

        // Sort: Folders first, then files
        items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        if (items.length === 0) {
            filesContainer.innerHTML = `<tr class="empty-row"><td colspan="4">${t('noFiles')}</td></tr>`;
            return;
        }

        filesContainer.innerHTML = items.map(item => {
            const icon = item.type === 'folder' ? '📁' : '📄';
            const iconClass = item.type === 'folder' ? 'icon-folder' : 'icon-file';
            const onclick = item.type === 'folder' ? `onclick="navigateTo('${item.name}')"` : '';
            const actionBtn = item.type === 'folder'
                ? `<button class="btn-icon" onclick="downloadFolder('${item.id}')" title="${t('download')}">⬇️</button>`
                : `<button class="btn-icon" onclick="downloadFile('${item.id}')" title="${t('download')}">⬇️</button>`;

            return `
            <tr>
                <td>
                    <span class="file-icon ${iconClass}">${icon}</span>
                    <span class="file-name ${item.type === 'folder' ? 'is-folder' : ''}" ${onclick}>${escapeHtml(item.name)}</span>
                </td>
                <td>${item.size}</td>
                <td>${item.date}</td>
                <td class="actions-cell">
                    ${actionBtn}
                    <button class="btn-icon ${isAdmin ? '' : 'hidden'}" onclick="deleteItem('${item.id}')" title="${t('delete')}">🗑️</button>
                </td>
            </tr>
            `;
        }).join('');
    };

    function renderBreadcrumbs(container) {
        let html = `<span class="breadcrumb-item ${currentPath.length === 0 ? 'breadcrumb-current' : ''}" onclick="navigateToRoot()">🏠 Home</span>`;

        currentPath.forEach((folder, index) => {
            html += ` <span class="breadcrumb-separator">/</span> `;
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
    window.navigateTo = function (folderName) {
        currentPath.push(folderName);
        window.renderFiles();
    };

    window.navigateToRoot = function () {
        currentPath = [];
        window.renderFiles();
    };

    window.navigateUpTo = function (index) {
        currentPath = currentPath.slice(0, index + 1);
        window.renderFiles();
    };

    // --- Download ---
    window.downloadFile = function (id) {
        const file = uploadedFiles.find(f => f.id == id);
        if (!file || !file.content) {
            alert('File content missing (storage limit?)');
            return;
        }
        saveAs(file.content, file.name);
    };

    window.downloadFolder = function (id) {
        const folder = uploadedFiles.find(f => f.id == id);
        if (!folder) return;

        const zip = new JSZip();
        // folderFullPath = [...folder.path, folder.name]
        const folderFullPath = [...folder.path, folder.name];

        // Find items that start with this path (recursively)
        const items = uploadedFiles.filter(f => {
            if (f.type === 'folder') return false;
            if (f.path.length < folderFullPath.length) return false;
            for (let i = 0; i < folderFullPath.length; i++) {
                if (f.path[i] !== folderFullPath[i]) return false;
            }
            return true;
        });

        if (items.length === 0) {
            alert('Folder is empty');
            return;
        }

        items.forEach(item => {
            // Rel path
            const relativePath = item.path.slice(folderFullPath.length);
            const fileName = [...relativePath, item.name].join('/');

            if (item.content) {
                const base64 = item.content.split(',')[1];
                zip.file(fileName, base64, { base64: true });
            }
        });

        zip.generateAsync({ type: "blob" }).then(function (content) {
            saveAs(content, folder.name + ".zip");
        });
    };

    // --- Admin Actions ---
    window.deleteItem = function (id) {
        if (!isAdmin) return;
        const item = uploadedFiles.find(f => f.id == id);
        if (!item) return;

        if (item.type === 'folder') {
            if (!confirm(`Delete folder "${item.name}"?`)) return;
            const folderFullPath = [...item.path, item.name];

            uploadedFiles = uploadedFiles.filter(f => {
                if (f.id == id) return false; // Delete folder entry

                // Check descendant
                if (f.path.length >= folderFullPath.length) {
                    let match = true;
                    for (let i = 0; i < folderFullPath.length; i++) {
                        if (f.path[i] !== folderFullPath[i]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) return false;
                }
                return true;
            });
        } else {
            uploadedFiles = uploadedFiles.filter(f => f.id != id);
        }
        saveFiles();
        window.renderFiles();
    };

    window.deleteAllFiles = function () {
        if (!isAdmin) return;
        if (confirm(t('deleteAllConfirm'))) {
            uploadedFiles = [];
            currentPath = [];
            saveFiles();
            window.renderFiles();
        }
    };

    function saveFiles() {
        try {
            localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
        } catch (e) {
            console.error('Storage full');
        }
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === '-') return '-';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
