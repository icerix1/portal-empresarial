// ========================================
// CONFIGURACIÓN - CAMBIA TU CONTRASEÑA AQUÍ
// ========================================
const ADMIN_PASSWORD = 'admin123'; // ⚠️ Cambia esto por tu contraseña secreta

// ========================================
// Sistema de Autenticación Admin
// ========================================
let isAdmin = localStorage.getItem('isAdmin') === 'true';

function checkAdminStatus() {
    const adminElements = document.querySelectorAll('.admin-only');
    const adminHeaders = document.querySelectorAll('.admin-only-header');
    const adminBanner = document.getElementById('adminBanner');
    const adminToggle = document.getElementById('adminToggle');

    if (isAdmin) {
        adminElements.forEach(el => el.style.display = 'block');
        adminHeaders.forEach(el => el.style.display = 'table-cell');
        adminBanner.style.display = 'flex';
        adminToggle.textContent = '🔓';
        adminToggle.title = 'Cerrar sesión admin';
    } else {
        adminElements.forEach(el => el.style.display = 'none');
        adminHeaders.forEach(el => el.style.display = 'none');
        adminBanner.style.display = 'none';
        adminToggle.textContent = '⚙️';
        adminToggle.title = 'Modo Admin';
    }

    renderFiles();
    renderBlogs();
}

function openLoginModal() {
    if (isAdmin) {
        logout();
    } else {
        document.getElementById('loginModal').classList.add('active');
        document.getElementById('adminPassword').focus();
    }
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('adminPassword').value = '';
}

function attemptLogin() {
    const password = document.getElementById('adminPassword').value;

    if (password === ADMIN_PASSWORD) {
        isAdmin = true;
        localStorage.setItem('isAdmin', 'true');
        closeLoginModal();
        checkAdminStatus();
    } else {
        alert('Contraseña incorrecta');
        document.getElementById('adminPassword').value = '';
    }
}

function logout() {
    isAdmin = false;
    localStorage.removeItem('isAdmin');
    checkAdminStatus();
}

// Enter key para login
document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptLogin();
});

// Click en botón admin
document.getElementById('adminToggle').addEventListener('click', (e) => {
    e.preventDefault();
    openLoginModal();
});

// Cerrar modal al hacer clic fuera
document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') closeLoginModal();
});

// ========================================
// Navegación por Pestañas
// ========================================
document.querySelectorAll('.nav-link:not(.admin-link)').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        document.querySelectorAll('.nav-link:not(.admin-link)').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const tabName = link.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    });
});

// ========================================
// Gestión de Archivos
// ========================================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filesContainer = document.getElementById('filesContainer');

let uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles')) || [];

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (isAdmin) handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => {
    if (isAdmin) fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (isAdmin) handleFiles(e.target.files);
});

function handleFiles(files) {
    for (let file of files) {
        const fileData = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: formatFileSize(file.size),
            date: new Date().toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        };

        uploadedFiles.push(fileData);
    }

    saveFiles();
    renderFiles();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderFiles() {
    if (uploadedFiles.length === 0) {
        filesContainer.innerHTML = `
            <tr class="empty-row">
                <td colspan="4">No hay archivos disponibles</td>
            </tr>
        `;
        return;
    }

    filesContainer.innerHTML = uploadedFiles.map(file => `
        <tr>
            <td class="file-name">${escapeHtml(file.name)}</td>
            <td>${file.size}</td>
            <td>${file.date}</td>
            <td class="${isAdmin ? '' : 'hidden'}">
                <button class="btn btn-danger" onclick="deleteFile(${file.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function deleteFile(id) {
    if (!isAdmin) return;
    uploadedFiles = uploadedFiles.filter(file => file.id !== id);
    saveFiles();
    renderFiles();
}

function saveFiles() {
    localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
}

// ========================================
// Gestión de Publicaciones
// ========================================
let blogPosts = JSON.parse(localStorage.getItem('blogPosts')) || [];

function publishBlog() {
    if (!isAdmin) return;

    const title = document.getElementById('blogTitle').value.trim();
    const content = document.getElementById('blogContent').value.trim();

    if (!title || !content) {
        alert('Por favor, complete todos los campos');
        return;
    }

    const post = {
        id: Date.now(),
        title: title,
        content: content,
        date: new Date().toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    };

    blogPosts.unshift(post);
    saveBlogs();
    renderBlogs();

    document.getElementById('blogTitle').value = '';
    document.getElementById('blogContent').value = '';
}

function renderBlogs() {
    const blogsContainer = document.getElementById('blogsContainer');

    if (blogPosts.length === 0) {
        blogsContainer.innerHTML = '<p class="empty-message">No hay publicaciones disponibles</p>';
        return;
    }

    blogsContainer.innerHTML = blogPosts.map(post => `
        <div class="post-item">
            <div class="post-header">
                <h3 class="post-title">${escapeHtml(post.title)}</h3>
                <span class="post-date">${post.date}</span>
            </div>
            <p class="post-content">${escapeHtml(post.content)}</p>
            ${isAdmin ? `
            <div class="post-actions">
                <button class="btn btn-danger" onclick="deleteBlog(${post.id})">Eliminar</button>
            </div>
            ` : ''}
        </div>
    `).join('');
}

function deleteBlog(id) {
    if (!isAdmin) return;
    blogPosts = blogPosts.filter(post => post.id !== id);
    saveBlogs();
    renderBlogs();
}

function saveBlogs() {
    localStorage.setItem('blogPosts', JSON.stringify(blogPosts));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Inicialización
// ========================================
checkAdminStatus();
