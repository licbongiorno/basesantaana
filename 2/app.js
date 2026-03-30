import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// ==========================================
// UTILIDADES (Seguridad y Normalización)
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
// SPA (Single Page Application)
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
        if(seccionLogin) seccionLogin.classList.add('hidden');
        if(btnLogout) btnLogout.classList.remove('hidden');
        mostrarDashboard();
    } else {
        usuarioActual = null;
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

async function mostrarDashboard() {
    if(seccionFormulario) seccionFormulario.classList.add('hidden');
    if(seccionDashboard) seccionDashboard.classList.remove('hidden');
    
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
        btnSubmit.innerHTML = "⏳ Guardando..."; 
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
// VENTANA MODAL Y COMPARTIR (CON DEEP LINKING)
// ==========================================

// MODIFICADO: recibe id además de nombre y categoria
// y construye la URL única del anuncio para compartir
window.compartirPerfil = function(id, nombre, categoria) {
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    const texto = `${nombre} — ${categoria}`;

    if (navigator.share) {
        navigator.share({
            title: nombre,
            text: texto,
            url: url,
        }).catch(() => {}); // silencia cancelación del usuario
    } else {
        navigator.clipboard.writeText(url).then(() => {
            alert('¡Enlace copiado al portapapeles!');
        }).catch(() => {
            // fallback final: prompt copiable
            prompt('Copiá este enlace para compartir:', url);
        });
    }
};

const modalPerfil = document.getElementById('modal-perfil');
const modalBody = document.getElementById('modal-body');

// MODIFICADO: actualiza la URL al abrir el modal
window.abrirModal = function(id) {
    const data = window.directorioData[id];
    if(!data) return;

    // Deep Linking: escribe ?id=... en la barra sin recargar
    history.pushState({ modalId: id }, '', `?id=${id}`);

    const waNumero = formatearWhatsapp(data.whatsapp);
    const esDestacado = (data.nombre || "").toLowerCase().includes('nathalia andrada');
    const mensajeWA = encodeURIComponent(`Hola ${sanitize(data.nombre)}, vi tu servicio de ${sanitize(data.categoria)} en el Directorio de Santa Ana. Quería hacerte una consulta...`);
    
    let badgesHTML = "";
    if(esDestacado) badgesHTML += `<span class="badge" style="background:#fef08a; color:#854d0e; border: 1px solid #fde047;">⭐ DESTACADO</span>`;
    if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 URGENCIAS 24H</span>`;
    if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 PRESUPUESTO SIN CARGO</span>`;

    let redesHTML = "";
    if (data.instagram || data.facebook) {
        redesHTML += `<div class="redes-sociales" style="margin-top: 1.5rem;">`;
        if (data.instagram) {
            let igLink = formatearEnlace(data.instagram, 'instagram');
            redesHTML += `<a href="${igLink}" target="_blank" rel="noopener noreferrer" class="btn-social btn-ig rounded-button" onclick="event.stopPropagation();">Instagram</a>`;
        }
        if (data.facebook) {
            let fbLink = formatearEnlace(data.facebook, 'facebook');
            redesHTML += `<a href="${fbLink}" target="_blank" rel="noopener noreferrer" class="btn-social btn-fb rounded-button" onclick="event.stopPropagation();">Facebook</a>`;
        }
        redesHTML += `</div>`;
    }

    const shareIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

    if(modalBody) {
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; gap: 1rem;">
                <div class="categoria-tag" style="display: inline-block;">${sanitize(data.categoria)}</div>
                <button 
                    onclick="compartirPerfil('${id}', '${sanitize(data.nombre)}', '${sanitize(data.categoria)}')" 
                    class="btn-share" 
                    title="Compartir este anuncio"
                    style="opacity: 0.7; padding: 6px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted); flex-shrink: 0;">
                    ${shareIcon} Compartir
                </button>
            </div>
            <h2 style="font-size: 1.6rem; margin-bottom: 0.8rem; color: var(--text-color);">${sanitize(data.nombre)}</h2>
            ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
            
            <div style="margin: 1.5rem 0; padding: 1.5rem; background: var(--input-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 0.8rem; color: var(--primary-color);">Sobre el servicio</h4>
                <p style="color: var(--text-color); line-height: 1.6; white-space: pre-line;">${sanitize(data.descripcion)}</p>
            </div>
            
            <div class="info-extra" style="font-size: 1rem; border: none; padding: 0;">
                <p style="margin-bottom: 0.5rem;"><strong>📍 Modalidad:</strong> ${sanitize(data.ubicacion || 'Consultar')}</p>
            </div>
            
            ${redesHTML}
            
            <a href="https://wa.me/${waNumero}?text=${mensajeWA}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp rounded-button pulse-subtle" style="margin-top: 2rem;" onclick="event.stopPropagation();">
                💬 Consultar por WhatsApp
            </a>
        `;
    }

    if(modalPerfil) {
        modalPerfil.classList.remove('hidden');
        void modalPerfil.offsetWidth; 
        modalPerfil.classList.add('active');
        document.body.classList.add('modal-open');
    }
};

const btnCerrarModal = document.getElementById('btn-cerrar-modal');
if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModalPerfil);

if(modalPerfil) {
    modalPerfil.addEventListener('click', (e) => {
        if(e.target === modalPerfil) cerrarModalPerfil();
    });
}

// MODIFICADO: limpia la URL al cerrar el modal
function cerrarModalPerfil() {
    if(!modalPerfil) return;
    modalPerfil.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modalPerfil.classList.add('hidden'); }, 300);

    // Deep Linking: quita el ?id= de la URL
    history.pushState(null, '', window.location.pathname);
}

// NUEVO: soporte para el botón Atrás del navegador
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('id')) {
        // Cierra sin volver a limpiar la URL (ya fue limpiada por popstate)
        if(!modalPerfil) return;
        modalPerfil.classList.remove('active');
        document.body.classList.remove('modal-open');
        setTimeout(() => { modalPerfil.classList.add('hidden'); }, 300);
    }
});

// ==========================================
// DIRECTORIO Y FILTROS INTELIGENTES
// ==========================================
const listaServicios = document.getElementById('lista-servicios');
const contadorTexto = document.getElementById('contador-profesionales');
let filtroActivo = ""; 

async function cargarServicios() {
    if(!listaServicios) return;
    
    listaServicios.innerHTML = `
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    `;

    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        listaServicios.innerHTML = ""; 
        window.directorioData = {}; 
        
        if(contadorTexto) {
            contadorTexto.innerText = `⭐ Ya somos ${querySnapshot.size} profesionales listos para ayudarte`;
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

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.directorioData[docSnap.id] = data; 
            
            const waNumero = formatearWhatsapp(data.whatsapp); 
            const esDestacado = (data.nombre || "").toLowerCase().includes('nathalia andrada');
            const mensajeWA = encodeURIComponent(`Hola ${sanitize(data.nombre)}, vi tu servicio de ${sanitize(data.categoria)} en el Directorio de Santa Ana. Quería hacerte una consulta...`);
            
            let badgesHTML = "";
            if(esDestacado) badgesHTML += `<span class="badge" style="background:#fef08a; color:#854d0e; border: 1px solid #fde047;">⭐ DESTACADO</span>`;
            if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 24hs</span>`;
            if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 Sin Cargo</span>`;

            let redesHTML = "";
            if (data.instagram || data.facebook) {
                redesHTML += `<div class="redes-sociales">`;
                if (data.instagram) {
                    let igLink = formatearEnlace(data.instagram, 'instagram');
                    redesHTML += `<a href="${igLink}" target="_blank" rel="noopener noreferrer" class="btn-social btn-ig" onclick="event.stopPropagation();">Instagram</a>`;
                }
                if (data.facebook) {
                    let fbLink = formatearEnlace(data.facebook, 'facebook');
                    redesHTML += `<a href="${fbLink}" target="_blank" rel="noopener noreferrer" class="btn-social btn-fb" onclick="event.stopPropagation();">Facebook</a>`;
                }
                redesHTML += `</div>`;
            }

            const ubicacionSafe = (data.ubicacion || "").toString().toLowerCase();
            const esOnline = ubicacionSafe.includes('online') ? 'true' : 'false';
            const esDomicilio = ubicacionSafe.includes('domicilio') ? 'true' : 'false';
            
            const claseAdicional = esDestacado ? 'tarjeta-destacada' : '';
            const shareIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

            // MODIFICADO: btn-share ahora pasa el id como primer argumento
            const tarjetaHTML = `
                <article class="tarjeta-servicio fade-in-up ${claseAdicional}" 
                         style="animation-delay: ${delayAnimacion}s;"
                         onclick="abrirModal('${docSnap.id}')"
                         data-nombre="${sanitize(data.nombre)}"
                         data-categoria="${sanitize(data.categoria)}"
                         data-descripcion="${sanitize(data.descripcion)}"
                         data-urgencias="${data.urgencias || false}"
                         data-online="${esOnline}"
                         data-domicilio="${esDomicilio}">
                    <div class="card-header">
                        <div class="categoria-tag">${sanitize(data.categoria)}</div>
                        <button class="btn-share" onclick="event.stopPropagation(); compartirPerfil('${docSnap.id}', '${sanitize(data.nombre)}', '${sanitize(data.categoria)}')" title="Compartir Perfil" aria-label="Compartir Perfil">
                            ${shareIcon}
                        </button>
                    </div>
                    <h2>${sanitize(data.nombre)}</h2>
                    ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
                    <p class="descripcion">${sanitize(data.descripcion)}</p>
                    <div class="info-extra">
                        <span>📍 ${sanitize(data.ubicacion || 'Consultar')}</span>
                    </div>
                    ${redesHTML}
                    <a href="https://wa.me/${waNumero}?text=${mensajeWA}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp pulse-subtle" onclick="event.stopPropagation();">
                        💬 Consultar
                    </a>
                </article>
            `;
            
            if (esDestacado) htmlDestacados += tarjetaHTML;
            else htmlNormales += tarjetaHTML;
            delayAnimacion += 0.1; 
        });
        
        listaServicios.innerHTML = tarjetaCtaHTML + htmlDestacados + htmlNormales;

        // NUEVO: Deep Linking — abre el modal si la URL trae ?id=
        checkDeepLink();

    } catch (error) { 
        listaServicios.innerHTML = "<p style='color: red; text-align:center;'>Error de conexión. Intente refrescar la página.</p>"; 
    }
}

// NUEVO: lee ?id= de la URL y abre el modal correspondiente
function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && window.directorioData[id]) {
        abrirModal(id);
    }
}

function aplicarFiltros() {
    const buscador = document.getElementById('buscador');
    
    const textoBusqueda = buscador ? quitarAcentos(buscador.value.toLowerCase().trim()) : '';
    const terminosBusqueda = textoBusqueda.split(' ').filter(termino => termino.length > 0);
    
    const tarjetas = document.querySelectorAll('.tarjeta-servicio');
    let tarjetasVisibles = 0;

    tarjetas.forEach(tarjeta => {
        if(tarjeta.classList.contains('tarjeta-cta-unirse')) return;
        
        const contenido = quitarAcentos((tarjeta.dataset.nombre + " " + tarjeta.dataset.categoria + " " + tarjeta.dataset.descripcion).toLowerCase());
        
        const coincideTexto = terminosBusqueda.every(termino => contenido.includes(termino));
        
        let coincideFiltroRapido = true;
        if (filtroActivo === 'urgencias') coincideFiltroRapido = tarjeta.dataset.urgencias === 'true';
        if (filtroActivo === 'online') coincideFiltroRapido = tarjeta.dataset.online === 'true';
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
if(inputBuscador) {
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

cargarServicios();
