// ========================================
// CONFIGURACIÓN DE UBICACIÓN ADMIN (ENCRIPTADA)
// ========================================
// La ubicación está codificada para mayor seguridad
// Solo tú puedes ser admin cuando estés en esa ubicación

const ADMIN_RADIUS_METERS = 150; // Radio en metros

// Ubicación admin encriptada (Base64 + ofuscación)
// Para cambiar: pon tus coordenadas, conviértelas a Base64
const ENCODED_LOCATION = localStorage.getItem('_adminLocEnc') || null;

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

// ========================================
// Sistema de Autenticación por Ubicación
// ========================================
let isAdmin = false;
let adminLocation = ENCODED_LOCATION ? decodeLocation(ENCODED_LOCATION) : null;

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {

    // ========================================
    // Funciones de Admin
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

        renderFiles();
        renderBlogs();
    }

    // Calcular distancia (Haversine)
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

    // Verificar ubicación al cargar
    function checkLocationOnLoad() {
        if (!adminLocation) {
            // Primera vez: pedir ubicación para configurar
            if (!ENCODED_LOCATION && navigator.geolocation) {
                // Código secreto: triple click en el logo para configurar admin
                let clickCount = 0;
                let clickTimer = null;
                const logo = document.querySelector('.logo');
                if (logo) {
                    logo.addEventListener('click', () => {
                        clickCount++;
                        if (clickTimer) clearTimeout(clickTimer);
                        clickTimer = setTimeout(() => { clickCount = 0; }, 500);

                        if (clickCount >= 3) {
                            clickCount = 0;
                            setupAdminLocation();
                        }
                    });
                }
            }
            return;
        }

        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const distance = getDistanceMeters(
                    position.coords.latitude,
                    position.coords.longitude,
                    adminLocation.lat,
                    adminLocation.lon
                );

                console.log(`Distancia: ${Math.round(distance)}m`);

                if (distance <= ADMIN_RADIUS_METERS) {
                    isAdmin = true;
                    checkAdminStatus();
                }
            },
            (error) => console.log('Ubicación no disponible'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // Configurar ubicación admin (secreto - triple click en logo)
    function setupAdminLocation() {
        if (ENCODED_LOCATION) return; // Ya configurado

        const password = prompt('Ingrese código de configuración:');
        if (password !== 'setup2026') return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const encoded = encodeLocation(
                    position.coords.latitude,
                    position.coords.longitude
                );
                localStorage.setItem('_adminLocEnc', encoded);
                adminLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
                isAdmin = true;
                checkAdminStatus();
                alert('✅ Ubicación admin configurada!\nRecarga la página.');

                // Mostrar código para hardcodear
                console.log('=== CÓDIGO ENCRIPTADO ===');
                console.log(encoded);
                console.log('Guarda este código en ENCODED_LOCATION del script.js');
            },
            (error) => alert('Error: ' + error.message),
            { enableHighAccuracy: true }
        );
    }

    // ========================================
    // Navegación por Pestañas
    // ========================================
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const tabName = link.dataset.tab;
            if (tabName) {
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabName).classList.add('active');
            }
        });
    });

    // ========================================
    // Gestión de Archivos
    // ========================================
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    let uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles')) || [];

    if (dropZone) {
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
            if (isAdmin && fileInput) fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (isAdmin) handleFiles(e.target.files);
        });
    }

    function handleFiles(files) {
        for (let file of files) {
            uploadedFiles.push({
                id: Date.now() + Math.random(),
                name: file.name,
                size: formatFileSize(file.size),
                date: new Date().toLocaleDateString('es-ES')
            });
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
        const filesContainer = document.getElementById('filesContainer');
        if (!filesContainer) return;

        if (uploadedFiles.length === 0) {
            filesContainer.innerHTML = '<tr class="empty-row"><td colspan="4">No hay archivos disponibles</td></tr>';
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

    window.deleteFile = function (id) {
        if (!isAdmin) return;
        uploadedFiles = uploadedFiles.filter(f => f.id !== id);
        saveFiles();
        renderFiles();
    };

    function saveFiles() {
        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
    }

    // ========================================
    // Gestión de Publicaciones con Comentarios
    // ========================================
    let blogPosts = JSON.parse(localStorage.getItem('blogPosts')) || [];

    window.publishBlog = function () {
        if (!isAdmin) return;

        const title = document.getElementById('blogTitle').value.trim();
        const content = document.getElementById('blogContent').value.trim();

        if (!title || !content) {
            alert('Complete todos los campos');
            return;
        }

        blogPosts.unshift({
            id: Date.now(),
            title: title,
            content: content,
            date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            comments: []
        });

        saveBlogs();
        renderBlogs();
        document.getElementById('blogTitle').value = '';
        document.getElementById('blogContent').value = '';
    };

    function renderBlogs() {
        const blogsContainer = document.getElementById('blogsContainer');
        if (!blogsContainer) return;

        if (blogPosts.length === 0) {
            blogsContainer.innerHTML = '<p class="empty-message">No hay publicaciones disponibles</p>';
            return;
        }

        blogsContainer.innerHTML = blogPosts.map(post => `
            <div class="post-item" id="post-${post.id}">
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
                
                <!-- Sección de Comentarios -->
                <div class="comments-section">
                    <h4 class="comments-title">💬 Comentarios (${post.comments ? post.comments.length : 0})</h4>
                    
                    <div class="comments-list">
                        ${(post.comments || []).map((comment, idx) => `
                            <div class="comment ${comment.isAdmin ? 'comment-admin' : ''}">
                                <div class="comment-header">
                                    <span class="comment-author">${escapeHtml(comment.author)}${comment.isAdmin ? ' <span class="admin-badge">Admin</span>' : ''}</span>
                                    <span class="comment-date">${comment.date}</span>
                                    ${isAdmin ? `<button class="btn-delete-comment" onclick="deleteComment(${post.id}, ${idx})">×</button>` : ''}
                                </div>
                                <p class="comment-text">${escapeHtml(comment.text)}</p>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="comment-form">
                        <input type="text" class="form-control comment-author-input" id="author-${post.id}" placeholder="Tu nombre" maxlength="30">
                        <textarea class="form-control comment-text-input" id="comment-${post.id}" placeholder="Escribe un comentario..." rows="2"></textarea>
                        <button class="btn btn-primary btn-comment" onclick="addComment(${post.id})">Comentar</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    window.addComment = function (postId) {
        const authorInput = document.getElementById(`author-${postId}`);
        const textInput = document.getElementById(`comment-${postId}`);

        const author = authorInput.value.trim() || 'Anónimo';
        const text = textInput.value.trim();

        if (!text) {
            alert('Escribe un comentario');
            return;
        }

        const post = blogPosts.find(p => p.id === postId);
        if (!post) return;

        if (!post.comments) post.comments = [];

        post.comments.push({
            author: author,
            text: text,
            date: new Date().toLocaleDateString('es-ES'),
            isAdmin: isAdmin
        });

        saveBlogs();
        renderBlogs();
    };

    window.deleteComment = function (postId, commentIndex) {
        if (!isAdmin) return;
        const post = blogPosts.find(p => p.id === postId);
        if (post && post.comments) {
            post.comments.splice(commentIndex, 1);
            saveBlogs();
            renderBlogs();
        }
    };

    window.deleteBlog = function (id) {
        if (!isAdmin) return;
        blogPosts = blogPosts.filter(post => post.id !== id);
        saveBlogs();
        renderBlogs();
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
    // Inicialización
    // ========================================
    checkAdminStatus();
    checkLocationOnLoad();

});
