// ========================================
// CONFIGURACIÓN DE UBICACIÓN ADMIN
// ========================================
// Primero necesitas guardar tu ubicación. 
// Abre la página, haz clic en ⚙️ y luego "Guardar mi ubicación actual"
// Después, cada vez que entres desde ese lugar, serás admin automáticamente.

const ADMIN_RADIUS_METERS = 100; // Radio de 100 metros para ser admin

// ========================================
// Sistema de Autenticación por Ubicación
// ========================================
let isAdmin = false;
let adminLocation = JSON.parse(localStorage.getItem('adminLocation'));

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
        adminToggle.title = 'Admin activo';
    } else {
        adminElements.forEach(el => el.style.display = 'none');
        adminHeaders.forEach(el => el.style.display = 'none');
        adminBanner.style.display = 'none';
        adminToggle.textContent = '⚙️';
        adminToggle.title = 'Configurar ubicación admin';
    }

    renderFiles();
    renderBlogs();
}

// Calcular distancia entre dos puntos (fórmula de Haversine)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Verificar ubicación al cargar la página
function checkLocationOnLoad() {
    if (!adminLocation) {
        console.log('No hay ubicación admin configurada');
        return;
    }

    if (!navigator.geolocation) {
        console.log('Geolocalización no soportada');
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

            console.log(`Distancia a ubicación admin: ${Math.round(distance)} metros`);

            if (distance <= ADMIN_RADIUS_METERS) {
                isAdmin = true;
                checkAdminStatus();
                console.log('✅ Modo admin activado por ubicación');
            }
        },
        (error) => {
            console.log('No se pudo obtener ubicación:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Guardar ubicación actual como ubicación admin
function saveAdminLocation() {
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }

    const btn = document.getElementById('saveLocationBtn');
    btn.textContent = 'Obteniendo ubicación...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            adminLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            localStorage.setItem('adminLocation', JSON.stringify(adminLocation));

            isAdmin = true;
            closeLocationModal();
            checkAdminStatus();

            alert('✅ Ubicación guardada!\n\nAhora cada vez que entres desde este lugar, serás admin automáticamente.');
        },
        (error) => {
            btn.textContent = 'Guardar mi ubicación actual';
            btn.disabled = false;
            alert('Error al obtener ubicación: ' + error.message + '\n\nAsegúrate de permitir el acceso a la ubicación.');
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

// Eliminar ubicación guardada
function clearAdminLocation() {
    if (confirm('¿Eliminar la ubicación admin guardada?')) {
        localStorage.removeItem('adminLocation');
        adminLocation = null;
        isAdmin = false;
        closeLocationModal();
        checkAdminStatus();
        alert('Ubicación eliminada');
    }
}

function openLocationModal() {
    const modal = document.getElementById('locationModal');
    const statusText = document.getElementById('locationStatus');
    const clearBtn = document.getElementById('clearLocationBtn');

    if (adminLocation) {
        statusText.textContent = '✅ Ubicación admin configurada';
        statusText.style.color = '#059669';
        clearBtn.style.display = 'block';
    } else {
        statusText.textContent = 'No hay ubicación configurada';
        statusText.style.color = '#6b7280';
        clearBtn.style.display = 'none';
    }

    modal.classList.add('active');
}

function closeLocationModal() {
    document.getElementById('locationModal').classList.remove('active');
    const btn = document.getElementById('saveLocationBtn');
    btn.textContent = 'Guardar mi ubicación actual';
    btn.disabled = false;
}

// Click en botón admin
document.getElementById('adminToggle').addEventListener('click', (e) => {
    e.preventDefault();
    openLocationModal();
});

// Cerrar modal al hacer clic fuera
document.getElementById('locationModal').addEventListener('click', (e) => {
    if (e.target.id === 'locationModal') closeLocationModal();
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
checkLocationOnLoad();
