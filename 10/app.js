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
// UTILIDADES, TOAST Y CHECKBOXES
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

// LOGICA EXPERTA: Extraer textos de los checkboxes marcados
function obtenerTextoModalidad() {
    const checkboxes = document.querySelectorAll('input[name="modalidad"]:checked');
    const seleccionadas = Array.from(checkboxes).map(cb => cb.value);

    if (seleccionadas.length === 0) return "Modalidad a convenir";
    else if (seleccionadas.length === 1) return `Solo ${seleccionadas[0]}`;
    else return seleccionadas.join(", ").replace(/,([^,]*)$/, ' y $1');
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
    setTimeout(() => { toast.classList.remove('show'); }, 1500);
};

// ==========================================
// SVG ICONS Y MODO OSCURO
// ==========================================
const SVG_HEART_EMPTY = `<svg class="fav-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_HEART_FILLED = `<svg class="fav-svg fav-svg--filled" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

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
// SPA Y NAVEGACIÓN
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
// AUTENTICACIÓN Y PANEL DE USUARIO
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
            }
        } catch(e) { console.error("Error al obtener favoritos:", e); }

        seccionLogin.classList.add('hidden');
        seccionDashboard.classList.remove('hidden');
        document.getElementById('user-greeting').innerText = `¡Hola, ${user.displayName.split(' ')[0]}!`;
        mostrarDashboard();
    } else {
        usuarioActual = null;
        window.misFavoritos = [];
        seccionLogin.classList.remove('hidden');
        seccionDashboard.classList.add('hidden');
        seccionFormulario.classList.add('hidden');
    }
});

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => alert("Error al iniciar sesión: " + error.message));
});

btnLogout.addEventListener('click', () => {
    signOut(auth);
});

// ==========================================
// GESTIÓN DEL FORMULARIO Y DB
// ==========================================
document.getElementById('btn-nuevo-servicio').addEventListener('click', () => {
    documentoIdActual = null;
    document.getElementById('form-servicio').reset();
    document.getElementById('form-title').innerText = "Publicar Nuevo Servicio";
    seccionFormulario.classList.remove('hidden');
    seccionFormulario.scrollIntoView({behavior: "smooth"});
});

document.getElementById('btn-cancelar').addEventListener('click', () => {
    seccionFormulario.classList.add('hidden');
    document.getElementById('form-servicio').reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function mostrarDashboard() {
    seccionFormulario.classList.add('hidden');
    const contenedorLista = document.getElementById('lista-mis-servicios');
    contenedorLista.innerHTML = "<p>Cargando tus servicios...</p>";

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
    try {
        const docRef = doc(db, "servicios", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('nombre').value = data.nombre;
            document.getElementById('categoria').value = data.categoria;
            document.getElementById('whatsapp').value = data.whatsapp || '';
            document.getElementById('instagram').value = data.instagram || '';
            document.getElementById('facebook').value = data.facebook || '';
            document.getElementById('descripcion').value = data.descripcion;
            document.getElementById('urgencias').checked = data.urgencias || false;
            document.getElementById('presupuesto').checked = data.presupuesto || false;
            
            // Marcar checkboxes correspondientes a la modalidad guardada
            document.querySelectorAll('input[name="modalidad"]').forEach(cb => {
                cb.checked = data.ubicacion ? data.ubicacion.includes(cb.value) : false;
            });

            document.getElementById('form-title').innerText = "Editar Servicio";
            seccionFormulario.classList.remove('hidden');
            seccionFormulario.scrollIntoView({behavior: "smooth"});
        }
    } catch (error) { alert("Error al cargar datos del servicio."); }
}

window.borrarServicio = async function(id) {
    if(confirm("¿Estás seguro de que deseas borrar este servicio?")) {
        try {
            await deleteDoc(doc(db, "servicios", id));
            mostrarDashboard();
            mostrarToast("Servicio eliminado");
        } catch (error) { alert("Error al borrar."); }
    }
}

const formServicio = document.getElementById('form-servicio');
if (formServicio) {
    formServicio.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-guardar');
        btnSubmit.innerHTML = "Guardando...";
        btnSubmit.disabled = true;

        const datos = {
            nombre: sanitize(document.getElementById('nombre').value),
            categoria: sanitize(document.getElementById('categoria').value),
            ubicacion: sanitize(obtenerTextoModalidad()), // Usa la función inteligente
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
            mostrarToast("Guardado con éxito");
        } catch (error) {
            alert("Error al guardar. Por favor, intente nuevamente.");
        } finally {
            btnSubmit.innerHTML = "Guardar Servicio";
            btnSubmit.disabled = false;
        }
    });
}

// ==========================================
// TABS DEL PANEL (MIS SERVICIOS / FAVORITOS)
// ==========================================
const tabServicios = document.getElementById('tab-mis-servicios');
const tabFavoritos = document.getElementById('tab-mis-favoritos');
const contServicios = document.getElementById('contenido-mis-servicios');
const contFavoritos = document.getElementById('contenido-mis-favoritos');

if(tabServicios && tabFavoritos) {
    tabServicios.addEventListener('click', () => {
        tabServicios.classList.add('active');
        tabFavoritos.classList.remove('active');
        contServicios.classList.remove('hidden');
        contFavoritos.classList.add('hidden');
    });

    tabFavoritos.addEventListener('click', () => {
        tabFavoritos.classList.add('active');
        tabServicios.classList.remove('active');
        contFavoritos.classList.remove('hidden');
        contServicios.classList.add('hidden');
        window.renderizarMisFavoritosDash();
    });
}

// ==========================================
// CARGA PÚBLICA DE SERVICIOS
// ==========================================
const listaServicios = document.getElementById('lista-servicios');

async function cargarServicios() {
    if(!listaServicios) return;
    listaServicios.innerHTML = `<p style="text-align:center; width: 100%; color: var(--text-muted);">Cargando comunidad...</p>`;
    
    try {
        const querySnapshot = await getDocs(collection(db, "servicios"));
        window.directorioData = {};
        
        let conteo = 0;
        
        const tarjetaCtaHTML = `
            <article class="card card-cta" style="border: 2px dashed var(--primary-color); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2rem; background: var(--cta-bg-end); cursor: pointer;" onclick="window.abrirPanelGestion()">
                <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;">🚀</div>
                <h2 style="font-size: 1.3rem; color: var(--text-color); margin-bottom: 0.5rem; text-align: center;">Conseguí clientes hoy mismo</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; text-align: center;">
                    Publicá gratis en 2 minutos. Plomeros, electricistas, docentes... ¡Sumá ingresos desde hoy!
                </p>
                <button class="btn-whatsapp rounded-button pulse-subtle" style="background: var(--primary-color); width: auto; display:inline-block; padding: 10px 20px;">Publicar mi servicio Gratis</button>
            </article>
        `;

        if (querySnapshot.empty) {
            listaServicios.innerHTML = tarjetaCtaHTML;
            document.getElementById('contador-profesionales').innerText = "Sé el primero en sumarte";
            return;
        }

        let htmlGenerado = "";
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.directorioData[docSnap.id] = data;
            conteo++;
            
            let badges = '';
            if(data.urgencias) badges += `<span class="badge badge-red">🚨 24hs</span>`;
            if(data.presupuesto) badges += `<span class="badge badge-blue">💡 Presupuesto s/c</span>`;

            htmlGenerado += `
                <article class="card tarjeta-servicio" data-id="${docSnap.id}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${sanitize(data.categoria)}</span>
                        ${badges}
                    </div>
                    <h3 style="font-size: 1.25rem; margin-bottom: 5px;">${sanitize(data.nombre)}</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom: 15px;">📍 ${sanitize(data.ubicacion)}</p>
                    <div class="card-footer-more">
                        <button class="ver-mas-btn" onclick="mostrarModal('${docSnap.id}')">+ Ver más datos</button>
                    </div>
                </article>
            `;
        });

        listaServicios.innerHTML = tarjetaCtaHTML + htmlGenerado;
        
        const cont = document.getElementById('contador-profesionales');
        if(cont) cont.innerText = `Ya somos ${conteo} profesionales listos para ayudarte`;

    } catch (error) {
        listaServicios.innerHTML = `<p style="color:red; text-align:center; width:100%;">Error al conectar con la comunidad.</p>`;
    }
}

// Iniciar app
document.addEventListener('DOMContentLoaded', () => {
    cargarServicios();
});