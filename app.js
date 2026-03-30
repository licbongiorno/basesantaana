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
// UTILIDADES
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
// MODO OSCURO & UX DE SCROLL (MERCADO LIBRE STYLE)
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

// Efecto Scroll Cabecera
const header = document.getElementById('main-header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Evento Banner Promo
document.getElementById('btn-publicar-banner')?.addEventListener('click', () => {
    document.getElementById('btn-publicar').click();
});

// ==========================================
// SPA & PANELES
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
// AUTENTICACIÓN
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
        try { await signInWithPopup(auth, provider); } catch (e) { alert("Error al iniciar sesión."); }
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
                        <button onclick="editarServicio('${docSnap.id}')" style="background:var(--primary-color); color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer;">Editar</button>
                        <button onclick="borrarServicio('${docSnap.id}')" style="background:#dc2626; color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer;">Borrar</button>
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
        const docSnap = await getDoc(doc(db, "servicios", id));
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
        alert("Error al obtener los datos.");
        mostrarDashboard();
    }
};

window.borrarServicio = async function(id) {
    if(confirm("¿Seguro que deseas eliminar este servicio definitivamente?")) {
        await deleteDoc(doc(db, "servicios", id));
        mostrarDashboard();
    }
};

document.getElementById('btn-crear-nuevo')?.addEventListener('click', () => {
    documentoIdActual = null; 
    document.getElementById('form-servicio').reset();
    if(seccionDashboard) seccionDashboard.classList.add('hidden');
    if(seccionFormulario) seccionFormulario.classList.remove('hidden');
    document.getElementById('titulo-formulario').innerText = "Nuevo Servicio";
});

document.getElementById('btn-cancelar')?.addEventListener('click', mostrarDashboard);

document.getElementById('form-servicio')?.addEventListener('submit', async (e) => {
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
        if (documentoIdActual) await updateDoc(doc(db, "servicios", documentoIdActual), datos); 
        else await addDoc(collection(db, "servicios"), datos); 
        mostrarDashboard();
    } catch (error) { 
        alert("Error al guardar."); 
    } finally { 
        btnSubmit.innerHTML = "Guardar Servicio"; 
        btnSubmit.disabled = false; 
    }
});

// ==========================================
// MODAL & DIRECTORIO
// ==========================================
window.compartirPerfil = function(nombre, categoria) {
    if (navigator.share) {
        navigator.share({ title: nombre, text: `Mira este profesional en Santa Ana: ${nombre}`, url: window.location.href }).catch(console.error);
    } else {
        alert("Copia la dirección de esta página.");
    }
};

const modalPerfil = document.getElementById('modal-perfil');
const modalBody = document.getElementById('modal-body');

window.abrirModal = function(id) {
    const data = window.directorioData[id];
    if(!data) return;

    const waNumero = formatearWhatsapp(data.whatsapp);
    const esDestacado = (data.nombre || "").toLowerCase().includes('nathalia andrada');
    const mensajeWA = encodeURIComponent(`Hola ${sanitize(data.nombre)}, vi tu servicio en el Directorio de Santa Ana...`);
    
    let badgesHTML = "";
    if(esDestacado) badgesHTML += `<span class="badge" style="background:#fef08a; color:#854d0e; border: 1px solid #fde047;">⭐ DESTACADO</span>`;
    if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 24H</span>`;
    if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 PRESUPUESTO</span>`;

    let redesHTML = "";
    if (data.instagram || data.facebook) {
        redesHTML += `<div class="redes-sociales" style="margin-top: 1.5rem;">`;
        if (data.instagram) redesHTML += `<a href="${formatearEnlace(data.instagram, 'instagram')}" target="_blank" class="btn-social btn-ig rounded-button" onclick="event.stopPropagation();">Instagram</a>`;
        if (data.facebook) redesHTML += `<a href="${formatearEnlace(data.facebook, 'facebook')}" target="_blank" class="btn-social btn-fb rounded-button" onclick="event.stopPropagation();">Facebook</a>`;
        redesHTML += `</div>`;
    }

    if(modalBody) {
        modalBody.innerHTML = `
            <div class="categoria-tag" style="margin-bottom: 1rem; display: inline-block;">${sanitize(data.categoria)}</div>
            <h2 style="font-size: 1.6rem; margin-bottom: 0.8rem;">${sanitize(data.nombre)}</h2>
            ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
            <div style="margin: 1.5rem 0; padding: 1.5rem; background: var(--input-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                <p style="white-space: pre-line;">${sanitize(data.descripcion)}</p>
            </div>
            <p><strong>📍 Modalidad:</strong> ${sanitize(data.ubicacion || 'Consultar')}</p>
            ${redesHTML}
            <a href="https://wa.me/${waNumero}?text=${mensajeWA}" target="_blank" class="btn-whatsapp rounded-button pulse-subtle" style="margin-top: 2rem;">💬 Consultar por WhatsApp</a>
        `;
    }
    if(modalPerfil) {
        modalPerfil.classList.remove('hidden');
        void modalPerfil.offsetWidth; 
        modalPerfil.classList.add('active');
        document.body.classList.add('modal-open');
    }
};

document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrarModal);
modalPerfil?.addEventListener('click', (e) => { if(e.target === modalPerfil) cerrarModal(); });

function cerrarModal() {
    modalPerfil.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modalPerfil.classList.add('hidden'); }, 300);
}

const listaServicios = document.getElementById('lista-servicios');
const contadorTexto = document.getElementById('contador-profesionales');
let filtroActivo = ""; 

async function cargarServicios() {
    if(!listaServicios) return;
    listaServicios.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;

    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        listaServicios.innerHTML = ""; 
        window.directorioData = {}; 
        if(contadorTexto) contadorTexto.innerText = `⭐ Ya somos ${querySnapshot.size} profesionales`;

        if (querySnapshot.empty) return;

        let delayAnimacion = 0.1; 
        let htmlDestacados = "";
        let htmlNormales = "";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.directorioData[docSnap.id] = data; 
            
            const waNumero = formatearWhatsapp(data.whatsapp); 
            const esDestacado = (data.nombre || "").toLowerCase().includes('nathalia andrada');
            const mensajeWA = encodeURIComponent(`Hola ${sanitize(data.nombre)}, vi tu servicio en el Directorio...`);
            
            let badgesHTML = "";
            if(esDestacado) badgesHTML += `<span class="badge" style="background:#fef08a; color:#854d0e; border: 1px solid #fde047;">⭐ DESTACADO</span>`;
            if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 24hs</span>`;
            if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 Sin Cargo</span>`;

            let redesHTML = "";
            if (data.instagram || data.facebook) {
                redesHTML += `<div class="redes-sociales">`;
                if (data.instagram) redesHTML += `<a href="${formatearEnlace(data.instagram, 'instagram')}" target="_blank" class="btn-social btn-ig" onclick="event.stopPropagation();">IG</a>`;
                if (data.facebook) redesHTML += `<a href="${formatearEnlace(data.facebook, 'facebook')}" target="_blank" class="btn-social btn-fb" onclick="event.stopPropagation();">FB</a>`;
                redesHTML += `</div>`;
            }

            const ubicacionSafe = (data.ubicacion || "").toString().toLowerCase();
            const esOnline = ubicacionSafe.includes('online') ? 'true' : 'false';
            const esDomicilio = ubicacionSafe.includes('domicilio') ? 'true' : 'false';
            const claseAdicional = esDestacado ? 'tarjeta-destacada' : '';

            const tarjetaHTML = `
                <article class="tarjeta-servicio fade-in-up ${claseAdicional}" style="animation-delay: ${delayAnimacion}s;" onclick="abrirModal('${docSnap.id}')"
                         data-nombre="${sanitize(data.nombre)}" data-categoria="${sanitize(data.categoria)}" data-descripcion="${sanitize(data.descripcion)}" data-urgencias="${data.urgencias || false}" data-online="${esOnline}" data-domicilio="${esDomicilio}">
                    <div class="card-header">
                        <div class="categoria-tag">${sanitize(data.categoria)}</div>
                    </div>
                    <h2>${sanitize(data.nombre)}</h2>
                    ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
                    <p class="descripcion">${sanitize(data.descripcion)}</p>
                    <div class="info-extra"><span>📍 ${sanitize(data.ubicacion || 'Consultar')}</span></div>
                    ${redesHTML}
                    <a href="https://wa.me/${waNumero}?text=${mensajeWA}" target="_blank" class="btn-whatsapp pulse-subtle" onclick="event.stopPropagation();">💬 Consultar</a>
                </article>
            `;
            if (esDestacado) htmlDestacados += tarjetaHTML;
            else htmlNormales += tarjetaHTML;
            delayAnimacion += 0.1; 
        });
        
        listaServicios.innerHTML = htmlDestacados + htmlNormales;

    } catch (error) { 
        listaServicios.innerHTML = "<p style='color: red; text-align:center;'>Error de conexión.</p>"; 
    }
}

function aplicarFiltros() {
    const buscador = document.getElementById('buscador');
    const textoBusqueda = buscador ? quitarAcentos(buscador.value.toLowerCase().trim()) : '';
    const terminosBusqueda = textoBusqueda.split(' ').filter(termino => termino.length > 0);
    const bannerPromo = document.getElementById('banner-promocional');

    // UX: Ocultar banner si el usuario está buscando algo
    if (terminosBusqueda.length > 0) {
        bannerPromo?.classList.add('hidden');
    } else {
        bannerPromo?.classList.remove('hidden');
    }

    const tarjetas = document.querySelectorAll('.tarjeta-servicio');
    let tarjetasVisibles = 0;

    tarjetas.forEach(tarjeta => {
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
        if (tarjetasVisibles === 0 && tarjetas.length > 0) msjSinResultados.classList.remove('hidden');
        else msjSinResultados.classList.add('hidden');
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
