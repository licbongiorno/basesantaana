import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
// FUNCIÓN INTELIGENTE DE ENLACES (Corregida)
// ==========================================
function formatearEnlace(url, plataforma) {
    if (!url) return '';
    let enlace = url.trim();
    
    // Si ya es un enlace completo y correcto, lo devolvemos
    if (enlace.startsWith('http://') || enlace.startsWith('https://')) {
        return enlace;
    }
    
    // Si no, lo construimos basados en la plataforma
    if (plataforma === 'facebook') {
        // CORRECCIÓN: Acepta tanto el usuario solo como si pusieron facebook.com/...
        if (enlace.includes('facebook.com')) return 'https://' + enlace;
        return 'https://www.facebook.com/' + enlace;
    }
    
    if (plataforma === 'instagram') {
        if (enlace.includes('instagram.com')) return 'https://' + enlace;
        enlace = enlace.replace('@', ''); // Limpiamos la @ si la pusieron
        return 'https://www.instagram.com/' + enlace;
    }
    
    return enlace;
}

// ==========================================
// MODO OSCURO (Dark Mode)
// ==========================================
const btnTheme = document.getElementById('btn-theme-toggle');
const body = document.body;

if (localStorage.getItem('theme') === 'dark') {
    body.setAttribute('data-theme', 'dark');
    btnTheme.innerText = '☀️';
}

btnTheme.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        btnTheme.innerText = '🌙';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        btnTheme.innerText = '☀️';
    }
});

// ==========================================
// CONTROL DE VISTAS (SPA)
// ==========================================
const vistaDirectorio = document.getElementById('vista-directorio');
const vistaPanel = document.getElementById('vista-panel');
const btnNavPanel = document.getElementById('btn-nav-panel');
const btnVolverDirectorio = document.getElementById('btn-volver-directorio');

// Función centralizada para abrir el panel de gestión
window.abrirPanelGestion = function() {
    vistaDirectorio.style.display = 'none';
    vistaPanel.style.display = 'block';
    window.scrollTo(0,0);
}

btnNavPanel.addEventListener('click', abrirPanelGestion);

btnVolverDirectorio.addEventListener('click', () => {
    vistaPanel.style.display = 'none';
    vistaDirectorio.style.display = 'block';
    cargarServicios(); 
});

// ==========================================
// LÓGICA DEL PANEL DE AUTOGESTIÓN Y AUTH
// ==========================================
let documentoIdActual = null; 
let usuarioActual = null;
const btnLogout = document.getElementById('btn-logout');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActual = user;
        document.getElementById('seccion-login').style.display = 'none';
        btnLogout.style.display = 'inline-block'; // Mostrar botón Cerrar Sesión
        mostrarDashboard();
    } else {
        document.getElementById('seccion-login').style.display = 'flex';
        document.getElementById('seccion-dashboard').style.display = 'none';
        document.getElementById('seccion-formulario').style.display = 'none';
        btnLogout.style.display = 'none'; // Ocultar botón Cerrar Sesión
        usuarioActual = null;
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("Error al iniciar sesión."); }
});

// LÓGICA DE CERRAR SESIÓN
btnLogout.addEventListener('click', async () => {
    if(confirm("¿Seguro que deseas cerrar sesión?")) {
        try {
            await signOut(auth);
            alert("Sesión cerrada correctamente.");
            document.getElementById('btn-volver-directorio').click(); // Volver al inicio
        } catch (error) { alert("Error al cerrar sesión."); }
    }
});

async function mostrarDashboard() {
    document.getElementById('seccion-formulario').style.display = 'none';
    document.getElementById('seccion-dashboard').style.display = 'block';
    const contenedorLista = document.getElementById('lista-mis-servicios');
    contenedorLista.innerHTML = "Cargando tus servicios...";

    const q = query(collection(db, "servicios"), where("usuarioId", "==", usuarioActual.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        contenedorLista.innerHTML = "<p>Aún no tienes servicios publicados.</p>";
        return;
    }

    contenedorLista.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        contenedorLista.innerHTML += `
            <div class="item-dashboard fade-in-up">
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom:0.2rem;">${data.nombre}</h3>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${data.categoria}</span>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button onclick="editarServicio('${docSnap.id}')" style="background:var(--primary-color); color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer;">Editar</button>
                    <button onclick="borrarServicio('${docSnap.id}')" style="background:#dc2626; color:white; border:none; padding:0.5rem; border-radius:8px; cursor:pointer;">Borrar</button>
                </div>
            </div>
        `;
    });
}

window.editarServicio = async function(id) {
    documentoIdActual = id;
    document.getElementById('seccion-dashboard').style.display = 'none';
    document.getElementById('seccion-formulario').style.display = 'block';
    document.getElementById('titulo-formulario').innerText = "Editar Servicio";
    
    const q = query(collection(db, "servicios"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
        if (docSnap.id === id) {
            const data = docSnap.data();
            document.getElementById('nombre').value = data.nombre || '';
            document.getElementById('categoria').value = data.categoria || '';
            document.getElementById('ubicacion').value = data.ubicacion || 'A domicilio';
            document.getElementById('whatsapp').value = data.whatsapp || '';
            document.getElementById('instagram').value = data.instagram || '';
            document.getElementById('facebook').value = data.facebook || '';
            document.getElementById('descripcion').value = data.descripcion || '';
            document.getElementById('urgencias').checked = data.urgencias || false;
            document.getElementById('presupuesto').checked = data.presupuesto || false;
        }
    });
};

window.borrarServicio = async function(id) {
    if(confirm("¿Seguro que deseas eliminar este servicio definitivamente?")) {
        await deleteDoc(doc(db, "servicios", id));
        mostrarDashboard();
    }
};

document.getElementById('btn-crear-nuevo').addEventListener('click', () => {
    documentoIdActual = null;
    document.getElementById('form-servicio').reset();
    document.getElementById('seccion-dashboard').style.display = 'none';
    document.getElementById('seccion-formulario').style.display = 'block';
    document.getElementById('titulo-formulario').innerText = "Nuevo Servicio";
});

document.getElementById('btn-cancelar').addEventListener('click', () => { mostrarDashboard(); });

document.getElementById('form-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-guardar');
    btnSubmit.innerText = "Guardando..."; btnSubmit.disabled = true;

    const datos = {
        nombre: document.getElementById('nombre').value,
        categoria: document.getElementById('categoria').value,
        ubicacion: document.getElementById('ubicacion').value,
        whatsapp: document.getElementById('whatsapp').value,
        instagram: document.getElementById('instagram').value,
        facebook: document.getElementById('facebook').value,
        descripcion: document.getElementById('descripcion').value,
        urgencias: document.getElementById('urgencias').checked,
        presupuesto: document.getElementById('presupuesto').checked,
        usuarioId: usuarioActual.uid, 
        ultimaActualizacion: new Date()
    };

    try {
        if (documentoIdActual) { await updateDoc(doc(db, "servicios", documentoIdActual), datos); } 
        else { await addDoc(collection(db, "servicios"), datos); }
        mostrarDashboard();
    } catch (error) { alert("Error al guardar."); } 
    finally { btnSubmit.innerText = "Guardar Servicio"; btnSubmit.disabled = false; }
});

// ==========================================
// COMPARTIR PERFIL
// ==========================================
window.compartirPerfil = function(nombre, categoria) {
    if (navigator.share) {
        navigator.share({
            title: nombre,
            text: `Mira este profesional en Santa Ana: ${nombre} (${categoria})`,
            url: window.location.href
        }).catch(console.error);
    } else {
        alert("Para compartir, copia la dirección web de esta página.");
    }
};

// ==========================================
// VENTANA MODAL (Perfil Completo)
// ==========================================
const modalPerfil = document.getElementById('modal-perfil');
const modalBody = document.getElementById('modal-body');

window.abrirModal = function(id) {
    const data = window.directorioData[id];
    if(!data) return;

    const waNumero = data.whatsapp.replace(/\D/g,'');
    
    let badgesHTML = "";
    if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 URGENCIAS 24H</span>`;
    if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 PRESUPUESTO SIN CARGO</span>`;

    let redesHTML = "";
    if (data.instagram || data.facebook) {
        redesHTML += `<div class="redes-sociales" style="margin-top: 1.5rem;">`;
        if (data.instagram) {
            let igLink = formatearEnlace(data.instagram, 'instagram');
            redesHTML += `<a href="${igLink}" target="_blank" class="btn-social btn-ig rounded-button" onclick="event.stopPropagation();">Instagram</a>`;
        }
        if (data.facebook) {
            // CORRECCIÓN INTELIGENTE DE ENLACE FACEBOOK
            let fbLink = formatearEnlace(data.facebook, 'facebook');
            redesHTML += `<a href="${fbLink}" target="_blank" class="btn-social btn-fb rounded-button" onclick="event.stopPropagation();">Facebook</a>`;
        }
        redesHTML += `</div>`;
    }

    modalBody.innerHTML = `
        <div class="categoria-tag" style="margin-bottom: 1rem; display: inline-block;">${data.categoria}</div>
        <h2 style="font-size: 1.6rem; margin-bottom: 0.8rem; color: var(--text-color);">${data.nombre}</h2>
        ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
        
        <div style="margin: 1.5rem 0; padding: 1.5rem; background: var(--input-bg); border-radius: 12px; border: 1px solid var(--border-color);">
            <h4 style="margin-bottom: 0.8rem; color: var(--primary-color);">Sobre el servicio</h4>
            <p style="color: var(--text-color); line-height: 1.6; white-space: pre-line;">${data.descripcion}</p>
        </div>
        
        <div class="info-extra" style="font-size: 1rem; border: none; padding: 0;">
            <p style="margin-bottom: 0.5rem;"><strong>📍 Modalidad:</strong> ${data.ubicacion || 'Consultar'}</p>
        </div>
        
        ${redesHTML}
        
        <a href="https://wa.me/${waNumero}?text=Hola,%20vi%20tu%20perfil%20en%20el%20directorio%20de%20Santa%20Ana" target="_blank" class="btn-whatsapp rounded-button-large pulse-subtle" style="margin-top: 2rem;" onclick="event.stopPropagation();">
            📲 Enviar WhatsApp
        </a>
    `;

    modalPerfil.style.display = 'flex';
    void modalPerfil.offsetWidth; 
    modalPerfil.classList.add('active');
    document.body.classList.add('modal-open');
};

document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModalPerfil);
modalPerfil.addEventListener('click', (e) => {
    if(e.target === modalPerfil) cerrarModalPerfil();
});

function cerrarModalPerfil() {
    modalPerfil.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modalPerfil.style.display = 'none'; }, 300);
}

// ==========================================
// DIRECTORIO, BUSCADOR Y FILTROS
// ==========================================
const listaServicios = document.getElementById('lista-servicios');
const contadorTexto = document.getElementById('contador-profesionales');
let filtroActivo = ""; 

async function cargarServicios() {
    listaServicios.innerHTML = `
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    `;

    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        listaServicios.innerHTML = ""; 
        window.directorioData = {}; 
        
        const cantidad = querySnapshot.size;
        contadorTexto.innerText = `⭐ Ya somos ${cantidad} profesionales listos para ayudarte`;

        // === PASO 2 CENTRAL DE UX: LA TARJETA DE INVITACIÓN SIEMPRE PRIMERO ===
        const tarjetaCtaHTML = `
            <article class="tarjeta-servicio tarjeta-cta-unirse fade-in-up professional-card" 
                     onclick="event.stopPropagation(); abrirPanelGestion();">
                <div class="centrado" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <span style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;">➕</span>
                    <h2 style="font-size: 1.25rem; color: var(--text-color); margin-bottom: 0.5rem; text-align: center;">¿Ofreces un servicio en Santa Ana?</h2>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; text-align: center;">
                        Plomeros, electricistas, docentes, etc... ¡Sumate al directorio gratis y hacete ver por tus vecinos!
                    </p>
                    <button class="btn-whatsapp rounded-button-large pulse-subtle" style="background: var(--primary-color); width: auto; display:inline-block; padding: 10px 20px;">Sumarme Ahora Gratis</button>
                </div>
            </article>
        `;
        listaServicios.innerHTML += tarjetaCtaHTML;

        if (querySnapshot.empty) { return; }

        let delayAnimacion = 0.1; 

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.directorioData[docSnap.id] = data; 
            
            const waNumero = data.whatsapp.replace(/\D/g,''); 
            
            let badgesHTML = "";
            if(data.urgencias) badgesHTML += `<span class="badge badge-red">🚨 24hs</span>`;
            if(data.presupuesto) badgesHTML += `<span class="badge badge-blue">💡 Sin Cargo</span>`;

            let redesHTML = "";
            if (data.instagram || data.facebook) {
                redesHTML += `<div class="redes-sociales">`;
                if (data.instagram) {
                    let igLink = formatearEnlace(data.instagram, 'instagram');
                    redesHTML += `<a href="${igLink}" target="_blank" class="btn-social btn-ig" onclick="event.stopPropagation();">Instagram</a>`;
                }
                if (data.facebook) {
                    // CORRECCIÓN INTELIGENTE DE ENLACE FACEBOOK
                    let fbLink = formatearEnlace(data.facebook, 'facebook');
                    redesHTML += `<a href="${fbLink}" target="_blank" class="btn-social btn-fb" onclick="event.stopPropagation();">Facebook</a>`;
                }
                redesHTML += `</div>`;
            }

            const esOnline = data.ubicacion.includes('Online') ? 'true' : 'false';
            const esDomicilio = data.ubicacion.includes('domicilio') ? 'true' : 'false';

            const shareIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

            const tarjetaHTML = `
                <article class="tarjeta-servicio fade-in-up" 
                         style="animation-delay: ${delayAnimacion}s;"
                         onclick="abrirModal('${docSnap.id}')"
                         data-urgencias="${data.urgencias || false}"
                         data-online="${esOnline}"
                         data-domicilio="${esDomicilio}">
                    
                    <div class="card-header">
                        <div class="categoria-tag">${data.categoria}</div>
                        <button class="btn-share" onclick="event.stopPropagation(); compartirPerfil('${data.nombre}', '${data.categoria}')" title="Compartir Perfil">
                            ${shareIcon}
                        </button>
                    </div>
                    
                    <h2>${data.nombre}</h2>
                    ${badgesHTML !== "" ? `<div class="badges-container">${badgesHTML}</div>` : ""}
                    <p class="descripcion">${data.descripcion}</p>
                    
                    <div class="info-extra">
                        <span>📍 ${data.ubicacion || 'Consultar'}</span>
                    </div>
                    
                    ${redesHTML}
                    <a href="https://wa.me/${waNumero}?text=Hola,%20vi%20tu%20perfil%20en%20el%20directorio" target="_blank" class="btn-whatsapp pulse-subtle" onclick="event.stopPropagation();">
                        Contactar
                    </a>
                </article>
            `;
            listaServicios.innerHTML += tarjetaHTML;
            delayAnimacion += 0.1; 
        });

    } catch (error) { listaServicios.innerHTML = "<p style='color: red;'>Error de conexión.</p>"; }
}

function aplicarFiltros() {
    const textoBusqueda = document.getElementById('buscador').value.toLowerCase();
    const tarjetas = document.querySelectorAll('.tarjeta-servicio');

    tarjetas.forEach(tarjeta => {
        if(tarjeta.classList.contains('tarjeta-cta-unirse')) return;

        const contenido = tarjeta.innerText.toLowerCase();
        const coincideTexto = contenido.includes(textoBusqueda);
        
        let coincideFiltroRapido = true;
        if (filtroActivo === 'urgencias') coincideFiltroRapido = tarjeta.dataset.urgencias === 'true';
        if (filtroActivo === 'online') coincideFiltroRapido = tarjeta.dataset.online === 'true';
        if (filtroActivo === 'domicilio') coincideFiltroRapido = tarjeta.dataset.domicilio === 'true';

        tarjeta.style.display = (coincideTexto && coincideFiltroRapido) ? 'flex' : 'none';
    });
}

document.getElementById('buscador').addEventListener('input', aplicarFiltros);

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
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
