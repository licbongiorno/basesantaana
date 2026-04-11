import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB989b4dx4ao6So14IWRQwwZ0JybGVMFGQ",
  authDomain: "directorio-santa-ana.firebaseapp.com",
  projectId: "directorio-santa-ana",
  storageBucket: "directorio-santa-ana.firebasestorage.app",
  messagingSenderId: "789802339881",
  appId: "1:789802339881:web:b9e74a336814fec3d55638"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ==========================================
// CONFIGURACIÓN Y CACHÉ OFFLINE (Modo v10+)
// ==========================================
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ==========================================
// ARQUITECTURA DE ESTADO
// ==========================================
let serviciosCargados = false; 

const EstadoDirectorio = (() => {
    const servicios = new Map();
    let favoritos = new Set();

    return {
        setServicios: (dataArray) => {
            servicios.clear();
            dataArray.forEach(item => servicios.set(item.id, item));
        },
        getServicio: (id) => servicios.get(id),
        setFavoritos: (favArray) => {
            favoritos = new Set(favArray || []);
        },
        getFavoritos: () => Array.from(favoritos),
        toggleFavorito: (id) => {
            if (favoritos.has(id)) {
                favoritos.delete(id);
            } else {
                favoritos.add(id);
            }
            return Array.from(favoritos);
        }
    };
})();

// ==========================================
// UTILIDADES, TOAST Y CUSTOM CONFIRM
// ==========================================
function sanitize(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function quitarAcentos(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function esUrlSegura(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol);
    } catch (e) {
        return false;
    }
}

function obtenerEnlaceSeguro(url, fallback = '#') {
    return esUrlSegura(url) ? url : fallback;
}

function formatearEnlace(url, plataforma) {
    if (!url) return '';
    let enlace = url.trim();
    let urlFinal = '';
    
    if (enlace.startsWith('http://') || enlace.startsWith('https://')) {
        urlFinal = sanitize(enlace);
    } else if (plataforma === 'facebook') {
        if (enlace.includes('facebook.com')) urlFinal = sanitize('https://' + enlace);
        else urlFinal = sanitize('https://www.facebook.com/' + enlace);
    } else if (plataforma === 'instagram') {
        if (enlace.includes('instagram.com')) urlFinal = sanitize('https://' + enlace);
        else {
            enlace = enlace.replace('@', '');
            urlFinal = sanitize('https://www.instagram.com/' + enlace);
        }
    } else {
        urlFinal = sanitize(enlace);
    }
    
    return obtenerEnlaceSeguro(urlFinal);
}

function formatearWhatsapp(numero) {
    if (!numero) return '';
    let limpio = numero.replace(/\D/g, ''); 
    if (!limpio.startsWith('549') && !limpio.startsWith('54')) {
        limpio = '549' + limpio;
    }
    return limpio;
}

window.mostrarToast = function(mensaje) {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.className = 'toast-container';
        document.body.appendChild(toast);
    }
    toast.innerText = mensaje;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
};

window.mostrarConfirm = function(mensaje, onAceptar) {
    const overlay = document.getElementById('confirm-overlay');
    if (!overlay) return;

    document.getElementById('confirm-msg').textContent = mensaje;
    overlay.classList.add('active');

    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');

    const cleanup = () => overlay.classList.remove('active');
    
    ok.onclick = () => { cleanup(); onAceptar(); };
    cancel.onclick = cleanup;
};

// ==========================================
// FUNCIÓN SEO PARA GOOGLE (JSON-LD)
// ==========================================
function inyectarSchemaGoogle(data) {
    const schemaTag = document.getElementById('schema-json');
    if (!schemaTag) return;

    const waNumero = formatearWhatsapp(data.whatsapp);

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": data.nombre,
        "description": data.descripcion,
        "telephone": `+${waNumero}`,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Villa Parque Santa Ana",
            "addressRegion": "Córdoba",
            "addressCountry": "AR"
        },
        "url": window.location.href,
        "sameAs": [
            data.instagram ? formatearEnlace(data.instagram, 'instagram') : null,
            data.facebook  ? formatearEnlace(data.facebook, 'facebook')   : null
        ].filter(Boolean)
    };

    schemaTag.textContent = JSON.stringify(schemaData, null, 2);
}

// ==========================================
// SVG ICONS
// ==========================================
const SVG_HEART_EMPTY = `<svg class="fav-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_HEART_FILLED = `<svg class="fav-svg fav-svg--filled" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_SHARE = `<svg class="share-svg" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
const SVG_IG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
const SVG_FB = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
const SVG_WA = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
const SVG_WA_LOGO = `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`;

// ==========================================
// TEMA CLARO / OSCURO
// ==========================================
const btnTheme = document.getElementById('btn-theme-toggle');
if (btnTheme) {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        btnTheme.innerText = '☀️';
    }
    btnTheme.addEventListener('click', () => {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            btnTheme.innerText = '🌙';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            btnTheme.innerText = '☀️';
        }
    });
}

// ==========================================
// SPA Y PANEL DE USUARIO
// ==========================================
const vistaDirectorio = document.getElementById('vista-directorio');
const vistaPanel = document.getElementById('vista-panel');
const btnNavPanel = document.getElementById('btn-publicar');
const btnVolverDirectorio = document.getElementById('btn-volver-directorio');

window.abrirPanelGestion = function() {
    if(vistaDirectorio) vistaDirectorio.classList.add('hidden');
    if(vistaPanel) vistaPanel.classList.remove('hidden');
    document.body.classList.add('modo-formulario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (usuarioActual) mostrarDashboard(); 
}

if(btnNavPanel) btnNavPanel.addEventListener('click', abrirPanelGestion);

if(btnVolverDirectorio) {
    btnVolverDirectorio.addEventListener('click', () => {
        if(vistaPanel) vistaPanel.classList.add('hidden');
        if(vistaDirectorio) vistaDirectorio.classList.remove('hidden');
        document.body.classList.remove('modo-formulario');
        
        if (!serviciosCargados) {
            cargarServicios(); 
        }
    });
}

// ==========================================
// AUTENTICACIÓN Y GESTIÓN
// ==========================================
let documentoIdActual = null; 
let usuarioActual = null;

const btnLogout = document.getElementById('btn-logout');
const seccionLogin = document.getElementById('seccion-login');
const seccionDashboard = document.getElementById('seccion-dashboard');
const seccionFormulario = document.getElementById('seccion-formulario');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActual = user;
        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().favoritos) {
                EstadoDirectorio.setFavoritos(userDoc.data().favoritos);
            } else {
                EstadoDirectorio.setFavoritos([]);
            }
        } catch (error) {
            EstadoDirectorio.setFavoritos([]);
        }

        if(seccionLogin) seccionLogin.classList.add('hidden');
        if(btnLogout) btnLogout.classList.remove('hidden');
        if(seccionDashboard) seccionDashboard.classList.remove('hidden');
        
    } else {
        usuarioActual = null;
        EstadoDirectorio.setFavoritos([]);
        if(seccionLogin) seccionLogin.classList.remove('hidden');
        if(seccionDashboard) seccionDashboard.classList.add('hidden');
        if(seccionFormulario) seccionFormulario.classList.add('hidden');
        if(btnLogout) btnLogout.classList.add('hidden');
        
        const contenedorLista = document.getElementById('lista-mis-servicios');
        if(contenedorLista) contenedorLista.innerHTML = "";
    }
});

const btnLogin = document.getElementById('btn-login');
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } catch (e) { mostrarToast("⚠️ Error al iniciar sesión."); }
    });
}

if(btnLogout) {
    btnLogout.addEventListener('click', async () => {
        mostrarConfirm("¿Seguro que deseas cerrar sesión?", async () => {
            try {
                await signOut(auth);
                if(btnVolverDirectorio) btnVolverDirectorio.click(); 
            } catch (error) { mostrarToast("⚠️ Error al cerrar sesión."); }
        });
    });
}

const tabAnuncios = document.getElementById('tab-mis-anuncios');
const tabFavoritos = document.getElementById('tab-mis-favoritos');
const contAnuncios = document.getElementById('contenido-mis-anuncios');
const contFavoritos = document.getElementById('contenido-mis-favoritos');

if(tabAnuncios && tabFavoritos) {
    tabAnuncios.addEventListener('click', () => {
        tabAnuncios.classList.add('active');
        tabFavoritos.classList.remove('active');
        contAnuncios.classList.remove('hidden');
        contFavoritos.classList.add('hidden');
    });

    tabFavoritos.addEventListener('click', () => {
        tabFavoritos.classList.add('active');
        tabAnuncios.classList.remove('active');
        contFavoritos.classList.remove('hidden');
        contAnuncios.classList.add('hidden');
        renderizarMisFavoritosDash();
    });
}

async function mostrarDashboard() {
    if(seccionFormulario) seccionFormulario.classList.add('hidden');
    if(seccionDashboard) seccionDashboard.classList.remove('hidden');
    if(tabAnuncios) tabAnuncios.click();
    
    const contenedorLista = document.getElementById('lista-mis-servicios');
    if(!contenedorLista) return;
    contenedorLista.innerHTML = "Cargando tus servicios...";

    try {
        const q = query(collection(db, "servicios"), where("usuarioId", "==", usuarioActual.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            contenedorLista.innerHTML = "<p style='color: var(--text-muted);'>Aún no tenés servicios publicados.</p>";
            return;
        }

        const frag = document.createDocumentFragment();
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'item-dashboard fade-in-up';
            div.innerHTML = `
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${sanitize(data.nombre)}</h3>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${sanitize(data.categoria)}</span>
                    <span style="font-size: 0.75rem; color: var(--primary-color); display: block; margin-top: 4px; font-weight: 500;">👁 ${data.vistas || 0} vistas | 💬 ${data.clicsWhatsapp || 0} clics en WA</span>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-editar-servicio" data-id="${docSnap.id}" style="background:var(--primary-color); color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer; transition: 0.2s;">Editar</button>
                    <button class="btn-borrar-servicio" data-id="${docSnap.id}" style="background:#dc2626; color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer; transition: 0.2s;">Borrar</button>
                </div>
            `;
            frag.appendChild(div);
        });
        
        contenedorLista.innerHTML = "";
        contenedorLista.appendChild(frag);
    } catch(e) {
        contenedorLista.innerHTML = "<p style='color: red;'>Error al cargar tus servicios.</p>";
    }
}

window.renderizarMisFavoritosDash = function() {
    const contenedorFavs = document.getElementById('lista-mis-favoritos');
    if(!contenedorFavs) return;
    
    const favs = EstadoDirectorio.getFavoritos();
    if(favs.length === 0) {
        contenedorFavs.innerHTML = "<p style='color: var(--text-muted);'>Aún no guardaste ningún profesional.</p>";
        return;
    }

    const frag = document.createDocumentFragment();
    favs.forEach(id => {
        const data = EstadoDirectorio.getServicio(id);
        if(!data) return;
        
        const div = document.createElement('div');
        div.className = 'item-dashboard fade-in-up';
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap;';
        div.innerHTML = `
            <div>
                <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${sanitize(data.nombre)}</h3>
                <span style="font-size: 0.8rem; color: var(--primary-color); font-weight: bold;">${sanitize(data.categoria)}</span>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn-ver-anuncio" data-id="${id}" style="background:var(--primary-color); color:white; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer;">Ver Anuncio</button>
                <button class="btn-quitar-fav" data-id="${id}" style="background:#fee2e2; color:#ef4444; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer;">Quitar</button>
            </div>
        `;
        frag.appendChild(div);
    });
    
    contenedorFavs.innerHTML = "";
    contenedorFavs.appendChild(frag);
}

window.editarServicio = async function(id) {
    documentoIdActual = id;
    if(seccionDashboard) seccionDashboard.classList.add('hidden');
    if(seccionFormulario) seccionFormulario.classList.remove('hidden');
    document.getElementById('titulo-formulario').innerText = "Cargando datos...";
    
    try {
        const docRef = doc(db, "servicios", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('titulo-formulario').innerText = "Editar Servicio";
            document.getElementById('nombre').value = data.nombre || '';
            document.getElementById('categoria').value = data.categoria || '';
            document.getElementById('ubicacion').value = data.ubicacion || 'A domicilio';
            document.getElementById('whatsapp').value = data.whatsapp || '';
            document.getElementById('instagram').value = data.instagram || '';
            document.getElementById('facebook').value = data.facebook || '';
            document.getElementById('descripcion').value = data.descripcion || '';
            document.getElementById('urgencias').checked = data.urgencias || false;
            document.getElementById('presupuesto').checked = data.presupuesto || false;
        } else {
            mostrarToast("⚠️ El servicio no existe o fue borrado.");
            mostrarDashboard();
        }
    } catch (error) {
        mostrarToast("⚠️ Error al obtener los datos del servicio.");
        mostrarDashboard();
    }
};

window.borrarServicio = async function(id) {
    mostrarConfirm("¿Seguro que querés eliminar este servicio definitivamente?", async () => {
        try {
            await deleteDoc(doc(db, "servicios", id));
            serviciosCargados = false; 
            mostrarDashboard();
            mostrarToast("🗑️ Servicio eliminado");
        } catch (error) {
            mostrarToast("⚠️ No se pudo eliminar. Revisá tu conexión.");
        }
    });
};

const btnCrearNuevo = document.getElementById('btn-crear-nuevo');
if(btnCrearNuevo) {
    btnCrearNuevo.addEventListener('click', () => {
        documentoIdActual = null; 
        document.getElementById('form-servicio').reset();
        if(seccionDashboard) seccionDashboard.classList.add('hidden');
        if(seccionFormulario) seccionFormulario.classList.remove('hidden');
        document.getElementById('titulo-formulario').innerText = "Nuevo Servicio";
    });
}

const btnCancelar = document.getElementById('btn-cancelar');
if(btnCancelar) btnCancelar.addEventListener('click', () => { mostrarDashboard(); });

const formServicio = document.getElementById('form-servicio');
if(formServicio) {
    formServicio.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombreCrudo = document.getElementById('nombre').value.trim();
        const descripcionCruda = document.getElementById('descripcion').value.trim();

        if (!nombreCrudo || !descripcionCruda) {
            mostrarToast("⚠️ El nombre y la descripción no pueden estar vacíos.");
            return;
        }

        const waRaw = document.getElementById('whatsapp').value.trim();
        const waLimpio = waRaw.replace(/\D/g, '');
        if (waLimpio.length < 8 || waLimpio.length > 15) {
            mostrarToast("⚠️ El número de WhatsApp no parece válido.");
            return;
        }

        const btnSubmit = document.getElementById('btn-guardar');
        btnSubmit.innerHTML = "Guardando..."; 
        btnSubmit.disabled = true;

        const datos = {
            nombre: nombreCrudo, 
            categoria: document.getElementById('categoria').value,
            ubicacion: document.getElementById('ubicacion').value.trim(),
            whatsapp: waLimpio,
            instagram: document.getElementById('instagram').value.trim(),
            facebook: document.getElementById('facebook').value.trim(),
            descripcion: descripcionCruda, 
            urgencias: document.getElementById('urgencias').checked,
            presupuesto: document.getElementById('presupuesto').checked,
            usuarioId: usuarioActual.uid, 
            ultimaActualizacion: serverTimestamp()
        };

        try {
            if (documentoIdActual) { 
                await updateDoc(doc(db, "servicios", documentoIdActual), datos); 
            } else { 
                await addDoc(collection(db, "servicios"), datos); 
            }
            serviciosCargados = false; 
            mostrarDashboard();
            mostrarToast("✅ Servicio guardado con éxito");
        } catch (error) { 
            mostrarToast("⚠️ Error al guardar. Intente nuevamente."); 
        } finally { 
            btnSubmit.innerHTML = "Guardar Servicio"; 
            btnSubmit.disabled = false; 
        }
    });
}

// ==========================================
// COMPARTIR Y FAVORITOS
// ==========================================
window.toggleFavorito = async function(id) {
    if (!usuarioActual) {
        mostrarToast("⚠️ Iniciá sesión para guardar favoritos");
        return;
    }

    try {
        const nuevosFavoritos = EstadoDirectorio.toggleFavorito(id);
        const estaEnFavs = nuevosFavoritos.includes(id);
        const userDocRef = doc(db, "usuarios", usuarioActual.uid);
        
        await setDoc(userDocRef, { favoritos: nuevosFavoritos }, { merge: true });

        mostrarToast(estaEnFavs ? "❤️ Agregado a favoritos" : "❌ Quitado de favoritos");

        const cardFavBtn = document.querySelector(`.tarjeta-servicio[data-id="${id}"] .btn-fav-card`);
        if (cardFavBtn) {
            if (estaEnFavs) {
                cardFavBtn.classList.add('active');
                cardFavBtn.innerHTML = SVG_HEART_FILLED;
            } else {
                cardFavBtn.classList.remove('active');
                cardFavBtn.innerHTML = SVG_HEART_EMPTY;
            }
        }

        const btnModal = document.getElementById('btn-fav-modal');
        if (btnModal && btnModal.dataset.id === id) {
            btnModal.innerHTML = estaEnFavs ? '❤️ Quitar Favorito' : '🤍 Guardar Favorito';
        }

        const contFavoritos = document.getElementById('contenido-mis-favoritos');
        if (contFavoritos && !contFavoritos.classList.contains('hidden')) {
            renderizarMisFavoritosDash();
        }

    } catch (error) {
        EstadoDirectorio.toggleFavorito(id);
        mostrarToast("⚠️ Hubo un problema de conexión");
    }
};

window.compartirAnuncio = function(id, nombre, categoria) {
    const urlCompartir = `${window.location.origin}${window.location.pathname}?id=${id}`;
    if (navigator.share) {
        navigator.share({
            title: nombre,
            text: `Mirá este profesional en el Directorio de Santa Ana: ${nombre} (${categoria})`,
            url: urlCompartir
        }).catch(() => {}); 
    } else {
        navigator.clipboard.writeText(urlCompartir).then(() => {
            mostrarToast('✅ Enlace copiado al portapapeles');
        }).catch(() => {
            mostrarToast('📋 Copiá este enlace: ' + urlCompartir);
        });
    }
};

// ==========================================
// MODAL DE PERFIL Y ACCESIBILIDAD (A11y)
// ==========================================
const modalPerfil = document.getElementById('modal-perfil');
const modalBody = document.getElementById('modal-body');

window.abrirModal = function(id) {
    const data = EstadoDirectorio.getServicio(id);
    if (!data) return;

    const docRef = doc(db, "servicios", id);
    updateDoc(docRef, { vistas: increment(1) }).catch(() => {});

    document.title = `${data.nombre} - ${data.categoria} en Santa Ana`;
    history.pushState(null, null, `?id=${id}`);
    inyectarSchemaGoogle(data);

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', `${data.nombre} — ${data.categoria} en Villa Parque Santa Ana. ${(data.descripcion || '').substring(0, 120)}...`);
    }

    const waNumero = formatearWhatsapp(data.whatsapp);
    
    const esDestacado = data.destacado === true; 
    
    const mensajeWA = encodeURIComponent(`Hola ${data.nombre}, vi tu anuncio de ${data.categoria} en el Directorio de Santa Ana. Quería hacerte una consulta...`);

    let badgesHTML = "";
    if (esDestacado) badgesHTML += `<span class="badge badge-destacado">DESTACADO</span>`;
    if (data.urgencias)  badgesHTML += `<span class="badge badge-red">URGENCIAS 24H</span>`;
    if (data.presupuesto) badgesHTML += `<span class="badge badge-blue">PRESUPUESTO SIN CARGO</span>`;

    let redesHTML = "";
    if (data.instagram || data.facebook) {
        redesHTML += `<div class="redes-sociales" style="margin-top: 1.5rem;">`;
        if (data.instagram) {
            redesHTML += `<a href="${formatearEnlace(data.instagram, 'instagram')}" target="_blank" rel="noopener noreferrer" class="btn-social btn-ig rounded-button">${SVG_IG} Instagram</a>`;
        }
        if (data.facebook) {
            redesHTML += `<a href="${formatearEnlace(data.facebook, 'facebook')}" target="_blank" rel="noopener noreferrer" class="btn-social btn-fb rounded-button">${SVG_FB} Facebook</a>`;
        }
        redesHTML += `</div>`;
    }

    const favs = EstadoDirectorio.getFavoritos();
    const esFav = favs.includes(id);
    const labelFav = esFav ? '❤️ Quitar Favorito' : '🤍 Guardar Favorito';

    if (modalBody) {
        modalBody.innerHTML = `
            <div style="padding-right: 2.5rem;">
                <div class="categoria-tag" style="margin-bottom: 0.5rem; display: inline-block;">${sanitize(data.categoria)}</div>
                <h2 style="font-size: 1.6rem; color: var(--text-color); margin-bottom: 0.5rem;">${sanitize(data.nombre)}</h2>
            </div>

            ${badgesHTML !== "" ? `<div class="badges-container" style="margin-bottom: 1rem;">${badgesHTML}</div>` : ""}

            <div style="margin: 1.5rem 0; padding: 1.5rem; background: var(--input-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 0.8rem; color: var(--primary-color);">Sobre el servicio</h4>
                <p style="color: var(--text-color); line-height: 1.6; white-space: pre-line;">${sanitize(data.descripcion)}</p>
            </div>

            <div class="info-extra" style="font-size: 1rem; border: none; padding: 0;">
                <p style="margin-bottom: 0.5rem;"><strong>Modalidad:</strong> ${sanitize(data.ubicacion || 'Consultar')}</p>
            </div>

            ${redesHTML}

            <div class="modal-actions-row">
                <button id="btn-fav-modal" class="btn-modal-action" data-id="${id}">
                    ${labelFav}
                </button>
                <button class="btn-modal-action btn-share" data-id="${id}">
                    📤 Compartir
                </button>
            </div>
            
            <div style="height: 60px;"></div>

            <a href="https://wa.me/${waNumero}?text=${mensajeWA}" target="_blank" rel="noopener noreferrer" class="btn-wa-flotante-modal" aria-label="Consultar por WhatsApp" data-id="${id}">
                ${SVG_WA_LOGO}
            </a>
        `;
    }

    if (modalPerfil) {
        modalPerfil.classList.remove('hidden');
        setTimeout(() => modalPerfil.classList.add('active'), 10);
        document.body.classList.add('modal-open');
        
        setTimeout(() => {
            const btnClose = modalPerfil.querySelector('.btn-close');
            if(btnClose) btnClose.focus();
        }, 50);
    }
};

window.cerrarModalPerfil = function({ sinPushState = false } = {}) {
    if (!modalPerfil) return;
    modalPerfil.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modalPerfil.classList.add('hidden'); }, 300);
    
    if (!sinPushState && window.location.search.includes('id=')) {
        history.pushState(null, null, window.location.pathname);
    }
};

const btnCerrarModal = document.getElementById('btn-cerrar-modal');
if (btnCerrarModal) btnCerrarModal.addEventListener('click', () => cerrarModalPerfil());

if (modalPerfil) {
    modalPerfil.addEventListener('click', (e) => {
        if (e.target === modalPerfil) cerrarModalPerfil();
    });
}

// ----------------------------------------
// EVENTOS DE NAVEGACIÓN Y TECLADO UNIFICADOS
// ----------------------------------------
window.addEventListener('popstate', () => {
    const modal = document.getElementById('modal-perfil');
    if (modal && !modal.classList.contains('hidden')) {
        cerrarModalPerfil({ sinPushState: true });
    }
});

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modal-perfil');
    const modalVisible = modal && !modal.classList.contains('hidden');

    if (e.key === 'Escape' && modalVisible) {
        cerrarModalPerfil();
        return;
    }

    if (e.key === 'Tab' && modalVisible) {
        const focusables = [...modal.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) { 
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else { 
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }
});

// ==========================================
// DELEGACIÓN DE EVENTOS CENTRALIZADA
// ==========================================
const listaServicios = document.getElementById('lista-servicios');
if (listaServicios) {
    listaServicios.addEventListener('click', (evento) => {
        const btnFav = evento.target.closest('.btn-fav-card');
        const btnShare = evento.target.closest('.btn-share-card');
        const btnWa = evento.target.closest('.btn-wa-card');
        const btnCta = evento.target.closest('.tarjeta-cta-unirse');
        const tarjeta = evento.target.closest('.tarjeta-servicio:not(.tarjeta-cta-unirse)');

        if (btnFav) {
            evento.stopPropagation();
            evento.preventDefault();
            const id = btnFav.dataset.id;
            toggleFavorito(id);
            return;
        }

        if (btnShare) {
            evento.stopPropagation();
            evento.preventDefault();
            const data = EstadoDirectorio.getServicio(btnShare.dataset.id);
            if (data) compartirAnuncio(data.id, data.nombre, data.categoria);
            return;
        }

        if (btnWa) {
            evento.stopPropagation();
            evento.preventDefault();
            
            const docId = btnWa.dataset.id;
            if (docId) {
                updateDoc(doc(db, "servicios", docId), { 
                    clicsWhatsapp: increment(1) 
                }).catch(() => {});
            }

            window.open(`https://wa.me/${btnWa.dataset.wa}?text=${btnWa.dataset.msg}`, '_blank');
            return;
        }

        if (btnCta) {
            evento.stopPropagation();
            window.abrirPanelGestion();
            return;
        }

        if (tarjeta) {
            abrirModal(tarjeta.dataset.id);
        }
    });
}

if (modalBody) {
    modalBody.addEventListener('click', (e) => {
        const btnFavModal = e.target.closest('#btn-fav-modal');
        const btnShareModal = e.target.closest('.btn-share');
        const btnWaModal = e.target.closest('.btn-wa-flotante-modal');

        if (btnFavModal) {
            toggleFavorito(btnFavModal.dataset.id);
        }
        if (btnShareModal) {
            const data = EstadoDirectorio.getServicio(btnShareModal.dataset.id);
            if (data) compartirAnuncio(data.id, data.nombre, data.categoria);
        }
        if (btnWaModal) {
            const docId = btnWaModal.dataset.id;
            if (docId) {
                updateDoc(doc(db, "servicios", docId), { 
                    clicsWhatsapp: increment(1) 
                }).catch(() => {});
            }
        }
    });
}

const contenedorMisServicios = document.getElementById('lista-mis-servicios');
if (contenedorMisServicios) {
    contenedorMisServicios.addEventListener('click', (e) => {
        const btnEditar = e.target.closest('.btn-editar-servicio');
        const btnBorrar = e.target.closest('.btn-borrar-servicio');
        if (btnEditar) editarServicio(btnEditar.dataset.id);
        if (btnBorrar) borrarServicio(btnBorrar.dataset.id);
    });
}

const contenedorMisFavoritos = document.getElementById('lista-mis-favoritos');
if (contenedorMisFavoritos) {
    contenedorMisFavoritos.addEventListener('click', (e) => {
        const btnVer = e.target.closest('.btn-ver-anuncio');
        const btnQuitar = e.target.closest('.btn-quitar-fav');
        if (btnVer) {
            cerrarModalPerfil({ sinPushState: true });
            abrirModal(btnVer.dataset.id);
        }
        if (btnQuitar) {
            toggleFavorito(btnQuitar.dataset.id);
        }
    });
}

// ==========================================
// DIRECTORIO Y CARGA DE DATOS
// ==========================================
const contadorTexto = document.getElementById('contador-profesionales');
let filtroActivo = ""; 

async function cargarServicios() {
    if (!listaServicios) return;
    
    listaServicios.innerHTML = `
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    `;

    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        listaServicios.innerHTML = ""; 
        
        if (contadorTexto) {
            contadorTexto.innerText = `Ya somos ${querySnapshot.size} profesionales listos para ayudarte`;
        }

        const fragmentoPrincipal = document.createDocumentFragment();

        const contenedorCta = document.createElement('div');
        contenedorCta.innerHTML = `
            <article class="tarjeta-servicio tarjeta-cta-unirse fade-in-up professional-card">
                <div class="centrado" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <span style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;">🚀</span>
                    <h2 style="font-size: 1.3rem; color: var(--text-color); margin-bottom: 0.5rem; text-align: center;">Conseguí clientes hoy mismo</h2>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; text-align: center;">
                        Publicá gratis en 2 minutos. Plomeros, electricistas, docentes... ¡Sumá ingresos desde hoy!
                    </p>
                    <button class="btn-whatsapp rounded-button pulse-subtle" style="background: var(--primary-color); width: auto; display:inline-block; padding: 10px 20px;">Publicar mi servicio Gratis</button>
                </div>
            </article>
        `;
        fragmentoPrincipal.appendChild(contenedorCta.firstElementChild);

        if (querySnapshot.empty) { 
            EstadoDirectorio.setServicios([]);
            listaServicios.appendChild(fragmentoPrincipal);
            serviciosCargados = true;
            return; 
        }

        let delayAnimacion = 0.1; 
        const favsGuardados = EstadoDirectorio.getFavoritos();
        
        const tarjetasDestacadas = [];
        const tarjetasNormales = [];
        const datosParaEstado = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            
            const nombreNorm = quitarAcentos((data.nombre || "").toLowerCase());
            const categoriaNorm = quitarAcentos((data.categoria || "").toLowerCase());
            const descripcionNorm = quitarAcentos((data.descripcion || "").toLowerCase());
            data.texto_normalizado = `${nombreNorm} ${categoriaNorm} ${descripcionNorm}`;
            
            datosParaEstado.push(data);
            
            const esDestacado = data.destacado === true;
            
            const esFav = favsGuardados.includes(docSnap.id);

            const waNumeroCard = formatearWhatsapp(data.whatsapp);
            const mensajeWACard = encodeURIComponent(`Hola ${data.nombre}, vi tu anuncio en el Directorio de Santa Ana...`);

            const article = document.createElement('article');
            article.className = `tarjeta-servicio fade-in-up ${esDestacado ? 'tarjeta-destacada' : ''}`;
            
            article.style.animationDelay = `${Math.min(delayAnimacion, 0.5)}s`;
            article.dataset.id = docSnap.id;

            article.innerHTML = `
                <div class="card-actions-top">
                    <button class="btn-icon-card btn-fav-card ${esFav ? 'active' : ''}" title="Favoritos" data-id="${docSnap.id}">
                        ${esFav ? SVG_HEART_FILLED : SVG_HEART_EMPTY}
                    </button>
                    <button class="btn-icon-card btn-share-card" title="Compartir" data-id="${docSnap.id}">
                        ${SVG_SHARE}
                    </button>
                    <button class="btn-icon-card btn-wa-card" data-wa="${waNumeroCard}" data-msg="${mensajeWACard}" title="WhatsApp Directo" data-id="${docSnap.id}">
                        ${SVG_WA}
                    </button>
                </div>

                <div class="categoria-tag">${sanitize(data.categoria)}</div>
                <h2 class="titulo-con-margen">${sanitize(data.nombre)}</h2>
                <p class="descripcion">${sanitize(data.descripcion)}</p>
                <div class="info-extra">
                    <span>📍 ${sanitize(data.ubicacion || 'Consultar')}</span>
                </div>

                <div class="card-footer-more">
                    <a href="?id=${docSnap.id}" class="ver-mas-texto" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; gap: 5px; width: 100%; justify-content: center; padding: 0.5rem 0;" onclick="event.preventDefault(); abrirModal('${docSnap.id}')">
                        ➕ Ver más datos
                    </a>
                </div>
            `;
            
            if (esDestacado) {
                tarjetasDestacadas.push(article);
            } else {
                tarjetasNormales.push(article);
            }
            delayAnimacion += 0.1; 
        });
        
        EstadoDirectorio.setServicios(datosParaEstado);
        
        const schemaTag = document.getElementById('schema-json');
        if (schemaTag && !new URLSearchParams(window.location.search).get('id')) {
            schemaTag.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Directorio de Profesionales - Santa Ana Guía",
                "description": "Guía de servicios locales en Villa Parque Santa Ana, Córdoba",
                "url": window.location.href,
                "numberOfItems": datosParaEstado.length,
                "itemListElement": datosParaEstado.map((item, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "url": `${window.location.origin}${window.location.pathname}?id=${item.id}`,
                    "name": item.nombre
                }))
            });
        }
        
        tarjetasDestacadas.forEach(tarjeta => fragmentoPrincipal.appendChild(tarjeta));
        tarjetasNormales.forEach(tarjeta => fragmentoPrincipal.appendChild(tarjeta));

        listaServicios.appendChild(fragmentoPrincipal);
        
        serviciosCargados = true; 

        const urlParams = new URLSearchParams(window.location.search);
        
        const idCompartido = urlParams.get('id');
        if (idCompartido && EstadoDirectorio.getServicio(idCompartido)) {
            abrirModal(idCompartido);
        }

        const categoriaBuscada = urlParams.get('categoria');
        if (categoriaBuscada) {
            document.title = `${categoriaBuscada.charAt(0).toUpperCase() + categoriaBuscada.slice(1)} en Santa Ana Guía`;
            const buscador = document.getElementById('buscador');
            if (buscador) {
                buscador.value = categoriaBuscada;
                aplicarFiltros();
            }
        }

    } catch (error) { 
        listaServicios.innerHTML = "<p style='color: red; text-align:center;'>Error de conexión. Intente refrescar la página.</p>"; 
    }
}

// ==========================================
// FILTROS Y BÚSQUEDA
// ==========================================
function aplicarFiltros() {
    const buscador = document.getElementById('buscador');
    const textoBusqueda = buscador ? quitarAcentos(buscador.value.toLowerCase().trim()) : '';
    const terminosBusqueda = textoBusqueda.split(' ').filter(termino => termino.length > 0);
    
    const tarjetas = document.querySelectorAll('.tarjeta-servicio:not(.tarjeta-cta-unirse)');
    let tarjetasVisibles = 0;

    tarjetas.forEach(tarjeta => {
        const servicio = EstadoDirectorio.getServicio(tarjeta.dataset.id);
        if (!servicio) return;
        
        const coincideTexto = terminosBusqueda.every(termino => 
            servicio.texto_normalizado.includes(termino)
        );
        
        let coincideFiltroRapido = true;
        if (filtroActivo === 'urgencias') coincideFiltroRapido = servicio.urgencias === true;
        if (filtroActivo === 'online')    coincideFiltroRapido = (servicio.ubicacion || "").toLowerCase().includes('online');
        if (filtroActivo === 'domicilio') coincideFiltroRapido = (servicio.ubicacion || "").toLowerCase().includes('domicilio');
        
        if ((coincideTexto || terminosBusqueda.length === 0) && coincideFiltroRapido) {
            tarjeta.classList.remove('hidden');
            tarjetasVisibles++;
        } else {
            tarjeta.classList.add('hidden');
        }
    });

    const msjSinResultados = document.getElementById('mensaje-sin-resultados');
    if (msjSinResultados) {
        if (tarjetasVisibles === 0 && tarjetas.length > 0) { 
            msjSinResultados.classList.remove('hidden');
        } else {
            msjSinResultados.classList.add('hidden');
        }
    }
}

let timeoutBusqueda;
const inputBuscador = document.getElementById('buscador');
if (inputBuscador) {
    inputBuscador.addEventListener('input', () => {
        clearTimeout(timeoutBusqueda);
        timeoutBusqueda = setTimeout(aplicarFiltros, 300);
    });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            filtroActivo = "";
        } else {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActivo = btn.dataset.filter;
        }
        aplicarFiltros();
    });
});

const searchContainer = document.querySelector('.search-container');
const header = document.getElementById('main-header');

if (searchContainer && header) {
    window.addEventListener('scroll', () => {
        const headerBottom = header.offsetTop + header.offsetHeight;
        
        if (window.scrollY > headerBottom) {
            searchContainer.classList.add('sticky-search');
            document.body.classList.add('has-sticky-search');
        } else {
            searchContainer.classList.remove('sticky-search');
            document.body.classList.remove('has-sticky-search');
        }
    });
}

cargarServicios();
