import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.directorioData = {};
window.misFavoritos = []; 

// ==========================================
// UTILIDADES Y TOAST
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

function formatearEnlace(url, plataforma) {
    if (!url) return '';
    let enlace = url.trim();
    if (enlace.startsWith('http://') || enlace.startsWith('https://')) return sanitize(enlace);
    if (plataforma === 'facebook') {
        if (enlace.includes('facebook.com')) return sanitize('https://' + enlace);
        return sanitize('https://www.facebook.com/' + enlace);
    }
    if (plataforma === 'instagram') {
        if (enlace.includes('instagram.com')) return sanitize('https://' + enlace);
        enlace = enlace.replace('@', '');
        return sanitize('https://www.instagram.com/' + enlace);
    }
    return sanitize(enlace);
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
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
};

// ==========================================
// SVG ICONS
// ==========================================
const SVG_HEART_EMPTY = `<svg class="fav-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_HEART_FILLED = `<svg class="fav-svg fav-svg--filled" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_SHARE = `<svg class="share-svg" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

// ==========================================
// MODO OSCURO
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
}

if(btnNavPanel) btnNavPanel.addEventListener('click', abrirPanelGestion);

if(btnVolverDirectorio) {
    btnVolverDirectorio.addEventListener('click', () => {
        if(vistaPanel) vistaPanel.classList.add('hidden');
        if(vistaDirectorio) vistaDirectorio.classList.remove('hidden');
        document.body.classList.remove('modo-formulario');
        cargarServicios(); 
    });
}

// ==========================================
// PANEL Y AUTENTICACIÓN
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
                window.misFavoritos = userDoc.data().favoritos;
            } else {
                window.misFavoritos = [];
            }
        } catch (error) {
            window.misFavoritos = [];
        }

        if(seccionLogin) seccionLogin.classList.add('hidden');
        if(btnLogout) btnLogout.classList.remove('hidden');
        mostrarDashboard();
    } else {
        usuarioActual = null;
        window.misFavoritos = [];
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
        try { await signInWithPopup(auth, provider); } catch (e) { alert("Error al iniciar sesión con Google."); }
    });
}

if(btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if(confirm("¿Seguro que deseas cerrar sesión?")) {
            try {
                await signOut(auth);
                if(btnVolverDirectorio) btnVolverDirectorio.click(); 
            } catch (error) { alert("Error al cerrar sesión."); }
        }
    });
}

// ==========================================
// TABS DEL DASHBOARD
// ==========================================
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
            contenedorLista.innerHTML = "<p style='color: var(--text-muted);'>Aún no tienes servicios publicados.</p>";
            return;
        }

        let htmlAcumulado = "";
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            htmlAcumulado += `
                <div class="item-dashboard fade-in-up">
                    <div>
                        <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${sanitize(data.nombre)}</h3>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${sanitize(data.categoria)}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="editarServicio('${docSnap.id}')" style="background:var(--primary-color); color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer; transition: 0.2s;">Editar</button>
                        <button onclick="borrarServicio('${docSnap.id}')" style="background:#dc2626; color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer; transition: 0.2s;">Borrar</button>
                    </div>
                </div>
            `;
        });
        contenedorLista.innerHTML = htmlAcumulado;
    } catch(e) {
        contenedorLista.innerHTML = "<p style='color: red;'>Error al cargar tus servicios.</p>";
    }
}

window.renderizarMisFavoritosDash = function() {
    const contenedorFavs = document.getElementById('lista-mis-favoritos');
    if(!contenedorFavs) return;
    
    const favs = obtenerFavoritos();
    if(favs.length === 0) {
        contenedorFavs.innerHTML = "<p style='color: var(--text-muted);'>Aún no has guardado a ningún profesional.</p>";
        return;
    }

    let htmlAcumulado = "";
    favs.forEach(id => {
        const data = window.directorioData[id];
        if(data) {
            htmlAcumulado += `
                <div class="item-dashboard fade-in-up" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${sanitize(data.nombre)}</h3>
                        <span style="font-size: 0.8rem; color: var(--primary-color); font-weight: bold;">${sanitize(data.categoria)}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="cerrarModalPerfil(); abrirModal('${id}')" style="background:var(--primary-color); color:white; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer;">Ver Anuncio</button>
                        <button onclick="toggleFavorito('${id}'); renderizarMisFavoritosDash();" style="background:#fee2e2; color:#ef4444; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer;">Quitar</button>
                    </div>
                </div>
            `;
        }
    });
    contenedorFavs.innerHTML = htmlAcumulado;
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
            alert("El servicio no existe o fue borrado.");
            mostrarDashboard();
        }
    } catch (error) {
        alert("Error al obtener los datos del servicio.");
        mostrarDashboard();
    }
};

window.borrarServicio = async function(id) {
    if(confirm("¿Seguro que deseas eliminar este servicio definitivamente? Esta acción no se puede deshacer.")) {
        await deleteDoc(doc(db, "servicios", id));
        mostrarDashboard();
    }
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
        const btnSubmit = document.getElementById('btn-guardar');
        btnSubmit.innerHTML = "Guardando..."; 
        btnSubmit.disabled = true;

        const datos = {
            nombre: sanitize(document.getElementById('nombre').value),
            categoria: sanitize(document.getElementById('categoria').value),
            ubicacion: sanitize(document.getElementById('ubicacion').value),
            whatsapp: sanitize(document.getElementById('whatsapp').value),
            instagram: sanitize(document.getElementById('instagram').value),
            facebook: sanitize(document.getElementById('facebook').value),
            descripcion: sanitize(document.getElementById('descripcion').value),
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
            mostrarDashboard();
        } catch (error) { 
            alert("Error al guardar. Por favor, intente nuevamente."); 
        } finally { 
            btnSubmit.innerHTML = "Guardar Servicio"; 
            btnSubmit.disabled = false; 
        }
    });
}

// ==========================================
// VENTANA MODAL, FAVORITOS Y COMPARTIR
// ==========================================
function obtenerFavoritos() {
    return window.misFavoritos || [];
}

window.toggleFavorito = async function(id) {
    if (!usuarioActual) {
        mostrarToast("⚠️ Iniciá sesión para guardar favoritos");
        return;
    }

    let favs = obtenerFavoritos();
    const estaEnFavs = favs.includes(id);
    const userDocRef = doc(db, "usuarios", usuarioActual.uid);

    try {
        if (estaEnFavs) {
            window.misFavoritos = favs.filter(favId => favId !== id);
            mostrarToast("❌ Quitado de favoritos");
        } else {
            window.misFavoritos.push(id);
            mostrarToast("❤️ Agregado a favoritos");
        }
        
        await setDoc(userDocRef, { favoritos: window.misFavoritos }, { merge: true });

        // Actualizar botón de la tarjeta en el directorio
        const cardFavBtn = document.querySelector(`.tarjeta-servicio[data-id="${id}"] .btn-fav-card`);
        if (cardFavBtn) {
            if (!estaEnFavs) {
                cardFavBtn.classList.add('active');
                cardFavBtn.innerHTML = SVG_HEART_FILLED;
            } else {
                cardFavBtn.classList.remove('active');
                cardFavBtn.innerHTML = SVG_HEART_EMPTY;
            }
        }

        const btnModal = document.getElementById('btn-fav-modal');
        if (btnModal) {
            const esFavAhora = !estaEnFavs;
            if (esFavAhora) {
                btnModal.innerHTML = '❤️ Quitar Favorito';
            } else {
                btnModal.innerHTML = '🤍 Guardar Favorito';
            }
        }

        const contFavoritos = document.getElementById('contenido-mis-favoritos');
        if (contFavoritos && !contFavoritos.classList.contains('hidden')) {
            renderizarMisFavoritosDash();
        }

    } catch (error) {
        mostrarToast("⚠️ Hubo un problema de conexión");
    }
};

window.compartirAnuncio = function(id, nombre, categoria) {
    const urlCompartir = window.location.origin + window.location.pathname + '?id=' + id;
    if (navigator.share) {
        navigator.share({
            title: nombre,
            text: `Mirá este profesional en el Directorio de Santa Ana: ${nombre} (${categoria})`,
            url: urlCompartir
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(urlCompartir).then(() => {
            mostrarToast('✅ Enlace copiado al portapapeles');
        }).catch(() => {
            prompt('Copiá este enlace:', urlCompartir);
        });
    }
};

const modalPerfil = document.getElementById('modal-perfil');
const modalBody = document.getElementById('modal-body');

window.abrirModal = function(id) {
    const data = window.directorioData[id];
    if (!data) return;

    history.pushState(null, null, '?id=' + id);

    const waNumero = formatearWhatsapp(data.whatsapp);
    const esDestacado = (data.nombre || "").toLowerCase().includes('nathalia andrada');
    const mensajeWA = encodeURIComponent(
        `Hola ${sanitize(data.nombre)}, vi tu anuncio de ${sanitize(data.categoria)} en el Directorio de Santa Ana. Quería hacerte una consulta...`
    );

    let badgesHTML = "";
    if (esDestacado) badgesHTML += `<span class="badge badge-destacado">DESTACADO</span>`;
    if (data.urgencias)  badgesHTML += `<span class="badge badge-red">URGENCIAS 24H</span>`;
    if (data.presupuesto) badgesHTML += `<span class="badge badge-blue">PRESUPUESTO SIN CARGO</span>`;

    let redesHTML = "";
    if (data.instagram || data.facebook) {
        redesHTML += `<div class="redes-sociales" style="margin-top: 1.5rem;">`;
        if (data.instagram) {
            redesHTML += `<a href="${formatearEnlace(data.instagram, 'instagram')}" target="_blank" rel="noopener noreferrer" class="btn-social btn-ig rounded-button">Instagram</a>`;
        }
        if (data.facebook) {
            redesHTML += `<a href="${formatearEnlace(data.facebook, 'facebook')}" target="_blank" rel="noopener noreferrer" class="btn-social btn-fb rounded-button">Facebook</a>`;
        }
        redesHTML += `</div>`;
    }

    const favs = obtenerFavoritos();
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
                <button id="btn-fav-modal" class="btn-modal-action" onclick="toggleFavorito('${id}')">
                    ${labelFav}
                </button>
                <button class="btn-modal-action btn-share" onclick="compartirAnuncio('${id}', '${sanitize(data.nombre).replace(/'/g, "\\'")}', '${sanitize(data.categoria).replace(/'/g, "\\'")}')">
                    📤 Compartir
                </button>
            </div>

            <a href="https://wa.me/${waNumero}?text=${mensajeWA}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp rounded-button pulse-subtle" style="margin-top: 0.5rem;">
                Consultar por WhatsApp
            </a>
        `;
    }

    if (modalPerfil) {
        modalPerfil.classList.remove('hidden');
        void modalPerfil.offsetWidth;
        modalPerfil.classList.add('active');
        document.body.classList.add('modal-open');
    }
};

window.cerrarModalPerfil = function() {
    if (!modalPerfil) return;
    modalPerfil.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modalPerfil.classList.add('hidden'); }, 300);
    history.pushState(null, null, window.location.pathname);
};

const btnCerrarModal = document.getElementById('btn-cerrar-modal');
if (btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModalPerfil);

if (modalPerfil) {
    modalPerfil.addEventListener('click', (e) => {
        if (e.target === modalPerfil) cerrarModalPerfil();
    });
}

// ==========================================
// DIRECTORIO Y CARGA DE DATOS
// ==========================================
const listaServicios = document.getElementById('lista-servicios');
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
        window.directorioData = {}; 
        
        if (contadorTexto) {
            contadorTexto.innerText = `Ya somos ${querySnapshot.size} profesionales listos para ayudarte`;
        }

        const tarjetaCtaHTML = `
            <article class="tarjeta-servicio tarjeta-cta-unirse fade-in-up professional-card" 
                     onclick="event.stopPropagation(); window.abrirPanelGestion();">
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

        if (querySnapshot.empty) { 
            listaServicios.innerHTML = tarjetaCtaHTML;
            return; 
        }

        let delayAnimacion = 0.1; 
        let htmlDestacados = "";
        let htmlNormales = "";
        const favsGuardados = obtenerFavoritos();

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.directorioData[docSnap.id] = data; 
            
            const esDestacado = (data.nombre || "").toLowerCase().includes('nathalia andrada');
            const claseAdicional = esDestacado ? 'tarjeta-destacada' : '';
            const esFav = favsGuardados.includes(docSnap.id);

            // AQUÍ VUELVEN A ESTAR LOS BOTONES Y EL "VER MÁS" DENTRO DE LA TARJETA
            const tarjetaHTML = `
                <article class="tarjeta-servicio fade-in-up ${claseAdicional}" 
                         style="animation-delay: ${delayAnimacion}s;"
                         onclick="abrirModal('${docSnap.id}')"
                         data-id="${docSnap.id}"
                         data-nombre="${sanitize(data.nombre)}"
                         data-categoria="${sanitize(data.categoria)}"
                         data-descripcion="${sanitize(data.descripcion)}"
                         data-urgencias="${data.urgencias || false}"
                         data-online="${(data.ubicacion || "").toLowerCase().includes('online') ? 'true' : 'false'}"
                         data-domicilio="${(data.ubicacion || "").toLowerCase().includes('domicilio') ? 'true' : 'false'}">

                    <div class="card-actions-top">
                        <button class="btn-icon-card btn-fav-card ${esFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorito('${docSnap.id}')" title="Favoritos">
                            ${esFav ? SVG_HEART_FILLED : SVG_HEART_EMPTY}
                        </button>
                        <button class="btn-icon-card btn-share-card" onclick="event.stopPropagation(); compartirAnuncio('${docSnap.id}', '${sanitize(data.nombre).replace(/'/g, "\\'")}', '${sanitize(data.categoria).replace(/'/g, "\\'")}')" title="Compartir">
                            ${SVG_SHARE}
                        </button>
                    </div>

                    <div class="categoria-tag">${sanitize(data.categoria)}</div>
                    <h2 class="titulo-con-margen">${sanitize(data.nombre)}</h2>
                    <p class="descripcion">${sanitize(data.descripcion)}</p>
                    <div class="info-extra">
                        <span>📍 ${sanitize(data.ubicacion || 'Consultar')}</span>
                    </div>

                    <div class="card-footer-more">
                        <span class="ver-mas-texto">➕ Ver más datos</span>
                    </div>
                </article>
            `;
            
            if (esDestacado) htmlDestacados += tarjetaHTML;
            else htmlNormales += tarjetaHTML;
            delayAnimacion += 0.1; 
        });
        
        listaServicios.innerHTML = tarjetaCtaHTML + htmlDestacados + htmlNormales;

        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const idCompartido = urlParams.get('id');
            if (idCompartido && window.directorioData[idCompartido]) {
                abrirModal(idCompartido);
            }
        }, 300);

    } catch (error) { 
        listaServicios.innerHTML = "<p style='color: red; text-align:center;'>Error de conexión. Intente refrescar la página.</p>"; 
    }
}

// ==========================================
// FILTROS, BÚSQUEDA Y STICKY HEADER
// ==========================================

function aplicarFiltros() {
    const buscador = document.getElementById('buscador');
    const textoBusqueda = buscador ? quitarAcentos(buscador.value.toLowerCase().trim()) : '';
    const terminosBusqueda = textoBusqueda.split(' ').filter(termino => termino.length > 0);
    
    const tarjetas = document.querySelectorAll('.tarjeta-servicio');
    let tarjetasVisibles = 0;

    tarjetas.forEach(tarjeta => {
        if (tarjeta.classList.contains('tarjeta-cta-unirse')) return;
        
        const nombre = quitarAcentos((tarjeta.dataset.nombre || "").toLowerCase());
        const categoria = quitarAcentos((tarjeta.dataset.categoria || "").toLowerCase());
        const descripcion = quitarAcentos((tarjeta.dataset.descripcion || "").toLowerCase());
        
        const coincideTexto = terminosBusqueda.every(termino => {
            if (termino.length <= 4) {
                // Busca palabra exacta para palabras cortas (ej: "arte")
                const regex = new RegExp(`\\b${termino}s?\\b`, 'i');
                return regex.test(nombre) || regex.test(categoria) || regex.test(descripcion);
            } else {
                return nombre.includes(termino) || categoria.includes(termino) || descripcion.includes(termino);
            }
        });
        
        let coincideFiltroRapido = true;
        if (filtroActivo === 'urgencias') coincideFiltroRapido = tarjeta.dataset.urgencias === 'true';
        if (filtroActivo === 'online')    coincideFiltroRapido = tarjeta.dataset.online === 'true';
        if (filtroActivo === 'domicilio') coincideFiltroRapido = tarjeta.dataset.domicilio === 'true';
        
        if ((coincideTexto || terminosBusqueda.length === 0) && coincideFiltroRapido) {
            tarjeta.classList.remove('hidden');
            tarjetasVisibles++;
        } else {
            tarjeta.classList.add('hidden');
        }
    });

    const msjSinResultados = document.getElementById('mensaje-sin-resultados');
    if (msjSinResultados) {
        if (tarjetasVisibles === 0 && tarjetas.length > 1) { 
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

// --- LÓGICA DE STICKY HEADER ---
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